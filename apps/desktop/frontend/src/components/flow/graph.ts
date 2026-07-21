import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { SequenceDefinition, SequenceStep } from "@/types/mailshot";

/**
 * Converts a SequenceDefinition step tree into React Flow nodes + edges,
 * laid out top-to-bottom with dagre. Read-only in Phase 1.
 */

export interface FlowGraph {
  nodes: Node[];
  edges: Edge[];
}

interface Entry {
  id: string;
  label?: string;
}

const SIZES: Record<string, { w: number; h: number }> = {
  trigger: { w: 260, h: 64 },
  send: { w: 260, h: 68 },
  wait: { w: 150, h: 44 },
  choice: { w: 250, h: 48 },
  condition: { w: 250, h: 48 },
  complete: { w: 170, h: 42 },
};

export function buildFlowGraph(def: SequenceDefinition): FlowGraph {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let counter = 0;
  const nid = (prefix: string) => `${prefix}-${counter++}`;

  const addNode = (type: string, data: Record<string, unknown>, height?: number): string => {
    const id = nid(type);
    const size = SIZES[type] ?? { w: 220, h: 48 };
    nodes.push({
      id,
      type,
      data,
      position: { x: 0, y: 0 },
      width: size.w,
      height: height ?? size.h,
      draggable: false,
      connectable: false,
    });
    return id;
  };

  const connect = (entries: Entry[], target: string) => {
    for (const e of entries) {
      edges.push({
        id: `${e.id}->${target}`,
        source: e.id,
        target,
        type: "smoothstep",
        label: e.label,
      });
    }
  };

  const walk = (steps: SequenceStep[], entries: Entry[]): Entry[] => {
    let current = entries;
    for (const step of steps) {
      if (step.type === "send") {
        const variants = step.variants ?? [];
        const height = variants.length > 0 ? 50 + variants.length * 27 : SIZES.send.h;
        const id = addNode("send", { step }, height);
        connect(current, id);
        current = [{ id }];
      } else if (step.type === "wait") {
        const id = addNode("wait", { step });
        connect(current, id);
        current = [{ id }];
      } else if (step.type === "choice") {
        const id = addNode("choice", { step });
        connect(current, id);
        const exits: Entry[] = [];
        for (const branch of step.branches) {
          exits.push(...walk(branch.steps, [{ id, label: JSON.stringify(branch.value) }]));
        }
        if (step.default && step.default.length > 0) {
          exits.push(...walk(step.default, [{ id, label: "default" }]));
        } else {
          exits.push({ id, label: "default" });
        }
        current = exits;
      } else if (step.type === "condition") {
        const id = addNode("condition", { step });
        connect(current, id);
        const exits: Entry[] = [...walk(step.then, [{ id, label: "then" }])];
        if (step.else && step.else.length > 0) {
          exits.push(...walk(step.else, [{ id, label: "else" }]));
        } else {
          exits.push({ id, label: "else" });
        }
        current = exits;
      }
    }
    return current;
  };

  const triggerId = addNode("trigger", { trigger: def.trigger });
  const finalExits = walk(def.steps, [{ id: triggerId }]);
  const completeId = addNode("complete", {});
  connect(finalExits, completeId);

  return layout(nodes, edges);
}

function layout(nodes: Node[], edges: Edge[]): FlowGraph {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 46, ranksep: 42 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, { width: node.width ?? 220, height: node.height ?? 48 });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);

  const positioned = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - (node.width ?? 220) / 2,
        y: pos.y - (node.height ?? 48) / 2,
      },
    };
  });

  return { nodes: positioned, edges };
}
