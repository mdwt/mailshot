import { Handle, Position, type NodeProps } from "@xyflow/react";
import type {
  ChoiceStep,
  ConditionStep,
  SendStep,
  SequenceTrigger,
  WaitStep,
} from "@/types/mailshot";
import { waitLabel } from "@/types/mailshot";

/** Custom node renderers for the read-only sequence canvas. */

function Ports() {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

function NodeShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`h-full rounded-lg border border-line bg-surface px-3.5 py-2 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Kind({ label, dotClass }: { label: string; dotClass: string }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
      <span className={`h-1.5 w-1.5 ${dotClass}`} />
      {label}
    </div>
  );
}

export function TriggerNode({ data }: NodeProps) {
  const trigger = data.trigger as SequenceTrigger;
  return (
    <NodeShell>
      <Kind label="trigger" dotClass="rounded-full bg-accent" />
      <div className="mt-0.5 font-mono text-[13px]">{trigger.detailType}</div>
      <div className="truncate text-xs text-muted">email ← {trigger.subscriberMapping.email}</div>
      <Handle type="source" position={Position.Bottom} />
    </NodeShell>
  );
}

export function SendNode({ data }: NodeProps) {
  const step = data.step as SendStep;
  const variants = step.variants ?? [];
  const name = (key?: string) => key?.split("/").pop() ?? key ?? "?";
  return (
    <NodeShell className={variants.length > 0 ? "border-accent" : ""}>
      <Kind
        label={variants.length > 0 ? "send · a/b test" : "send"}
        dotClass="rounded-[2px] bg-accent"
      />
      {variants.length === 0 ? (
        <>
          <div className="mt-0.5 truncate font-mono text-[13px]">{step.templateKey}</div>
          <div className="truncate text-xs text-muted">"{step.subject}"</div>
        </>
      ) : (
        <div className="mt-1 space-y-1">
          {variants.map((v, i) => (
            <div
              key={v.templateKey}
              className="flex items-center gap-2 rounded-md border border-linesoft px-2 py-0.5 font-mono text-[11px]"
            >
              <span className="text-accent">{String.fromCharCode(65 + i)}</span>
              <span className="truncate text-ink">{name(v.templateKey)}</span>
              <span className="ml-auto truncate text-faint">"{v.subject}"</span>
            </div>
          ))}
        </div>
      )}
      <Ports />
    </NodeShell>
  );
}

export function WaitNode({ data }: NodeProps) {
  const step = data.step as WaitStep;
  return (
    <NodeShell className="border-dashed bg-surface2">
      <Kind label="wait" dotClass="rounded-[2px] bg-faint" />
      <div className="font-mono text-[13px]">{waitLabel(step)}</div>
      <Ports />
    </NodeShell>
  );
}

export function ChoiceNode({ data }: NodeProps) {
  const step = data.step as ChoiceStep;
  return (
    <NodeShell>
      <div className="flex items-center gap-2 font-mono text-xs">
        <span className="text-[11px] text-warn">◆</span>
        <span className="text-faint">choice</span>
        <span className="truncate text-ink">{step.field.split(".").pop()}</span>
      </div>
      <div className="truncate font-mono text-[10.5px] text-faint">{step.field}</div>
      <Ports />
    </NodeShell>
  );
}

export function ConditionNode({ data }: NodeProps) {
  const step = data.step as ConditionStep;
  const detail =
    step.check === "has_been_sent"
      ? step.templateKey
      : step.check === "subscriber_field_equals"
        ? `${step.field} == ${JSON.stringify(step.value)}`
        : step.field;
  return (
    <NodeShell>
      <div className="flex items-center gap-2 font-mono text-xs">
        <span className="text-[11px] text-warn">◆</span>
        <span className="text-faint">condition</span>
        <span className="truncate text-ink">{step.check}</span>
      </div>
      <div className="truncate font-mono text-[10.5px] text-faint">{detail}</div>
      <Ports />
    </NodeShell>
  );
}

export function CompleteNode() {
  return (
    <NodeShell className="bg-surface2">
      <Kind label="complete" dotClass="rounded-[2px] bg-good" />
      <div className="text-xs text-muted">sequence ends</div>
      <Handle type="target" position={Position.Top} />
    </NodeShell>
  );
}

export const nodeTypes = {
  trigger: TriggerNode,
  send: SendNode,
  wait: WaitNode,
  choice: ChoiceNode,
  condition: ConditionNode,
  complete: CompleteNode,
};
