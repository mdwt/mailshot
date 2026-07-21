package main

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cloudformation"
	"github.com/aws/aws-sdk-go-v2/service/sts"
)

// Phase 1 is read-only: STS caller identity for the status bar and
// CloudFormation stack status for the dashboard. Errors are embedded in the
// DTOs (not returned) so the UI renders them as state instead of failing.

type CallerIdentity struct {
	Account string `json:"account"`
	Arn     string `json:"arn"`
	UserID  string `json:"userId"`
	Region  string `json:"region"`
	Profile string `json:"profile"`
	Error   string `json:"error"`
}

type StackOutput struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type StackInfo struct {
	Name        string        `json:"name"`
	Status      string        `json:"status"`
	LastUpdated string        `json:"lastUpdated"`
	Outputs     []StackOutput `json:"outputs"`
	Error       string        `json:"error"`
}

type AwsService struct{}

func NewAwsService() *AwsService {
	return &AwsService{}
}

func loadAwsConfig(ctx context.Context, profile, region string) (aws.Config, error) {
	opts := []func(*config.LoadOptions) error{}
	if region != "" {
		opts = append(opts, config.WithRegion(region))
	}
	if profile != "" {
		opts = append(opts, config.WithSharedConfigProfile(profile))
	}
	return config.LoadDefaultConfig(ctx, opts...)
}

func (s *AwsService) Whoami(profile, region string) CallerIdentity {
	out := CallerIdentity{Profile: profile, Region: region}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cfg, err := loadAwsConfig(ctx, profile, region)
	if err != nil {
		out.Error = err.Error()
		return out
	}
	if out.Region == "" {
		out.Region = cfg.Region
	}
	resp, err := sts.NewFromConfig(cfg).GetCallerIdentity(ctx, &sts.GetCallerIdentityInput{})
	if err != nil {
		out.Error = err.Error()
		return out
	}
	out.Account = aws.ToString(resp.Account)
	out.Arn = aws.ToString(resp.Arn)
	out.UserID = aws.ToString(resp.UserId)
	return out
}

func (s *AwsService) StackStatus(profile, region, stackName string) StackInfo {
	out := StackInfo{Name: stackName}
	if stackName == "" {
		out.Error = "STACK_NAME is not set in .env"
		return out
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	cfg, err := loadAwsConfig(ctx, profile, region)
	if err != nil {
		out.Error = err.Error()
		return out
	}
	resp, err := cloudformation.NewFromConfig(cfg).DescribeStacks(ctx, &cloudformation.DescribeStacksInput{
		StackName: aws.String(stackName),
	})
	if err != nil {
		out.Error = err.Error()
		return out
	}
	if len(resp.Stacks) == 0 {
		out.Error = "stack not found"
		return out
	}
	stack := resp.Stacks[0]
	out.Status = string(stack.StackStatus)
	when := stack.CreationTime
	if stack.LastUpdatedTime != nil {
		when = stack.LastUpdatedTime
	}
	if when != nil {
		out.LastUpdated = when.UTC().Format(time.RFC3339)
	}
	for _, o := range stack.Outputs {
		out.Outputs = append(out.Outputs, StackOutput{
			Key:   aws.ToString(o.OutputKey),
			Value: aws.ToString(o.OutputValue),
		})
	}
	return out
}
