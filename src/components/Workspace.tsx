import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 200;
const nodeHeight = 80;

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      style: {
        background: '#1e293b',
        color: '#fff',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '12px',
        fontSize: '12px',
        fontFamily: 'monospace',
        minWidth: '150px',
        textAlign: 'center'
      }
    };
  });

  return { nodes: newNodes, edges };
};

interface WorkspaceProps {
  initialData: { nodes: any[], edges: any[] } | null;
}

export function Workspace({ initialData }: WorkspaceProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (initialData && initialData.nodes && initialData.edges) {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        initialData.nodes,
        initialData.edges
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, [initialData, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div className="w-full h-full bg-surface-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        colorMode="dark"
      >
        <Controls />
        <MiniMap nodeStrokeColor="#475569" nodeColor="#1e293b" maskColor="rgba(0,0,0,0.4)" />
        <Background color="#334155" gap={16} />
      </ReactFlow>
    </div>
  );
}
