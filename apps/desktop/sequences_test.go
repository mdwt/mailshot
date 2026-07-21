package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

const fixtureConfig = `
import type { SequenceDefinition } from "@mailshot/shared";

const id = "onboarding";

export default {
  id,
  transactional: true,
  sender: {
    fromEmail: "amy@acme.dev",
    fromName: "Amy at Acme",
    replyToEmail: "amy@acme.dev",
  },
  trigger: {
    detailType: "customer.created",
    subscriberMapping: {
      email: "$.detail.email",
      firstName: "$.detail.firstName",
      attributes: "$.detail",
    },
  },
  timeoutMinutes: 60 * 24 * 14,
  steps: [
    { type: "send", templateKey: ` + "`${id}/welcome`" + `, subject: "Welcome!" },
    { type: "wait", days: 2 },
    {
      type: "choice",
      field: "$.subscriber.attributes.platform",
      branches: [
        {
          value: "shopify",
          steps: [{ type: "send", templateKey: ` + "`${id}/shopify-setup`" + `, subject: "Connect Shopify" }],
        },
      ],
      default: [{ type: "send", templateKey: ` + "`${id}/woo-setup`" + `, subject: "Connect WooCommerce" }],
    },
    {
      type: "send",
      variants: [
        { templateKey: ` + "`${id}/day-3-a`" + `, subject: "3 tips" },
        { templateKey: ` + "`${id}/day-3-b`" + `, subject: "Your playbook" },
      ],
    },
  ],
  events: [
    { detailType: "sale.first", templateKey: ` + "`${id}/congrats`" + `, subject: "First sale!" },
  ],
} satisfies SequenceDefinition;
`

func writeFixture(t *testing.T, contents string) string {
	t.Helper()
	dir := t.TempDir()
	seqDir := filepath.Join(dir, "sequences", "onboarding")
	if err := os.MkdirAll(seqDir, 0o755); err != nil {
		t.Fatal(err)
	}
	configPath := filepath.Join(seqDir, "sequence.config.ts")
	if err := os.WriteFile(configPath, []byte(contents), 0o644); err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestEvaluateSequenceConfig(t *testing.T) {
	projectDir := writeFixture(t, fixtureConfig)
	configPath := filepath.Join(projectDir, "sequences", "onboarding", "sequence.config.ts")

	defJSON, id, err := evaluateSequenceConfig(configPath)
	if err != nil {
		t.Fatalf("evaluate failed: %v", err)
	}
	if id != "onboarding" {
		t.Errorf("id = %q, want onboarding", id)
	}

	var def map[string]any
	if err := json.Unmarshal([]byte(defJSON), &def); err != nil {
		t.Fatalf("definition is not valid JSON: %v", err)
	}
	if def["transactional"] != true {
		t.Errorf("transactional not preserved")
	}
	if def["timeoutMinutes"] != float64(60*24*14) {
		t.Errorf("timeoutMinutes = %v, want %d (computed expressions must evaluate)", def["timeoutMinutes"], 60*24*14)
	}
	steps, ok := def["steps"].([]any)
	if !ok || len(steps) != 4 {
		t.Fatalf("steps = %v, want 4 steps", def["steps"])
	}
	first := steps[0].(map[string]any)
	if first["templateKey"] != "onboarding/welcome" {
		t.Errorf("template literal not interpolated: %v", first["templateKey"])
	}
	variants := steps[3].(map[string]any)["variants"].([]any)
	if len(variants) != 2 {
		t.Errorf("variants not preserved: %v", steps[3])
	}
}

func TestEvaluateSequenceConfigErrors(t *testing.T) {
	projectDir := writeFixture(t, `export default { name: "no-id" };`)
	configPath := filepath.Join(projectDir, "sequences", "onboarding", "sequence.config.ts")
	if _, _, err := evaluateSequenceConfig(configPath); err == nil {
		t.Error("expected error for config without id")
	}

	projectDir2 := writeFixture(t, `const x: number = "broken"; export default`)
	configPath2 := filepath.Join(projectDir2, "sequences", "onboarding", "sequence.config.ts")
	if _, _, err := evaluateSequenceConfig(configPath2); err == nil {
		t.Error("expected error for syntactically broken config")
	}
}

func TestListSequences(t *testing.T) {
	projectDir := writeFixture(t, fixtureConfig)
	// A second, broken sequence must not hide the first.
	brokenDir := filepath.Join(projectDir, "sequences", "broken")
	if err := os.MkdirAll(brokenDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(brokenDir, "sequence.config.ts"), []byte("export default require('fs');"), 0o644); err != nil {
		t.Fatal(err)
	}

	svc := NewSequenceService()
	entries, err := svc.ListSequences(projectDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Fatalf("got %d entries, want 2", len(entries))
	}
	if entries[0].Dir != "broken" || entries[0].Error == "" {
		t.Errorf("broken sequence should carry an error: %+v", entries[0])
	}
	if entries[1].ID != "onboarding" || entries[1].Error != "" {
		t.Errorf("good sequence should evaluate: %+v", entries[1])
	}
}
