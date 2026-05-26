import React, { useState, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './WorkflowEditor.scss';

interface WorkflowEditorProps {
  app: any;
}

const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ app }) => {
  const initialNodes: Node[] = app.generatedCode?.frontend?.structure?.map((file: any, index: number) => ({
    id: `node-${index}`,
    type: 'default',
    data: { label: file.path },
    position: { x: index * 200, y: index * 100 },
  })) || [
    { id: '1', type: 'input', data: { label: 'Start' }, position: { x: 0, y: 0 } },
  ];

  const initialEdges: Edge[] = [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="workflow-editor">
      <div className="workflow-editor-toolbar">
        <h3>Workflow Builder</h3>
        <p>Visualize and edit your app's component flow and data flow</p>
      </div>
      <div className="workflow-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
};

export default WorkflowEditor;

