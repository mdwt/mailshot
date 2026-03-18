import Link from "next/link";
import { ArrowRight, ChevronRight, Copy } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex flex-col gap-16 sm:gap-20 md:gap-32">
      <Hero />
      <Workflow />
      <SequenceCode />
      <Features />
      <MCPTools />
      <Architecture />
      <Packages />
      <CTA />
      <Footer />
    </main>
  );
}

/* ── Hero ────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 pt-24 md:pt-36">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-fd-muted/60 px-4 py-1.5 text-sm text-fd-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
          Open source &middot; MIT licensed
        </div>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Email sequences on AWS,{" "}
          <span className="text-fd-muted-foreground">managed through AI</span>
        </h1>
        <p className="max-w-2xl text-balance text-fd-muted-foreground sm:text-lg">
          mailshot is an open-source framework that puts email sequencing, subscriber management,
          engagement analytics, and deployment inside Claude Code. Describe what you want, AI
          handles the rest.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Installer />
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-fd-muted-foreground underline-offset-4 hover:underline"
          >
            Documentation
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <Terminal />
      </div>
    </section>
  );
}

function Installer() {
  return (
    <button
      type="button"
      className="group inline-flex h-10 items-center gap-3 rounded-full bg-fd-primary px-5 text-sm font-medium text-fd-primary-foreground transition-all active:translate-y-px"
    >
      <code>npx create-mailshot</code>
      <Copy className="h-3.5 w-3.5 opacity-50 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function Terminal() {
  return (
    <div className="w-full max-w-xl overflow-hidden rounded-xl bg-fd-card shadow-lg ring-1 ring-fd-border">
      <div className="flex items-center gap-2 bg-fd-muted/40 px-4 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-fd-muted-foreground/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-fd-muted-foreground/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-fd-muted-foreground/20" />
      </div>
      <div className="p-5 font-mono text-[13px] leading-relaxed text-left">
        <Line prompt>npx create-mailshot my-project</Line>
        <Line prompt>cd my-project &amp;&amp; claude</Line>
        <Line dim>
          &gt; &ldquo;Create a 5-part onboarding sequence triggered by customer.created&rdquo;
        </Line>
        <Line green>✓ Generated sequence config, 5 templates, deploy files</Line>
        <Line dim>&gt; &ldquo;Deploy&rdquo;</Line>
        <Line green>✓ Deployed to AWS (us-east-1)</Line>
      </div>
    </div>
  );
}

function Line({
  children,
  prompt,
  dim,
  green,
}: {
  children: React.ReactNode;
  prompt?: boolean;
  dim?: boolean;
  green?: boolean;
}) {
  return (
    <p
      className={
        green ? "text-green-600 dark:text-green-400" : dim ? "text-fd-muted-foreground" : ""
      }
    >
      {prompt && <span className="text-fd-muted-foreground">$ </span>}
      {children}
    </p>
  );
}

/* ── Workflow ─────────────────────────────────────────────── */

function Workflow() {
  return (
    <section className="mx-auto w-full max-w-4xl px-6">
      <SectionHeader
        label="AI-native workflow"
        title="The whole lifecycle lives in Claude Code"
        description="Generate email content, design sequences, deploy infrastructure, query engagement metrics, optimize performance. mailshot ships with an MCP server and Claude Code skills that give AI full access to your running system."
      />
      <div className="mt-12 space-y-2">
        <WorkflowStep
          prompt="Create a 3-part re-engagement sequence for users inactive for 30 days"
          result="Generates TypeScript sequence config, 3 email templates with LiquidJS placeholders, and render script"
        />
        <WorkflowStep
          prompt="Preview the day-3 email for jane@acme.com"
          result="Fetches subscriber profile from DynamoDB, renders template with live data"
        />
        <WorkflowStep
          prompt="Deploy"
          result="Validates types, checks template references, synthesizes CDK, deploys to AWS"
        />
        <WorkflowStep
          prompt="How are open rates on the re-engagement sequence?"
          result="Queries engagement table — 68% delivered, 42% opened, 12% clicked across 340 sends"
        />
      </div>
    </section>
  );
}

function WorkflowStep({ prompt, result }: { prompt: string; result: string }) {
  return (
    <div className="rounded-xl bg-fd-muted/40 p-5">
      <p className="text-sm font-medium">&ldquo;{prompt}&rdquo;</p>
      <p className="mt-1.5 text-sm text-fd-muted-foreground">{result}</p>
    </div>
  );
}

/* ── Sequences as code ───────────────────────────────────── */

function SequenceCode() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6">
      <div className="grid items-start gap-12 lg:grid-cols-2">
        <div>
          <SectionHeader
            label="Sequences as code"
            title="AI generates it, you review it"
            description="Describe a sequence in natural language. Claude Code generates the typed TypeScript config with triggers, steps, delays, and conditional branches. Drop it in sequences/ — auto-discovered at build time, CDK generates the Step Functions state machine."
            align="left"
          />
          <p className="mt-4 text-sm text-fd-muted-foreground leading-relaxed">
            Templates work the same way. AI writes the email content, mailshot renders it with
            LiquidJS at send time. Use React Email, MJML, or raw HTML &mdash; anything that produces{" "}
            <code className="rounded bg-fd-muted px-1.5 py-0.5 font-mono text-xs">.html</code>.
          </p>
          <Link
            href="/docs/sequences"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-fd-primary underline-offset-4 hover:underline"
          >
            Sequence docs
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl bg-fd-card ring-1 ring-fd-border">
          <div className="bg-fd-muted/40 px-4 py-2">
            <span className="font-mono text-xs text-fd-muted-foreground">
              sequences/welcome/sequence.config.ts
            </span>
          </div>
          <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed">
            <code>{`import type { SequenceDefinition }
  from "@mailshot/shared";

export default {
  id: "welcome",
  trigger: {
    detailType: "customer.created",
    subscriberMapping: {
      email: "$.detail.email",
      firstName: "$.detail.firstName",
    },
  },
  steps: [
    { type: "send",
      templateKey: "welcome/hello",
      subject: "Welcome aboard" },
    { type: "wait", days: 2 },
    { type: "send",
      templateKey: "welcome/getting-started",
      subject: "Getting started" },
    { type: "wait", days: 3 },
    { type: "choice",
      field: "$.subscriber.attributes.plan",
      branches: [
        { value: "pro", steps: [
          { type: "send",
            templateKey: "welcome/pro-tips",
            subject: "Pro tips" },
        ]},
        { value: "free", steps: [
          { type: "send",
            templateKey: "welcome/upgrade",
            subject: "Ready for more?" },
        ]},
      ],
    },
  ],
} satisfies SequenceDefinition;`}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}

/* ── Features ────────────────────────────────────────────── */

function Features() {
  const features = [
    {
      title: "AI generates sequences",
      text: "Describe a sequence in plain language. Claude Code generates the TypeScript config, email templates, and deploy files.",
    },
    {
      title: "16-tool MCP server",
      text: "AI talks directly to your infrastructure. Manage subscribers, query engagement, preview templates, debug issues — all through Claude Code.",
    },
    {
      title: "4 Claude Code skills",
      text: "setup-env, create-sequence, validate, deploy. The skills handle generation, validation, CDK synthesis, and deployment.",
    },
    {
      title: "AI-driven analytics",
      text: "AI queries your engagement data and gives you recommendations. Opens, clicks, bounces per subscriber, template, or sequence.",
    },
    {
      title: "Full SES integration",
      text: "Delivery tracking, open/click events, bounce handling, List-Unsubscribe headers, HMAC-signed unsubscribe URLs.",
    },
    {
      title: "Automatic suppression",
      text: "Bounces and complaints suppress subscribers and stop all active Step Functions executions.",
    },
    {
      title: "Serverless",
      text: "Step Functions, Lambda, EventBridge, DynamoDB, S3. Pay-per-use on your own AWS account.",
    },
    {
      title: "Conditional branching",
      text: "Branch on subscriber attributes, check if emails were sent, evaluate conditions within sequences.",
    },
    {
      title: "Template agnostic",
      text: "React Email, MJML, raw HTML. Stores .html in S3 and renders LiquidJS at send time.",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-5xl px-6">
      <SectionHeader label="What's included" title="Framework, infrastructure, and tooling" />
      <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title}>
            <h3 className="text-sm font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-fd-muted-foreground">{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── MCP Tools ───────────────────────────────────────────── */

function MCPTools() {
  const groups = [
    {
      title: "Subscribers",
      count: 6,
      items: ["get", "list", "update", "delete", "unsubscribe", "resubscribe"],
    },
    {
      title: "Engagement",
      count: 3,
      items: ["by subscriber", "by template", "by sequence"],
    },
    {
      title: "Templates",
      count: 3,
      items: ["list in S3", "preview with live data", "validate Liquid syntax"],
    },
    {
      title: "Suppression",
      count: 2,
      items: ["list suppressed", "remove suppression"],
    },
    {
      title: "System",
      count: 2,
      items: ["failed executions", "delivery stats"],
    },
  ];

  return (
    <section className="mx-auto w-full max-w-5xl px-6">
      <SectionHeader
        label="MCP Server"
        title="16 tools for Claude Code"
        description="The MCP server connects Claude Code to your running infrastructure. Manage subscribers, query analytics, preview emails, debug issues."
      />
      <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-3 flex items-center gap-2">
              <h4 className="text-sm font-semibold">{g.title}</h4>
              <span className="rounded-full bg-fd-muted px-2 py-0.5 text-xs text-fd-muted-foreground">
                {g.count}
              </span>
            </div>
            <ul className="space-y-1">
              {g.items.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-fd-muted-foreground">
                  <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="flex items-end">
          <Link
            href="/docs/mcp-server"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-fd-primary underline-offset-4 hover:underline"
          >
            Full tool reference
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Architecture ────────────────────────────────────────── */

function Architecture() {
  const services = [
    { name: "EventBridge", role: "Event routing" },
    { name: "Step Functions", role: "Sequence orchestration" },
    { name: "Lambda", role: "5 handler functions" },
    { name: "DynamoDB", role: "Subscriber state + events" },
    { name: "S3", role: "Template storage" },
    { name: "SES", role: "Email delivery + tracking" },
    { name: "SNS", role: "Bounce/engagement routing" },
    { name: "SSM", role: "Runtime config" },
  ];

  return (
    <section className="mx-auto w-full max-w-5xl px-6">
      <SectionHeader
        label="Architecture"
        title="Managed AWS services, wired together"
        description="EventBridge for routing, Step Functions for orchestration, Lambda for execution, DynamoDB for state, S3 for templates, SES for sending. CDK deploys the whole stack."
      />
      <div className="mt-12 grid grid-cols-2 gap-x-12 gap-y-6 sm:grid-cols-4">
        {services.map((s) => (
          <div key={s.name}>
            <p className="text-sm font-semibold">{s.name}</p>
            <p className="text-xs text-fd-muted-foreground">{s.role}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 overflow-hidden rounded-xl bg-fd-muted/40 p-5 font-mono text-[13px] leading-relaxed">
        <pre className="overflow-x-auto">{`Your App → EventBridge → Step Functions → Lambda → SES → Recipient
                                            ↓
                                    S3 (templates)
                                    DynamoDB (state)`}</pre>
      </div>
    </section>
  );
}

/* ── Packages ────────────────────────────────────────────── */

function Packages() {
  const pkgs = [
    { name: "@mailshot/shared", desc: "Types, constants, DynamoDB key helpers" },
    { name: "@mailshot/handlers", desc: "Five Lambda handlers + shared lib modules" },
    { name: "@mailshot/cdk", desc: "CDK infrastructure with modular constructs" },
    { name: "@mailshot/mcp", desc: "MCP server for Claude Code" },
    { name: "create-mailshot", desc: "CLI scaffolder" },
  ];

  return (
    <section className="mx-auto w-full max-w-4xl px-6">
      <SectionHeader label="Packages" title="Published to npm" />
      <div className="mt-10 space-y-1">
        {pkgs.map((p) => (
          <div
            key={p.name}
            className="flex items-center gap-4 rounded-lg px-4 py-2.5 transition-colors hover:bg-fd-muted/40"
          >
            <code className="shrink-0 text-sm font-semibold">{p.name}</code>
            <span className="hidden h-px flex-1 bg-fd-border/50 sm:block" />
            <span className="text-sm text-fd-muted-foreground">{p.desc}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── CTA ─────────────────────────────────────────────────── */

function CTA() {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 pb-24 md:pb-32">
      <div className="flex flex-col items-center gap-6 text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Describe a sequence. Deploy it.
        </h2>
        <p className="max-w-md text-fd-muted-foreground">
          Scaffold a project, open Claude Code, tell it what emails to send and when. AI generates
          the config, templates, and deploys to your AWS account.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Installer />
          <Link
            href="/docs/quickstart"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-fd-muted-foreground underline-offset-4 hover:underline"
          >
            Quickstart guide
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ─────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-fd-border/50 py-8 text-center text-sm text-fd-muted-foreground">
      <p>
        Made with ❤️ and ☕ by{" "}
        <a
          href="https://github.com/mdwt"
          className="font-medium text-fd-foreground underline-offset-4 hover:underline"
        >
          @mdwt
        </a>
      </p>
      <p className="mt-1">Free and open source, forever.</p>
    </footer>
  );
}

/* ── Shared ──────────────────────────────────────────────── */

function SectionHeader({
  label,
  title,
  description,
  align = "center",
}: {
  label: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  const centered = align === "center";
  return (
    <div className={centered ? "text-center" : ""}>
      <p className="text-sm font-medium text-fd-muted-foreground">{label}</p>
      <h2
        className={`mt-2 text-balance text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl ${
          centered ? "mx-auto max-w-3xl" : ""
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-4 text-fd-muted-foreground sm:text-lg ${
            centered ? "mx-auto max-w-2xl" : ""
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}
