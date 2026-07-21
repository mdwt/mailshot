import { useMemo } from "react";
import { Background, BackgroundVariant, Controls, ReactFlow } from "@xyflow/react";
import type { SequenceDefinition } from "@/types/mailshot";
import { buildFlowGraph } from "@/components/flow/graph";
import { nodeTypes } from "@/components/flow/nodes";

export function FlowCanvas({ def }: { def: SequenceDefinition }) {
  const graph = useMemo(() => buildFlowGraph(def), [def]);

  return (
    <div className="relative h-full min-h-0">
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#232b34" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>

      {((def.events?.length ?? 0) > 0 || (def.exitOn?.length ?? 0) > 0) && (
        <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[70%] flex-wrap gap-2">
          {def.events?.map((e) => (
            <div
              key={e.detailType + e.templateKey}
              className="rounded-lg border border-dashed border-line bg-surface2/90 px-3 py-1.5 font-mono text-[11px] text-muted"
            >
              ⚡ event · <span className="text-ink">{e.detailType}</span> →{" "}
              {e.templateKey.split("/").pop()}
            </div>
          ))}
          {def.exitOn?.map((e) => (
            <div
              key={e.detailType}
              className="rounded-lg border border-dashed border-line bg-surface2/90 px-3 py-1.5 font-mono text-[11px] text-muted"
            >
              ⏏ exit on · <span className="text-ink">{e.detailType}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
