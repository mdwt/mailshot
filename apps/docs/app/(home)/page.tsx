import Link from "next/link";
import { ArrowRight, Copy } from "lucide-react";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Comparison />
      <Costs />
      <SequenceCode />
      <Templates />
      <Workflow />
      <Architecture />
      <Principles />
      <MCPCatalog />
      <Features />
      <Packages />
      <ClosingCTA />
      <PageFooter />
    </main>
  );
}

/* ──────────────────────────────────────────────────────────── */
/* Install button — the one place orange shows at full saturation */

function Installer({ size = "default" }: { size?: "default" | "large" }) {
  const sizing = size === "large" ? "h-11 px-6 text-sm gap-3" : "h-10 px-5 text-sm gap-3";
  return (
    <button
      type="button"
      className={`group inline-flex items-center rounded-lg bg-ms-orange font-medium text-white hover:brightness-110 active:translate-y-px [transition:filter_var(--dur-short)_var(--ease-out),transform_100ms_var(--ease-out)] ${sizing}`}
    >
      <code className="font-mono whitespace-nowrap">npx create-mailshot</code>
      <Copy className="h-3.5 w-3.5 opacity-50 [transition:opacity_var(--dur-short)_var(--ease-out)] group-hover:opacity-80" />
    </button>
  );
}

/* ── Hero ────────────────────────────────────────────────────
   Title left, lede right with vertical rule (HP1). Type only.
   No comparison cards in fold; the table below carries the contrast. */

function Hero() {
  return (
    <section className="relative border-b border-fd-border/50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-overlay dark:opacity-[0.35]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />
      <div className="relative mx-auto w-full max-w-6xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="grid items-end gap-12 lg:grid-cols-[13fr_9fr]">
          <h1
            className="max-w-[16ch] font-semibold tracking-[-0.028em] text-balance text-fd-foreground"
            style={{
              fontSize: "clamp(2.5rem, 4.5vw + 1rem, 4.5rem)",
              lineHeight: 1.04,
            }}
          >
            Email infrastructure your AI agent operates.
          </h1>
          <div className="max-w-[44ch] lg:border-l lg:border-fd-border/40 lg:pl-8 lg:pb-2">
            <p className="text-base leading-relaxed text-fd-foreground/85 sm:text-lg sm:leading-[1.55]">
              No dashboard. A typed, code-first platform on AWS — Claude Code creates sequences,
              deploys them, queries engagement, suppresses bounces, previews against live
              subscribers. Your account, your data.
            </p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
              <Installer size="large" />
              <Link
                href="/docs"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-fd-foreground/70 underline-offset-4 [transition:color_var(--dur-short)_var(--ease-out)] hover:text-fd-foreground hover:underline"
              >
                Read the docs
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Comparison ──────────────────────────────────────────────
   Replaces the side-by-side "winner card" pattern with a dense
   typographic table. No rings, no shadows, no tints. */

function Comparison() {
  const rows = [
    {
      dimension: "Operator",
      saas: "Humans clicking around a UI",
      ours: "An agent calling typed MCP tools",
    },
    {
      dimension: "Configuration",
      saas: "Wizards, forms, drag-and-drop",
      ours: "TypeScript configs, version-controlled",
    },
    {
      dimension: "Where subscribers live",
      saas: "On the vendor’s servers",
      ours: "In your own DynamoDB",
    },
    {
      dimension: "Pricing",
      saas: "Per contact, per month, forever",
      ours: "Per AWS send — pennies",
    },
    {
      dimension: "Exit",
      saas: "Their schema, their export, their pace",
      ours: "Your repo. MIT licensed. Walk away anytime.",
    },
  ];
  return (
    <section className="border-b border-fd-border/50">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <div className="grid items-baseline gap-x-12 gap-y-8 lg:grid-cols-[1fr_2fr]">
          <h2
            className="font-semibold tracking-tight text-fd-foreground"
            style={{
              fontSize: "clamp(1.5rem, 2vw + 0.5rem, 2.25rem)",
              lineHeight: 1.12,
              maxWidth: "20ch",
            }}
          >
            What you’d buy from Mailchimp, but agent-native.
          </h2>

          <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[34rem]">
              <thead>
                <tr className="border-b border-fd-border/60 text-left font-mono text-[10.5px] uppercase tracking-widest text-fd-muted-foreground">
                  <th className="py-3 pr-6 font-medium"></th>
                  <th className="py-3 pr-6 font-medium">Dashboard SaaS</th>
                  <th className="py-3 font-medium text-fd-foreground">mailshot</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {rows.map((r) => (
                  <tr key={r.dimension} className="border-b border-fd-border/30 last:border-b-0">
                    <th
                      scope="row"
                      className="py-4 pr-6 text-left align-top font-medium text-fd-foreground"
                    >
                      {r.dimension}
                    </th>
                    <td className="py-4 pr-6 align-top text-fd-muted-foreground">{r.saas}</td>
                    <td className="py-4 align-top text-fd-foreground">{r.ours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-5 max-w-[60ch] text-xs leading-relaxed text-fd-muted-foreground">
              Mailchimp, Customer.io, Loops, and friends are good. They’re built for a different
              operator.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Costs ──────────────────────────────────────────────────
   Replaces 3-col cost cards with one prose block. Numbers in
   tabular-nums + foreground weight inside the sentence. */

function Costs() {
  return (
    <section className="border-b border-fd-border/50 bg-fd-muted/20">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <div className="grid items-baseline gap-12 lg:grid-cols-[1fr_2fr]">
          <h2
            className="max-w-[18ch] font-semibold tracking-tight text-fd-foreground"
            style={{
              fontSize: "clamp(1.5rem, 2vw + 0.5rem, 2.25rem)",
              lineHeight: 1.12,
            }}
          >
            Pennies per execution. No fixed cost.
          </h2>

          <div className="max-w-[62ch] space-y-5 leading-relaxed text-fd-foreground/85">
            <p>
              mailshot is MIT-licensed and runs on your own AWS account. There is nothing to pay the
              framework for, ever.
            </p>
            <p>
              A 5-email sequence costs{" "}
              <span className="font-medium tabular-nums text-fd-foreground">~$0.30</span> per 1,000
              runs in Step Functions, plus{" "}
              <span className="font-medium tabular-nums text-fd-foreground">~$0.50</span> in SES
              sends. At 10,000 subscribers you’re looking at{" "}
              <span className="font-medium tabular-nums text-fd-foreground">under $10/month</span>{" "}
              total AWS bill.
            </p>
            <p className="text-fd-muted-foreground">
              You pay AWS for state transitions, email sends, and DynamoDB reads. Nothing runs
              between emails. Nothing accrues when you sleep.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Sequence as code ───────────────────────────────────────
   Workbench centerpiece. Narrative left (sticky), code right.
   Code block uses typographic frame, not fake window chrome. */

function SequenceCode() {
  return (
    <section className="border-b border-fd-border/50">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div className="lg:sticky lg:top-24">
            <h2
              className="max-w-[18ch] font-semibold tracking-tight text-fd-foreground"
              style={{
                fontSize: "clamp(1.75rem, 2.4vw + 0.5rem, 2.75rem)",
                lineHeight: 1.08,
              }}
            >
              Sequences are TypeScript. CDK deploys them.
            </h2>
            <p className="mt-6 max-w-[44ch] leading-relaxed text-fd-foreground/85">
              Triggers, steps, delays, conditional branches — everything lives in{" "}
              <code className="rounded border border-fd-border bg-fd-muted/60 px-1.5 py-0.5 font-mono text-[0.825em]">
                sequences/
              </code>
              . CDK auto-discovers each file and ships it as a Step Functions state machine.
            </p>
            <p className="mt-4 max-w-[44ch] leading-relaxed text-fd-muted-foreground">
              Write the config by hand, or hand it to Claude Code. Either way it’s code you own and
              review before deploy.
            </p>
            <Link
              href="/docs/sequences"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-fd-foreground underline-offset-4 hover:underline"
            >
              Sequence reference <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-hidden rounded-lg border border-fd-border bg-fd-card">
            <div className="flex items-center justify-between border-b border-fd-border/60 px-4 py-2.5">
              <span className="font-mono text-xs text-fd-muted-foreground">
                sequences/welcome/sequence.config.ts
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-fd-muted-foreground/60">
                TypeScript
              </span>
            </div>
            <pre className="overflow-x-auto p-5 text-[12.5px] leading-[1.75]">
              <code>
                <span className="text-fd-muted-foreground">
                  {'import type { SequenceDefinition }\n  from "@mailshot/shared";\n\n'}
                </span>
                <span>{"export default {\n"}</span>
                <span>{"  id: "}</span>
                <span className="text-ms-blue">{'"welcome"'}</span>
                <span>{",\n"}</span>
                <span>{"  trigger: {\n"}</span>
                <span>{"    detailType: "}</span>
                <span className="text-ms-blue">{'"customer.created"'}</span>
                <span>{",\n"}</span>
                <span className="text-fd-muted-foreground">
                  {
                    '    subscriberMapping: {\n      email: "$.detail.email",\n      firstName: "$.detail.firstName",\n    },\n'
                  }
                </span>
                <span>{"  },\n"}</span>
                <span>{"  steps: [\n"}</span>
                <span>{"    { type: "}</span>
                <span className="text-ms-blue">{'"send"'}</span>
                <span>{",\n      templateKey: "}</span>
                <span className="text-ms-blue">{'"welcome/hello"'}</span>
                <span>{",\n      subject: "}</span>
                <span className="text-ms-blue">{'"Welcome aboard"'}</span>
                <span>{" },\n"}</span>
                <span>{"    { type: "}</span>
                <span className="text-ms-blue">{'"wait"'}</span>
                <span>{", days: 2 },\n"}</span>
                <span>{"    { type: "}</span>
                <span className="text-ms-blue">{'"send"'}</span>
                <span>{", ... },\n"}</span>
                <span>{"    { type: "}</span>
                <span className="text-ms-blue">{'"choice"'}</span>
                <span>{",\n      field: "}</span>
                <span className="text-ms-blue">{'"$.subscriber.attributes.plan"'}</span>
                <span>{",\n      branches: [\n"}</span>
                <span>{"        { value: "}</span>
                <span className="text-ms-blue">{'"pro"'}</span>
                <span>{", steps: [...] },\n"}</span>
                <span>{"        { value: "}</span>
                <span className="text-ms-blue">{'"free"'}</span>
                <span>{", steps: [...] },\n"}</span>
                <span>{"      ],\n"}</span>
                <span>{"    },\n"}</span>
                <span>{"  ],\n"}</span>
                <span>{"} "}</span>
                <span className="text-fd-muted-foreground">{"satisfies SequenceDefinition;"}</span>
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Templates ──────────────────────────────────────────────
   Inline typographic list instead of 6-tile grid. */

function Templates() {
  const tools = [
    "React Email",
    "MJML",
    "Raw HTML",
    "Claude · ChatGPT · any LLM",
    "Figma → HTML",
    "Your existing templates",
  ];
  return (
    <section className="border-b border-fd-border/50 bg-fd-muted/20">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <div className="grid items-baseline gap-12 lg:grid-cols-[1fr_2fr]">
          <h2
            className="max-w-[18ch] font-semibold tracking-tight text-fd-foreground"
            style={{
              fontSize: "clamp(1.5rem, 2vw + 0.5rem, 2.25rem)",
              lineHeight: 1.12,
            }}
          >
            Bring whatever HTML you already make.
          </h2>

          <div className="max-w-[62ch]">
            <p className="leading-relaxed text-fd-foreground/85">
              mailshot is an orchestration framework. It doesn’t care how you author the HTML — only
              that there’s an{" "}
              <code className="rounded border border-fd-border bg-fd-muted/60 px-1.5 py-0.5 font-mono text-[0.825em]">
                .html
              </code>{" "}
              file at the end. At send time it injects subscriber data via LiquidJS{" "}
              <code className="rounded border border-fd-border bg-fd-muted/60 px-1.5 py-0.5 font-mono text-[0.825em]">
                {"{{ firstName }}"}
              </code>{" "}
              variables. That’s the only contract.
            </p>
            <p className="mt-7 font-mono text-[10.5px] uppercase tracking-widest text-fd-muted-foreground">
              Known to work with
            </p>
            <ul className="mt-2 flex flex-wrap items-baseline gap-x-1 gap-y-2 text-fd-foreground/90">
              {tools.map((t, i) => (
                <li key={t} className="flex items-baseline">
                  <span className="text-fd-foreground">{t}</span>
                  {i < tools.length - 1 && (
                    <span aria-hidden className="mx-3 text-fd-border">
                      ·
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <Link
              href="/docs/templates"
              className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-fd-foreground underline-offset-4 hover:underline"
            >
              Template docs <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Workflow ───────────────────────────────────────────────
   Narrative numbered steps with hairline rules between rows.
   No 4-col equal-card grid. */

function Workflow() {
  const steps = [
    {
      n: "1",
      title: "Scaffold",
      command: "npx create-mailshot my-project",
      text: "A monorepo with CDK, shared types, handlers, and an MCP server wired to your AWS account.",
    },
    {
      n: "2",
      title: "Create sequences",
      command: "sequences/welcome/sequence.config.ts",
      text: "Write the config by hand, or describe what you want to Claude Code. Drop your HTML templates in next to it — any tool, any format.",
    },
    {
      n: "3",
      title: "Deploy",
      command: "/deploy",
      text: "Validates types, checks template references, synthesizes CDK, and ships Step Functions + EventBridge + S3 templates in one go.",
    },
    {
      n: "4",
      title: "Operate",
      command: 'mcp: "What are open rates on onboarding?"',
      text: "Twenty-three MCP tools let Claude Code query engagement, suppress bounces, preview templates, debug deliveries — all from inside your editor.",
    },
  ];
  return (
    <section className="border-b border-fd-border/50">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <h2
          className="max-w-[20ch] font-semibold tracking-tight text-fd-foreground"
          style={{
            fontSize: "clamp(1.75rem, 2.4vw + 0.5rem, 2.75rem)",
            lineHeight: 1.08,
          }}
        >
          From zero to live in four moves.
        </h2>

        <ol className="mt-14 divide-y divide-fd-border/40">
          {steps.map((s) => (
            <li
              key={s.n}
              className="grid gap-x-12 gap-y-3 py-8 first:pt-0 lg:grid-cols-[auto_1fr_1.6fr] lg:items-baseline"
            >
              <span className="font-mono text-[1.75rem] font-semibold tabular-nums leading-none text-ms-orange/85 lg:w-10">
                {s.n}
              </span>
              <div>
                <h3 className="text-lg font-semibold text-fd-foreground">{s.title}</h3>
                <code className="mt-1 block break-all font-mono text-xs text-fd-muted-foreground">
                  {s.command}
                </code>
              </div>
              <p className="max-w-[58ch] leading-relaxed text-fd-foreground/85">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Architecture ───────────────────────────────────────────
   ASCII diagram kept — it's already type-led and strong. Narrative
   moves to a sticky left column. */

function Architecture() {
  return (
    <section className="border-b border-fd-border/50 bg-fd-muted/20">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_2fr]">
          <div className="lg:sticky lg:top-24">
            <h2
              className="max-w-[16ch] font-semibold tracking-tight text-fd-foreground"
              style={{
                fontSize: "clamp(1.5rem, 2vw + 0.5rem, 2.25rem)",
                lineHeight: 1.12,
              }}
            >
              Data flow
            </h2>
            <p className="mt-6 max-w-[44ch] leading-relaxed text-fd-foreground/85">
              Your app publishes events to EventBridge. Rules route to Step Functions for sequences
              or Lambda for one-off sends. SES delivers, then ships engagement back into DynamoDB.
            </p>
            <Link
              href="/docs/architecture"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-fd-foreground underline-offset-4 hover:underline"
            >
              Architecture reference <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto rounded-lg border border-fd-border bg-fd-card">
            <pre className="p-6 font-mono text-[11.5px] leading-[1.6] sm:text-[12.5px]">{`┌──────────────────────────────────┐
│ Your App Backend                 │
│ publishes events to EventBridge  │
└───────────────┬──────────────────┘
                │
                ▼
┌──────────────────────────────────┐
│ EventBridge (Custom Bus)         │
│                                  │
│ Sequence rules ──→ Step Functions│
│ Event rules ────→ SendEmailFn    │
└───────┬──────────────────┬───────┘
        │                  │
        ▼                  ▼
 Step Functions        SendEmailFn (fire-and-forget)
   │                       │
   ├─ register ────────────┤
   ├─ send (per step) ─────┤
   ├─ wait                  │
   ├─ choice (branch)       │
   ├─ condition ───→ CheckConditionFn
   ├─ complete ────────────┤
   │                       │
   └───────────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
   DynamoDB           S3 Templates
   (state)            (HTML + Liquid)
        │
        ▼
       SES ──→ Recipient
        │
        ├─ Bounce/Complaint ──→ SNS ──→ BounceHandlerFn
        │                                  └─ suppress subscriber
        │                                  └─ stop executions
        │
        ├─ Engagement ────────→ SNS ──→ EngagementHandlerFn
        │  (open/click/delivery)           └─ write to Events table
        │
        └─ Unsubscribe link ──→ UnsubscribeFn (Function URL)
                                   └─ mark unsubscribed
                                   └─ stop executions`}</pre>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Principles ─────────────────────────────────────────────
   3 columns, but differentiated by hairline rules above each
   heading — no leading-zero badges, no cards. */

function Principles() {
  const items = [
    {
      title: "Typed schemas, not screen reads.",
      body: "Sequences are typed configs. Templates are HTML with named Liquid variables. Subscribers are DynamoDB rows with typed attributes. An agent introspects every shape, validates it before sending, and emits code that compiles — no scraping, no guessing.",
    },
    {
      title: "One MCP, full surface area.",
      body: "Twenty-three MCP tools cover the entire control plane — subscribers, engagement, templates, suppression, sequences, broadcasts, health. No screen scrapes. No API-key juggling. A typed function in, a typed response out.",
    },
    {
      title: "Code is the source of truth.",
      body: "Sequences live in your repo. CDK auto-discovers them. Changes ship through git, not Save buttons. Your agent writes the diff and runs typecheck; you keep the final review.",
    },
  ];
  return (
    <section className="border-b border-fd-border/50">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-[58ch]">
          <h2
            className="font-semibold tracking-tight text-fd-foreground"
            style={{
              fontSize: "clamp(1.75rem, 2.4vw + 0.5rem, 2.75rem)",
              lineHeight: 1.08,
            }}
          >
            The operator is an agent with no UI to reach for.
          </h2>
          <p className="mt-6 leading-relaxed text-fd-foreground/80">
            Traditional email tools assume a human at a dashboard, clicking through wizards and
            copy-pasting between tabs. mailshot assumes the opposite. Three things follow.
          </p>
        </div>

        <div className="mt-14 grid gap-x-12 gap-y-10 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.title}>
              <h3 className="border-t border-fd-border/60 pt-4 text-base font-semibold text-fd-foreground">
                {it.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-fd-foreground/75">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── MCP catalog ────────────────────────────────────────────
   Real tool names, grouped, man-page style. 23 actual tools.
   The one section that keeps an eyebrow ("MCP server") because
   it names an external system the reader may not recognise. */

function MCPCatalog() {
  const groups = [
    {
      title: "Subscribers",
      tools: [
        { name: "get_subscriber", desc: "Fetch a profile with attributes and history" },
        { name: "list_subscribers", desc: "Filter by tags, attributes, suppression status" },
        { name: "update_subscriber", desc: "Patch attributes, tags, contact details" },
        { name: "delete_subscriber", desc: "Remove a subscriber and stop active sequences" },
        { name: "unsubscribe_subscriber", desc: "Mark unsubscribed and stop sequences" },
        { name: "resubscribe_subscriber", desc: "Re-engage a previously unsubscribed contact" },
      ],
    },
    {
      title: "Engagement",
      tools: [
        { name: "get_subscriber_events", desc: "Opens, clicks, bounces per address" },
        { name: "get_template_events", desc: "Rolled up per template — handy for A/B variants" },
        { name: "get_sequence_events", desc: "Rolled up per sequence or broadcast" },
      ],
    },
    {
      title: "Templates",
      tools: [
        { name: "list_templates", desc: "Everything in your S3 template bucket" },
        { name: "preview_template", desc: "Render against a live subscriber" },
        { name: "validate_template", desc: "Check Liquid syntax and variable shape" },
      ],
    },
    {
      title: "Sequences",
      tools: [
        { name: "list_sequences", desc: "All deployed sequences with active counts" },
        { name: "list_sequence_subscribers", desc: "Who is currently inside a given sequence" },
        { name: "export_sequence", desc: "Reconstruct a deployed sequence as local code" },
      ],
    },
    {
      title: "Broadcasts",
      tools: [
        { name: "send_broadcast", desc: "One-off send filtered by tags or attributes" },
        { name: "get_broadcast", desc: "Audience size + live engagement counters" },
        { name: "list_broadcasts", desc: "History of broadcasts, newest first" },
      ],
    },
    {
      title: "Suppression",
      tools: [
        { name: "list_suppressed", desc: "All suppressed addresses with the reason" },
        { name: "remove_suppression", desc: "Lift a hard-bounce or complaint flag" },
      ],
    },
    {
      title: "System",
      tools: [
        { name: "get_failed_executions", desc: "Recent Step Functions runs that failed" },
        { name: "get_delivery_stats", desc: "SES bounce + complaint rates over time" },
      ],
    },
    {
      title: "Skills",
      tools: [{ name: "sync_skills", desc: "Refresh the local Claude Code skill set" }],
    },
  ];

  const total = groups.reduce((n, g) => n + g.tools.length, 0);

  return (
    <section className="border-b border-fd-border/50 bg-fd-muted/20">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_2fr]">
          <div className="lg:sticky lg:top-24">
            <p className="font-mono text-[10.5px] uppercase tracking-widest text-ms-orange">
              MCP server
            </p>
            <h2
              className="mt-3 max-w-[20ch] font-semibold tracking-tight text-fd-foreground"
              style={{
                fontSize: "clamp(1.75rem, 2.4vw + 0.5rem, 2.75rem)",
                lineHeight: 1.08,
              }}
            >
              {total} tools. One command to wire.
            </h2>
            <code className="mt-6 block rounded-md border border-fd-border bg-fd-card px-3 py-2.5 font-mono text-xs text-fd-foreground">
              claude mcp add mailshot -- npx @mailshot/mcp
            </code>
            <p className="mt-6 max-w-[44ch] text-sm leading-relaxed text-fd-foreground/80">
              The MCP server connects Claude Code to your live AWS resources. Subscribers,
              engagement, templates, sequences, broadcasts, health — typed in, typed out.
            </p>
            <Link
              href="/docs/mcp-server"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-fd-foreground underline-offset-4 hover:underline"
            >
              Full tool reference <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-9">
            {groups.map((g) => (
              <div key={g.title}>
                <h3 className="mb-3 border-b border-fd-border/40 pb-2 font-mono text-[10.5px] uppercase tracking-widest text-fd-muted-foreground">
                  {g.title}
                </h3>
                <ul className="space-y-2.5">
                  {g.tools.map((t) => (
                    <li
                      key={t.name}
                      className="grid items-baseline gap-x-6 gap-y-1 sm:grid-cols-[22ch_1fr]"
                    >
                      <code className="font-mono text-[13px] text-fd-foreground">{t.name}</code>
                      <span className="text-sm leading-relaxed text-fd-muted-foreground">
                        {t.desc}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Features ───────────────────────────────────────────────
   Typographic list, asymmetric two columns, hairline above each
   item. No icon-tile cards. */

function Features() {
  const features = [
    {
      title: "Full SES integration",
      text: "Delivery tracking, open/click events, bounce handling, List-Unsubscribe headers, HMAC-signed unsubscribe URLs.",
    },
    {
      title: "Conditional branching",
      text: "Choice steps branch on subscriber attributes. Condition steps query DynamoDB at runtime for send history and profile changes.",
    },
    {
      title: "Automatic suppression",
      text: "Bounces and complaints suppress subscribers and stop all active Step Functions executions. No manual intervention.",
    },
    {
      title: "Serverless, pay-per-use",
      text: "Step Functions, Lambda, EventBridge, DynamoDB, S3. Pay-per-execution on your own AWS account. No fixed cost.",
    },
    {
      title: "Single-table DynamoDB",
      text: "Subscribers, executions, send logs, suppression — one table. Engagement events in a second. No relational database.",
    },
    {
      title: "Bring your own templates",
      text: "React Email, MJML, hand-coded, Figma exports, AI-generated. mailshot just renders variables with LiquidJS at send time.",
    },
  ];

  return (
    <section className="border-b border-fd-border/50">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <h2
          className="max-w-[24ch] font-semibold tracking-tight text-fd-foreground"
          style={{
            fontSize: "clamp(1.5rem, 2vw + 0.5rem, 2.25rem)",
            lineHeight: 1.12,
          }}
        >
          Production-ready out of the box.
        </h2>

        <ul className="mt-12 grid gap-x-12 gap-y-8 lg:grid-cols-2">
          {features.map((f) => (
            <li key={f.title} className="grid items-baseline gap-x-6 sm:grid-cols-[1.2fr_2fr]">
              <h3 className="border-t border-fd-border/60 pt-3 text-base font-semibold text-fd-foreground">
                {f.title}
              </h3>
              <p className="pt-3 text-sm leading-relaxed text-fd-foreground/75 sm:border-t sm:border-fd-border/30">
                {f.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Packages ───────────────────────────────────────────────
   Typographic colophon. Kept the dot-leader pattern but without
   the y-translate fudge. */

function Packages() {
  const pkgs = [
    { name: "@mailshot/shared", desc: "Types, constants, DynamoDB key helpers" },
    { name: "@mailshot/handlers", desc: "Five Lambda handlers + shared lib" },
    { name: "@mailshot/cdk", desc: "CDK infrastructure, modular constructs" },
    { name: "@mailshot/mcp", desc: "MCP server for Claude Code" },
    { name: "@mailshot/skills", desc: "Claude Code skills shipped to user projects" },
    { name: "create-mailshot", desc: "CLI scaffolder" },
  ];

  return (
    <section className="border-b border-fd-border/50 bg-fd-muted/20">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <div className="grid items-baseline gap-12 lg:grid-cols-[1fr_2fr]">
          <h2
            className="max-w-[14ch] font-semibold tracking-tight text-fd-foreground"
            style={{
              fontSize: "clamp(1.5rem, 2vw + 0.5rem, 2.25rem)",
              lineHeight: 1.12,
            }}
          >
            Published on npm.
          </h2>

          <ul className="divide-y divide-fd-border/40">
            {pkgs.map((p) => (
              <li key={p.name} className="flex items-baseline gap-4 py-3">
                <code className="shrink-0 font-mono text-sm font-semibold text-fd-foreground">
                  {p.name}
                </code>
                <span aria-hidden className="hidden h-px flex-1 bg-fd-border/40 sm:block" />
                <span className="text-sm text-fd-muted-foreground">{p.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── Closing CTA ────────────────────────────────────────────
   Left-biased, one CTA, no duplicate install + no centred farewell. */

function ClosingCTA() {
  return (
    <section className="border-b border-fd-border/50">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <div className="grid items-end gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="max-w-[26ch]">
            <h2
              className="font-semibold tracking-tight text-fd-foreground"
              style={{
                fontSize: "clamp(1.75rem, 2.4vw + 0.5rem, 2.75rem)",
                lineHeight: 1.06,
              }}
            >
              Hand the email stack to your agent.
            </h2>
            <p className="mt-5 max-w-[44ch] leading-relaxed text-fd-foreground/80">
              Scaffold the project, describe a sequence to Claude Code, deploy. From zero to a live
              sequence on your own AWS account in an afternoon.
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center lg:justify-end">
            <Installer size="large" />
            <Link
              href="/docs/quickstart"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-fd-foreground/70 underline-offset-4 [transition:color_var(--dur-short)_var(--ease-out)] hover:text-fd-foreground hover:underline"
            >
              Quickstart
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Footer (Ft2 inline) ────────────────────────────────────
   Wordmark · MIT line · credit. Single row, hairline above. */

function PageFooter() {
  return (
    <footer className="py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-6 text-xs text-fd-muted-foreground sm:flex-row sm:items-center">
        <p className="font-mono text-fd-foreground">mailshot</p>
        <p>MIT licensed · free forever</p>
        <p>
          Built by{" "}
          <a
            href="https://github.com/mdwt"
            className="font-medium text-fd-foreground underline-offset-4 hover:underline"
          >
            @mdwt
          </a>
        </p>
      </div>
    </footer>
  );
}
