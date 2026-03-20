import Link from "next/link";
import {
  ArrowRight,
  Copy,
  Mail,
  GitBranch,
  Shield,
  Zap,
  Database,
  Star,
  Paintbrush,
} from "lucide-react";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Problem />
      <BringYourTemplates />
      <SequenceCode />
      <HowItWorks />
      <ArchitectureDiagram />
      <Features />
      <MCPTools />
      <Packages />
      <CTA />
      <Footer />
    </main>
  );
}

/* ── Hero ────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-fd-muted/40 dark:bg-fd-muted/20">
      {/* Film grain texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.5] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />
      {/* Subtle gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-fd-background/80" />
      <div className="relative mx-auto w-full max-w-4xl px-6 pt-24 pb-28 md:pt-36 md:pb-36">
        <div className="flex flex-col items-center gap-8 text-center">
          <h1 className="text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
            Deploy email sequences like you deploy everything else
          </h1>

          <p className="mt-8 text-lg font-normal text-pretty text-gray-500 sm:text-xl/8">
            Open-source serverless email sequences on AWS. Create sequences, deploy infrastructure,
            query analytics, manage subscribers — all through AI. No UI, never leave the terminal.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Installer />
            <Link
              href="/docs"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-fd-muted-foreground underline-offset-4 hover:text-fd-foreground hover:underline transition-colors"
            >
              Documentation
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <a
              href="https://github.com/mdwt/mailshot"
              className="inline-flex items-center gap-1.5 text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
            >
              <Star className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>

          <Terminal />
        </div>
      </div>
      {/* Wavy bottom edge */}
      <div className="absolute bottom-0 left-0 right-0 translate-y-px">
        <svg
          viewBox="0 0 1440 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="block w-full h-auto"
          preserveAspectRatio="none"
        >
          <path
            d="M0 24C240 48 480 56 720 40C960 24 1200 8 1440 32V56H0V24Z"
            className="fill-fd-background"
          />
        </svg>
      </div>
    </section>
  );
}

function Installer() {
  return (
    <button
      type="button"
      className="group inline-flex h-10 items-center gap-3 rounded-lg bg-ms-orange px-5 text-sm font-medium text-white transition-all hover:brightness-110 active:translate-y-px"
    >
      <code className="font-mono">npx create-mailshot</code>
      <Copy className="h-3.5 w-3.5 opacity-40 transition-opacity group-hover:opacity-70" />
    </button>
  );
}

function Terminal() {
  return (
    <div className="w-full max-w-xl overflow-hidden rounded-xl border border-fd-border bg-fd-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-fd-border/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-fd-muted-foreground/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-fd-muted-foreground/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-fd-muted-foreground/15" />
        <span className="ml-2 font-mono text-[11px] text-fd-muted-foreground/60">~/my-project</span>
      </div>
      <div className="p-5 font-mono text-[13px] leading-[1.7] text-left">
        <TLine prompt>npx create-mailshot my-project &amp;&amp; cd my-project</TLine>
        <TLine prompt>claude</TLine>
        <TLine />
        <TLine dim>&gt; Set up my environment for us-east-1</TLine>
        <TLine ok>✓ .env configured, SSM parameters verified, SES identity confirmed</TLine>
        <TLine />
        <TLine dim>&gt; Create a 5-email onboarding sequence triggered by customer.created</TLine>
        <TLine ok>✓ Generated sequence config, 5 templates, render script</TLine>
        <TLine />
        <TLine dim>&gt; Validate and deploy</TLine>
        <TLine ok>✓ Types valid, templates matched, CDK deployed to us-east-1</TLine>
        <TLine />
        <TLine dim>&gt; What are the open rates on the onboarding sequence?</TLine>
        <TLine ok>✓ 68% delivered, 42% opened, 12% clicked across 340 sends</TLine>
      </div>
    </div>
  );
}

function TLine({
  children,
  prompt,
  dim,
  ok,
}: {
  children: React.ReactNode;
  prompt?: boolean;
  dim?: boolean;
  ok?: boolean;
}) {
  return (
    <p
      className={
        ok
          ? "text-emerald-600 dark:text-emerald-400"
          : dim
            ? "text-fd-muted-foreground/70"
            : "text-fd-foreground"
      }
    >
      {prompt && <span className="text-fd-muted-foreground/50">$ </span>}
      {children}
    </p>
  );
}

/* ── Why ─────────────────────────────────────────────────── */

function Problem() {
  return (
    <section className="border-y border-fd-border/50 bg-fd-muted/30">
      <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
        <div className="grid gap-10 sm:grid-cols-3 sm:gap-12">
          <div>
            <p className="font-mono text-sm font-bold text-fd-foreground">
              Free &amp; MIT licensed
            </p>
            <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">
              mailshot is open source. You deploy it to your own AWS account.
            </p>
          </div>
          <div>
            <p className="font-mono text-sm font-bold text-fd-foreground">Cheap to run</p>
            <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">
              A 5-email sequence costs ~$0.30 per 1,000 runs in Step Functions, plus $0.50 in SES
              sends. At 10k subscribers you{"'"}re looking at under $10/month total AWS bill.
            </p>
          </div>
          <div>
            <p className="font-mono text-sm font-bold text-fd-foreground">Pay-per-execution</p>
            <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">
              No fixed costs. You pay AWS for state transitions, email sends, and DynamoDB reads.
              Nothing runs between emails. You only pay when a step executes.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Bring your templates ────────────────────────────────── */

function BringYourTemplates() {
  const tools = [
    { name: "React Email", desc: "JSX components rendered to HTML" },
    { name: "MJML", desc: "Responsive email markup language" },
    { name: "Raw HTML", desc: "Hand-coded or exported from any editor" },
    { name: "AI-generated", desc: "Claude, ChatGPT, or any LLM" },
    { name: "Figma → HTML", desc: "Export from design tools" },
    { name: "Your existing templates", desc: "Copy them into the project" },
  ];

  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-20 md:py-32">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr,1fr]">
        <div>
          <p className="font-mono text-xs font-medium tracking-widest text-fd-muted-foreground uppercase">
            Templates
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Use whatever you already use
          </h2>
          <p className="mt-4 text-fd-muted-foreground leading-relaxed">
            mailshot is an orchestration framework. It doesn{"'"}t care how you create your HTML -
            only that you have an{" "}
            <code className="rounded border border-fd-border bg-fd-muted/60 px-1.5 py-0.5 font-mono text-xs">
              .html
            </code>{" "}
            file at the end.
          </p>
          <p className="mt-3 text-fd-muted-foreground leading-relaxed">
            Keep your current workflow. Use your favorite editor, design tool, or framework. At send
            time, mailshot injects subscriber data into your templates with LiquidJS{" "}
            <code className="rounded border border-fd-border bg-fd-muted/60 px-1.5 py-0.5 font-mono text-xs">
              {"{{ firstName }}"}
            </code>{" "}
            variables - that{"'"}s the only contract.
          </p>
          <Link
            href="/docs/templates"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-fd-foreground underline-offset-4 hover:underline"
          >
            Template docs
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {tools.map((t) => (
            <div
              key={t.name}
              className="rounded-xl border border-fd-border/60 bg-fd-card/50 px-5 py-4"
            >
              <h4 className="text-sm font-bold">{t.name}</h4>
              <p className="mt-1 text-xs text-fd-muted-foreground">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Sequence as code ────────────────────────────────────── */

function SequenceCode() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-20 md:py-32">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr,1.2fr]">
        <div>
          <p className="font-mono text-xs font-medium tracking-widest text-fd-muted-foreground uppercase">
            Sequences as code
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            TypeScript config, CDK deploys it
          </h2>
          <p className="mt-4 text-fd-muted-foreground leading-relaxed">
            Define sequences as TypeScript configs - triggers, steps, delays, conditional branches.
            Everything lives in{" "}
            <code className="rounded border border-fd-border bg-fd-muted/60 px-1.5 py-0.5 font-mono text-xs">
              sequences/
            </code>{" "}
            and CDK auto-discovers and deploys each as a Step Functions state machine.
          </p>
          <p className="mt-3 text-fd-muted-foreground leading-relaxed">
            Write configs by hand, or use Claude Code to generate them from a description. Either
            way, it{"'"}s code you own and review before deploying.
          </p>
          <Link
            href="/docs/sequences"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-fd-foreground underline-offset-4 hover:underline"
          >
            Sequence docs
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border border-fd-border bg-fd-card">
          <div className="flex items-center border-b border-fd-border/60 px-4 py-2.5">
            <span className="font-mono text-xs text-fd-muted-foreground">sequence.config.ts</span>
          </div>
          <pre className="overflow-x-auto p-5 text-[13px] leading-[1.75]">
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
    </section>
  );
}

/* ── How it works ────────────────────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      step: "01",
      title: "Scaffold",
      command: "npx create-mailshot my-project",
      text: "Sets up the monorepo with CDK, shared types, handlers, and an MCP server wired to your AWS account.",
    },
    {
      step: "02",
      title: "Create sequences",
      command: "sequences/welcome/sequence.config.ts",
      text: "Write your sequence config by hand, or use Claude Code to generate it. Add your email templates however you like - React Email, MJML, raw HTML, any tool.",
    },
    {
      step: "03",
      title: "Deploy",
      command: "/deploy",
      text: "Validates types, checks template references, synthesizes CDK, deploys Step Functions + EventBridge + S3 templates.",
    },
    {
      step: "04",
      title: "Operate",
      command: 'mcp: "What are open rates on onboarding?"',
      text: "16 MCP tools let you query engagement, manage subscribers, preview templates, and debug - without leaving your editor.",
    },
  ];

  return (
    <section className="border-y border-fd-border/50 bg-fd-muted/20">
      <div className="mx-auto w-full max-w-5xl px-6 py-20 md:py-28">
        <p className="font-mono text-xs font-medium tracking-widest text-fd-muted-foreground uppercase">
          Workflow
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          From zero to sending in minutes
        </h2>
        <div className="mt-14 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.step}>
              <span className="font-mono text-xs font-bold tracking-wider text-fd-muted-foreground/50">
                {s.step}
              </span>
              <h3 className="mt-2 text-sm font-bold">{s.title}</h3>
              <p className="mt-1 font-mono text-xs text-fd-muted-foreground break-all">
                {s.command}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Architecture ────────────────────────────────────────── */

function ArchitectureDiagram() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-20 md:py-28">
      <p className="font-mono text-xs font-medium tracking-widest text-fd-muted-foreground uppercase">
        Architecture
      </p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Data flow</h2>
      <p className="mt-4 max-w-2xl text-fd-muted-foreground leading-relaxed">
        Your app publishes events to EventBridge. Rules route to Step Functions for sequences or
        Lambda for one-off sends. SES delivers with full engagement tracking back into DynamoDB.
      </p>

      <div className="mt-10 overflow-x-auto rounded-xl border border-fd-border bg-fd-card">
        <pre className="p-6 font-mono text-[12px] leading-[1.6] sm:text-[13px]">{`┌──────────────────────────────────┐
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

      <Link
        href="/docs/architecture"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-fd-foreground underline-offset-4 hover:underline"
      >
        Full architecture docs
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

/* ── Features ────────────────────────────────────────────── */

function Features() {
  const features = [
    {
      icon: Mail,
      title: "Full SES integration",
      text: "Delivery tracking, open/click events, bounce handling, List-Unsubscribe headers, HMAC-signed unsubscribe URLs.",
    },
    {
      icon: GitBranch,
      title: "Conditional branching",
      text: "Choice steps branch on subscriber attributes. Condition steps query DynamoDB at runtime for send history and profile changes.",
    },
    {
      icon: Shield,
      title: "Automatic suppression",
      text: "Bounces and complaints suppress subscribers and stop all active Step Functions executions. No manual intervention.",
    },
    {
      icon: Zap,
      title: "Serverless & pay-per-use",
      text: "Step Functions, Lambda, EventBridge, DynamoDB, S3. Pay-per-execution on your own AWS account. No fixed costs.",
    },
    {
      icon: Database,
      title: "Single-table DynamoDB",
      text: "Subscribers, executions, send logs, and suppression records in one table. Engagement events in a second. No relational database.",
    },
    {
      icon: Paintbrush,
      title: "Bring your own templates",
      text: "Use any tool that outputs HTML - React Email, MJML, hand-coded, Figma exports, AI-generated. mailshot just renders variables with LiquidJS at send time.",
    },
  ];

  return (
    <section className="border-y border-fd-border/50 bg-fd-muted/20">
      <div className="mx-auto w-full max-w-5xl px-6 py-20 md:py-28">
        <p className="font-mono text-xs font-medium tracking-widest text-fd-muted-foreground uppercase">
          Built in
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Production-ready out of the box
        </h2>
        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group">
              <f.icon className="h-5 w-5 text-fd-muted-foreground/60 mb-3" strokeWidth={1.5} />
              <h3 className="text-sm font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fd-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── MCP Tools ───────────────────────────────────────────── */

function MCPTools() {
  const groups = [
    {
      title: "Subscribers",
      tools: ["get", "list", "update", "delete", "unsubscribe", "resubscribe"],
    },
    { title: "Engagement", tools: ["by subscriber", "by template", "by sequence"] },
    { title: "Templates", tools: ["list", "preview with live data", "validate syntax"] },
    { title: "Suppression", tools: ["list suppressed", "remove"] },
    { title: "System", tools: ["failed executions", "delivery stats"] },
  ];

  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-20 md:py-28">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr,1.5fr]">
        <div>
          <p className="font-mono text-xs font-medium tracking-widest text-fd-muted-foreground uppercase">
            MCP Server
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            18 tools for Claude&nbsp;Code
          </h2>
          <p className="mt-4 text-fd-muted-foreground leading-relaxed">
            The MCP server connects Claude Code to your live AWS infrastructure. Manage subscribers,
            query engagement metrics, preview emails with real data, debug delivery issues.
          </p>
          <p className="mt-3 text-fd-muted-foreground leading-relaxed">One command to set up:</p>
          <code className="mt-2 block rounded-lg border border-fd-border bg-fd-card px-4 py-2.5 font-mono text-xs">
            claude mcp add mailshot -- npx @mailshot/mcp
          </code>
          <Link
            href="/docs/mcp-server"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-fd-foreground underline-offset-4 hover:underline"
          >
            Full tool reference
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <div
              key={g.title}
              className="rounded-xl border border-fd-border/60 bg-fd-card/50 px-5 py-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold">{g.title}</h4>
                <span className="font-mono text-xs text-fd-muted-foreground">{g.tools.length}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {g.tools.map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-fd-border/50 bg-fd-muted/40 px-2 py-0.5 font-mono text-[11px] text-fd-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Packages ────────────────────────────────────────────── */

function Packages() {
  const pkgs = [
    { name: "@mailshot/shared", desc: "Types, constants, DynamoDB key helpers" },
    { name: "@mailshot/handlers", desc: "Five Lambda handlers + shared lib" },
    { name: "@mailshot/cdk", desc: "CDK infrastructure, modular constructs" },
    { name: "@mailshot/mcp", desc: "MCP server for Claude Code" },
    { name: "create-mailshot", desc: "CLI scaffolder" },
  ];

  return (
    <section className="border-t border-fd-border/50 bg-fd-muted/20">
      <div className="mx-auto w-full max-w-4xl px-6 py-20 md:py-28">
        <p className="font-mono text-xs font-medium tracking-widest text-fd-muted-foreground uppercase">
          Packages
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Published on npm</h2>
        <div className="mt-10 divide-y divide-fd-border/50">
          {pkgs.map((p) => (
            <div key={p.name} className="flex items-baseline gap-4 py-3">
              <code className="shrink-0 font-mono text-sm font-bold">{p.name}</code>
              <span className="hidden h-px flex-1 bg-fd-border/30 sm:block translate-y-[-2px]" />
              <span className="text-sm text-fd-muted-foreground">{p.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA ─────────────────────────────────────────────────── */

function CTA() {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-20 md:py-28">
      <div className="flex flex-col items-center gap-6 text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          Get started in five minutes
        </h2>
        <p className="max-w-lg text-fd-muted-foreground leading-relaxed">
          Scaffold a project, describe a sequence to AI, deploy. Your AWS account, your
          infrastructure, your data.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Installer />
          <Link
            href="/docs/quickstart"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-fd-muted-foreground underline-offset-4 hover:text-fd-foreground hover:underline transition-colors"
          >
            Quickstart guide
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-fd-border/50 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 text-sm text-fd-muted-foreground sm:flex-row">
        <p>
          Built by{" "}
          <a
            href="https://github.com/mdwt"
            className="font-medium text-fd-foreground underline-offset-4 hover:underline"
          >
            @mdwt
          </a>
        </p>
        <p>MIT licensed. Free forever.</p>
      </div>
    </footer>
  );
}
