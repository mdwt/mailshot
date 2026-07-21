package main

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/cloudformation"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	ddbtypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/aws/aws-sdk-go-v2/service/sfn"
	sfntypes "github.com/aws/aws-sdk-go-v2/service/sfn/types"
)

// DataService — Phase 2 runtime reads. Query patterns mirror the MCP server
// (packages/mcp/src/tools) and the shared key helpers:
//   STATS#<id>/COUNTERS   denormalised engagement counters
//   EXEC#<id>/SUB#<email> inverted execution rows (Select COUNT for actives)
//   BROADCAST/<ts>#<id>   broadcast log
//   Events table          PK=SUB#<email>, GSIs TemplateIndex + SequenceIndex
// All read-only; errors are embedded per-item so one failure doesn't blank a view.

// AwsCtx carries the project's .env-derived AWS settings on every call — the
// backend stays stateless.
type AwsCtx struct {
	Profile         string `json:"profile"`
	Region          string `json:"region"`
	TableName       string `json:"tableName"`
	EventsTableName string `json:"eventsTableName"`
	StackName       string `json:"stackName"`
}

type Counters struct {
	Delivery  int `json:"delivery"`
	Open      int `json:"open"`
	Click     int `json:"click"`
	Bounce    int `json:"bounce"`
	Complaint int `json:"complaint"`
}

type SequenceRuntime struct {
	SequenceID       string   `json:"sequenceId"`
	ActiveExecutions int      `json:"activeExecutions"`
	Counters         Counters `json:"counters"`
	Error            string   `json:"error"`
}

type TemplateStat struct {
	TemplateKey string   `json:"templateKey"`
	Counters    Counters `json:"counters"`
	Truncated   bool     `json:"truncated"`
	Error       string   `json:"error"`
}

type EventRow struct {
	Email       string `json:"email"`
	EventType   string `json:"eventType"`
	TemplateKey string `json:"templateKey"`
	SequenceID  string `json:"sequenceId"`
	Subject     string `json:"subject"`
	Timestamp   string `json:"timestamp"`
}

type DayCounts struct {
	Date      string `json:"date"` // YYYY-MM-DD
	Delivery  int    `json:"delivery"`
	Open      int    `json:"open"`
	Click     int    `json:"click"`
	Bounce    int    `json:"bounce"`
	Complaint int    `json:"complaint"`
}

type ExecRow struct {
	SequenceID    string `json:"sequenceId"`
	StartedAt     string `json:"startedAt"`
	Transactional bool   `json:"transactional"`
}

type SendRow struct {
	SentAt      string `json:"sentAt"`
	TemplateKey string `json:"templateKey"`
	SequenceID  string `json:"sequenceId"`
	Subject     string `json:"subject"`
}

type SubscriberDetail struct {
	Found       bool      `json:"found"`
	ProfileJSON string    `json:"profileJson"` // full PROFILE item; frontend separates system columns
	Executions  []ExecRow `json:"executions"`
	SendLog     []SendRow `json:"sendLog"`
	Suppression string    `json:"suppression"` // "" or "bounce"/"complaint"
	Error       string    `json:"error"`
}

type SeqSubscriberRow struct {
	Email         string `json:"email"`
	StartedAt     string `json:"startedAt"`
	Transactional bool   `json:"transactional"`
}

type TagRow struct {
	Email    string `json:"email"`
	TaggedAt string `json:"taggedAt"`
}

type BroadcastRow struct {
	BroadcastID  string   `json:"broadcastId"`
	TemplateKey  string   `json:"templateKey"`
	Subject      string   `json:"subject"`
	FromEmail    string   `json:"fromEmail"`
	SentAt       string   `json:"sentAt"`
	AudienceSize int      `json:"audienceSize"`
	Counters     Counters `json:"counters"`
}

type FailedExec struct {
	StateMachine string `json:"stateMachine"`
	Name         string `json:"name"`
	StartDate    string `json:"startDate"`
	StopDate     string `json:"stopDate"`
}

type SesHealth struct {
	Max24HourSend    float64 `json:"max24HourSend"`
	SentLast24Hours  float64 `json:"sentLast24Hours"`
	MaxSendRate      float64 `json:"maxSendRate"`
	SendingEnabled   bool    `json:"sendingEnabled"`
	ProductionAccess bool    `json:"productionAccess"`
	Error            string  `json:"error"`
}

type DataService struct{}

func NewDataService() *DataService {
	return &DataService{}
}

func (s *DataService) ddb(ctx context.Context, c AwsCtx) (*dynamodb.Client, error) {
	cfg, err := loadAwsConfig(ctx, c.Profile, c.Region)
	if err != nil {
		return nil, err
	}
	return dynamodb.NewFromConfig(cfg), nil
}

func countersFromItem(item map[string]any) Counters {
	get := func(k string) int {
		if v, ok := item[k].(float64); ok {
			return int(v)
		}
		return 0
	}
	return Counters{
		Delivery:  get("deliveryCount"),
		Open:      get("openCount"),
		Click:     get("clickCount"),
		Bounce:    get("bounceCount"),
		Complaint: get("complaintCount"),
	}
}

func unmarshalItem(item map[string]ddbtypes.AttributeValue) map[string]any {
	out := map[string]any{}
	_ = attributevalue.UnmarshalMap(item, &out)
	return out
}

// SequenceOverview returns counters + active execution counts for a set of
// sequence ids (fanned out concurrently — one GetItem + one COUNT query each).
func (s *DataService) SequenceOverview(c AwsCtx, sequenceIds []string) []SequenceRuntime {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	out := make([]SequenceRuntime, len(sequenceIds))
	db, err := s.ddb(ctx, c)
	if err != nil {
		for i, id := range sequenceIds {
			out[i] = SequenceRuntime{SequenceID: id, Error: err.Error()}
		}
		return out
	}

	var wg sync.WaitGroup
	for i, id := range sequenceIds {
		wg.Add(1)
		go func(i int, id string) {
			defer wg.Done()
			r := SequenceRuntime{SequenceID: id}

			stats, err := db.GetItem(ctx, &dynamodb.GetItemInput{
				TableName: aws.String(c.TableName),
				Key: map[string]ddbtypes.AttributeValue{
					"PK": &ddbtypes.AttributeValueMemberS{Value: "STATS#" + id},
					"SK": &ddbtypes.AttributeValueMemberS{Value: "COUNTERS"},
				},
			})
			if err != nil {
				r.Error = err.Error()
			} else if stats.Item != nil {
				r.Counters = countersFromItem(unmarshalItem(stats.Item))
			}

			count, err := db.Query(ctx, &dynamodb.QueryInput{
				TableName:              aws.String(c.TableName),
				KeyConditionExpression: aws.String("PK = :pk"),
				ExpressionAttributeValues: map[string]ddbtypes.AttributeValue{
					":pk": &ddbtypes.AttributeValueMemberS{Value: "EXEC#" + id},
				},
				Select: ddbtypes.SelectCount,
			})
			if err != nil {
				if r.Error == "" {
					r.Error = err.Error()
				}
			} else {
				r.ActiveExecutions = int(count.Count)
			}
			out[i] = r
		}(i, id)
	}
	wg.Wait()
	return out
}

// TemplateStats aggregates event counts per template via the TemplateIndex
// GSI, limited to the last sinceDays. Pages are capped; Truncated is set when
// the cap was hit so the UI never silently under-reports.
func (s *DataService) TemplateStats(c AwsCtx, templateKeys []string, sinceDays int) []TemplateStat {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	out := make([]TemplateStat, len(templateKeys))
	db, err := s.ddb(ctx, c)
	if err != nil {
		for i, k := range templateKeys {
			out[i] = TemplateStat{TemplateKey: k, Error: err.Error()}
		}
		return out
	}
	since := "EVT#" + time.Now().UTC().AddDate(0, 0, -sinceDays).Format(time.RFC3339)

	var wg sync.WaitGroup
	for i, key := range templateKeys {
		wg.Add(1)
		go func(i int, key string) {
			defer wg.Done()
			st := TemplateStat{TemplateKey: key}
			var lastKey map[string]ddbtypes.AttributeValue
			for page := 0; page < 20; page++ {
				resp, err := db.Query(ctx, &dynamodb.QueryInput{
					TableName:              aws.String(c.EventsTableName),
					IndexName:              aws.String("TemplateIndex"),
					KeyConditionExpression: aws.String("templateKey = :tk AND SK >= :since"),
					ExpressionAttributeValues: map[string]ddbtypes.AttributeValue{
						":tk":    &ddbtypes.AttributeValueMemberS{Value: key},
						":since": &ddbtypes.AttributeValueMemberS{Value: since},
					},
					ProjectionExpression: aws.String("eventType"),
					ExclusiveStartKey:    lastKey,
				})
				if err != nil {
					st.Error = err.Error()
					break
				}
				for _, item := range resp.Items {
					switch unmarshalItem(item)["eventType"] {
					case "delivery":
						st.Counters.Delivery++
					case "open":
						st.Counters.Open++
					case "click":
						st.Counters.Click++
					case "bounce":
						st.Counters.Bounce++
					case "complaint":
						st.Counters.Complaint++
					}
				}
				lastKey = resp.LastEvaluatedKey
				if lastKey == nil {
					break
				}
				if page == 19 {
					st.Truncated = true
				}
			}
			out[i] = st
		}(i, key)
	}
	wg.Wait()
	return out
}

func eventRowFromItem(item map[string]any) EventRow {
	str := func(k string) string {
		if v, ok := item[k].(string); ok {
			return v
		}
		return ""
	}
	return EventRow{
		Email:       strings.TrimPrefix(str("PK"), "SUB#"),
		EventType:   str("eventType"),
		TemplateKey: str("templateKey"),
		SequenceID:  str("sequenceId"),
		Subject:     str("subject"),
		Timestamp:   str("timestamp"),
	}
}

// RecentEvents merges the newest engagement events across the given sequence
// ids (one SequenceIndex query each, newest-first).
func (s *DataService) RecentEvents(c AwsCtx, sequenceIds []string, limit int) ([]EventRow, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	db, err := s.ddb(ctx, c)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 100 {
		limit = 25
	}

	var mu sync.Mutex
	var all []EventRow
	var wg sync.WaitGroup
	for _, id := range sequenceIds {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			resp, err := db.Query(ctx, &dynamodb.QueryInput{
				TableName:              aws.String(c.EventsTableName),
				IndexName:              aws.String("SequenceIndex"),
				KeyConditionExpression: aws.String("sequenceId = :sid"),
				ExpressionAttributeValues: map[string]ddbtypes.AttributeValue{
					":sid": &ddbtypes.AttributeValueMemberS{Value: id},
				},
				ScanIndexForward: aws.Bool(false),
				Limit:            aws.Int32(int32(limit)),
			})
			if err != nil {
				return
			}
			mu.Lock()
			for _, item := range resp.Items {
				all = append(all, eventRowFromItem(unmarshalItem(item)))
			}
			mu.Unlock()
		}(id)
	}
	wg.Wait()

	sort.Slice(all, func(i, j int) bool { return all[i].Timestamp > all[j].Timestamp })
	if len(all) > limit {
		all = all[:limit]
	}
	return all, nil
}

// SequenceTimeSeries buckets a sequence's events per day for the last `days`.
func (s *DataService) SequenceTimeSeries(c AwsCtx, sequenceId string, days int) ([]DayCounts, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := s.ddb(ctx, c)
	if err != nil {
		return nil, err
	}
	if days <= 0 || days > 90 {
		days = 30
	}
	since := "EVT#" + time.Now().UTC().AddDate(0, 0, -days).Format(time.RFC3339)

	buckets := map[string]*DayCounts{}
	var lastKey map[string]ddbtypes.AttributeValue
	for page := 0; page < 30; page++ {
		resp, err := db.Query(ctx, &dynamodb.QueryInput{
			TableName:              aws.String(c.EventsTableName),
			IndexName:              aws.String("SequenceIndex"),
			KeyConditionExpression: aws.String("sequenceId = :sid AND SK >= :since"),
			ExpressionAttributeValues: map[string]ddbtypes.AttributeValue{
				":sid":   &ddbtypes.AttributeValueMemberS{Value: sequenceId},
				":since": &ddbtypes.AttributeValueMemberS{Value: since},
			},
			ProjectionExpression: aws.String("eventType, #ts"),
			ExpressionAttributeNames: map[string]string{
				"#ts": "timestamp",
			},
			ExclusiveStartKey: lastKey,
		})
		if err != nil {
			return nil, err
		}
		for _, raw := range resp.Items {
			item := unmarshalItem(raw)
			ts, _ := item["timestamp"].(string)
			if len(ts) < 10 {
				continue
			}
			day := ts[:10]
			b := buckets[day]
			if b == nil {
				b = &DayCounts{Date: day}
				buckets[day] = b
			}
			switch item["eventType"] {
			case "delivery":
				b.Delivery++
			case "open":
				b.Open++
			case "click":
				b.Click++
			case "bounce":
				b.Bounce++
			case "complaint":
				b.Complaint++
			}
		}
		lastKey = resp.LastEvaluatedKey
		if lastKey == nil {
			break
		}
	}

	out := make([]DayCounts, 0, len(buckets))
	for _, b := range buckets {
		out = append(out, *b)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Date < out[j].Date })
	return out, nil
}

// GetSubscriber reads the full SUB#<email> partition: profile, executions,
// recent send log, suppression record.
func (s *DataService) GetSubscriber(c AwsCtx, email string) SubscriberDetail {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	out := SubscriberDetail{}
	db, err := s.ddb(ctx, c)
	if err != nil {
		out.Error = err.Error()
		return out
	}

	resp, err := db.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(c.TableName),
		KeyConditionExpression: aws.String("PK = :pk"),
		ExpressionAttributeValues: map[string]ddbtypes.AttributeValue{
			":pk": &ddbtypes.AttributeValueMemberS{Value: "SUB#" + email},
		},
		ScanIndexForward: aws.Bool(false),
		Limit:            aws.Int32(200),
	})
	if err != nil {
		out.Error = err.Error()
		return out
	}

	str := func(m map[string]any, k string) string {
		if v, ok := m[k].(string); ok {
			return v
		}
		return ""
	}
	for _, raw := range resp.Items {
		item := unmarshalItem(raw)
		sk := str(item, "SK")
		switch {
		case sk == "PROFILE":
			out.Found = true
			if j, err := json.Marshal(item); err == nil {
				out.ProfileJSON = string(j)
			}
		case strings.HasPrefix(sk, "EXEC#"):
			tx, _ := item["transactional"].(bool)
			out.Executions = append(out.Executions, ExecRow{
				SequenceID:    strings.TrimPrefix(sk, "EXEC#"),
				StartedAt:     str(item, "startedAt"),
				Transactional: tx,
			})
		case strings.HasPrefix(sk, "SENT#"):
			if len(out.SendLog) < 50 {
				out.SendLog = append(out.SendLog, SendRow{
					SentAt:      strings.TrimPrefix(sk, "SENT#"),
					TemplateKey: str(item, "templateKey"),
					SequenceID:  str(item, "sequenceId"),
					Subject:     str(item, "subject"),
				})
			}
		case sk == "SUPPRESSION":
			out.Suppression = str(item, "reason")
		}
	}
	return out
}

// SubscriberEvents returns a subscriber's engagement timeline (newest first).
func (s *DataService) SubscriberEvents(c AwsCtx, email string, limit int) ([]EventRow, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	db, err := s.ddb(ctx, c)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	resp, err := db.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(c.EventsTableName),
		KeyConditionExpression: aws.String("PK = :pk AND begins_with(SK, :pre)"),
		ExpressionAttributeValues: map[string]ddbtypes.AttributeValue{
			":pk":  &ddbtypes.AttributeValueMemberS{Value: "SUB#" + email},
			":pre": &ddbtypes.AttributeValueMemberS{Value: "EVT#"},
		},
		ScanIndexForward: aws.Bool(false),
		Limit:            aws.Int32(int32(limit)),
	})
	if err != nil {
		return nil, err
	}
	rows := make([]EventRow, 0, len(resp.Items))
	for _, item := range resp.Items {
		row := eventRowFromItem(unmarshalItem(item))
		row.Email = email
		rows = append(rows, row)
	}
	return rows, nil
}

// SequenceSubscribers lists who is currently in a sequence (inverted EXEC rows).
func (s *DataService) SequenceSubscribers(c AwsCtx, sequenceId string, limit int) ([]SeqSubscriberRow, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	db, err := s.ddb(ctx, c)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	resp, err := db.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(c.TableName),
		KeyConditionExpression: aws.String("PK = :pk"),
		ExpressionAttributeValues: map[string]ddbtypes.AttributeValue{
			":pk": &ddbtypes.AttributeValueMemberS{Value: "EXEC#" + sequenceId},
		},
		Limit: aws.Int32(int32(limit)),
	})
	if err != nil {
		return nil, err
	}
	rows := make([]SeqSubscriberRow, 0, len(resp.Items))
	for _, raw := range resp.Items {
		item := unmarshalItem(raw)
		email, _ := item["email"].(string)
		startedAt, _ := item["startedAt"].(string)
		tx, _ := item["transactional"].(bool)
		rows = append(rows, SeqSubscriberRow{Email: email, StartedAt: startedAt, Transactional: tx})
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].StartedAt > rows[j].StartedAt })
	return rows, nil
}

// SubscribersByTag lists subscribers via the TAG#<tag> inverted index.
func (s *DataService) SubscribersByTag(c AwsCtx, tag string, limit int) ([]TagRow, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	db, err := s.ddb(ctx, c)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	resp, err := db.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(c.TableName),
		KeyConditionExpression: aws.String("PK = :pk"),
		ExpressionAttributeValues: map[string]ddbtypes.AttributeValue{
			":pk": &ddbtypes.AttributeValueMemberS{Value: "TAG#" + tag},
		},
		Limit: aws.Int32(int32(limit)),
	})
	if err != nil {
		return nil, err
	}
	rows := make([]TagRow, 0, len(resp.Items))
	for _, raw := range resp.Items {
		item := unmarshalItem(raw)
		email, _ := item["email"].(string)
		taggedAt, _ := item["taggedAt"].(string)
		rows = append(rows, TagRow{Email: email, TaggedAt: taggedAt})
	}
	return rows, nil
}

// ListBroadcasts returns the broadcast log (newest first) merged with live
// counters from STATS#<broadcastId>/COUNTERS — same merge the MCP server does.
func (s *DataService) ListBroadcasts(c AwsCtx, limit int) ([]BroadcastRow, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	db, err := s.ddb(ctx, c)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 50 {
		limit = 25
	}
	resp, err := db.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(c.TableName),
		KeyConditionExpression: aws.String("PK = :pk"),
		ExpressionAttributeValues: map[string]ddbtypes.AttributeValue{
			":pk": &ddbtypes.AttributeValueMemberS{Value: "BROADCAST"},
		},
		ScanIndexForward: aws.Bool(false),
		Limit:            aws.Int32(int32(limit)),
	})
	if err != nil {
		return nil, err
	}

	rows := make([]BroadcastRow, 0, len(resp.Items))
	for _, raw := range resp.Items {
		item := unmarshalItem(raw)
		str := func(k string) string {
			if v, ok := item[k].(string); ok {
				return v
			}
			return ""
		}
		audience := 0
		if v, ok := item["audienceSize"].(float64); ok {
			audience = int(v)
		}
		fromEmail := ""
		if sender, ok := item["sender"].(map[string]any); ok {
			fromEmail, _ = sender["fromEmail"].(string)
		}
		rows = append(rows, BroadcastRow{
			BroadcastID:  str("broadcastId"),
			TemplateKey:  str("templateKey"),
			Subject:      str("subject"),
			FromEmail:    fromEmail,
			SentAt:       str("sentAt"),
			AudienceSize: audience,
		})
	}

	// Merge live counters (one GetItem per broadcast, concurrently).
	var wg sync.WaitGroup
	for i := range rows {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			stats, err := db.GetItem(ctx, &dynamodb.GetItemInput{
				TableName: aws.String(c.TableName),
				Key: map[string]ddbtypes.AttributeValue{
					"PK": &ddbtypes.AttributeValueMemberS{Value: "STATS#" + rows[i].BroadcastID},
					"SK": &ddbtypes.AttributeValueMemberS{Value: "COUNTERS"},
				},
			})
			if err == nil && stats.Item != nil {
				rows[i].Counters = countersFromItem(unmarshalItem(stats.Item))
			}
		}(i)
	}
	wg.Wait()
	return rows, nil
}

// FailedExecutions finds the stack's state machines via CloudFormation, then
// lists recent FAILED executions on each.
func (s *DataService) FailedExecutions(c AwsCtx, limit int) ([]FailedExec, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()
	cfg, err := loadAwsConfig(ctx, c.Profile, c.Region)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	cfn := cloudformation.NewFromConfig(cfg)
	var machines []string
	var nextToken *string
	for {
		resp, err := cfn.ListStackResources(ctx, &cloudformation.ListStackResourcesInput{
			StackName: aws.String(c.StackName),
			NextToken: nextToken,
		})
		if err != nil {
			return nil, err
		}
		for _, r := range resp.StackResourceSummaries {
			if aws.ToString(r.ResourceType) == "AWS::StepFunctions::StateMachine" {
				machines = append(machines, aws.ToString(r.PhysicalResourceId))
			}
		}
		nextToken = resp.NextToken
		if nextToken == nil {
			break
		}
	}

	sfnClient := sfn.NewFromConfig(cfg)
	var mu sync.Mutex
	var all []FailedExec
	var wg sync.WaitGroup
	for _, arn := range machines {
		wg.Add(1)
		go func(arn string) {
			defer wg.Done()
			resp, err := sfnClient.ListExecutions(ctx, &sfn.ListExecutionsInput{
				StateMachineArn: aws.String(arn),
				StatusFilter:    sfntypes.ExecutionStatusFailed,
				MaxResults:      int32(limit),
			})
			if err != nil {
				return
			}
			name := arn
			if idx := strings.LastIndex(arn, ":"); idx != -1 {
				name = arn[idx+1:]
			}
			mu.Lock()
			for _, e := range resp.Executions {
				fe := FailedExec{StateMachine: name, Name: aws.ToString(e.Name)}
				if e.StartDate != nil {
					fe.StartDate = e.StartDate.UTC().Format(time.RFC3339)
				}
				if e.StopDate != nil {
					fe.StopDate = e.StopDate.UTC().Format(time.RFC3339)
				}
				all = append(all, fe)
			}
			mu.Unlock()
		}(arn)
	}
	wg.Wait()

	sort.Slice(all, func(i, j int) bool { return all[i].StartDate > all[j].StartDate })
	if len(all) > limit {
		all = all[:limit]
	}
	return all, nil
}

// SesAccountHealth returns quota usage and sandbox status.
func (s *DataService) SesAccountHealth(c AwsCtx) SesHealth {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	out := SesHealth{}
	cfg, err := loadAwsConfig(ctx, c.Profile, c.Region)
	if err != nil {
		out.Error = err.Error()
		return out
	}
	resp, err := sesv2.NewFromConfig(cfg).GetAccount(ctx, &sesv2.GetAccountInput{})
	if err != nil {
		out.Error = err.Error()
		return out
	}
	out.SendingEnabled = resp.SendingEnabled
	out.ProductionAccess = resp.ProductionAccessEnabled
	if resp.SendQuota != nil {
		out.Max24HourSend = resp.SendQuota.Max24HourSend
		out.SentLast24Hours = resp.SendQuota.SentLast24Hours
		out.MaxSendRate = resp.SendQuota.MaxSendRate
	}
	return out
}
