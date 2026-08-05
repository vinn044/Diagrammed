import { useCallback } from 'react'
  import {
    ReactFlow,
    Background,
    Controls,
    addEdge,
    useEdgesState,
    useNodesState,
  } from '@xyflow/react'
  import '@xyflow/react/dist/style.css'
  import './App.css'

  const startingNodes = [
    {
      id: 'client',
      position: { x: 80, y: 140 },
      data: { label: 'Client' },
    },
    {
      id: 'api',
      position: { x: 380, y: 140 },
      data: { label: 'API Server' },
    },
    {
      id: 'database',
      position: { x: 680, y: 140 },
      data: { label: 'Database' },
    },
  ]

  const startingEdges = [
    { id: 'client-api', source: 'client', target: 'api' },
    { id: 'api-database', source: 'api', target: 'database' },
  ]

  function App() {
    const [nodes, , onNodesChange] = useNodesState(startingNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState(startingEdges)

    const onConnect = useCallback(
      (connection) => setEdges((currentEdges) => addEdge(connection, currentEdges)),
      [setEdges],
    )

    return (
      <main className="whiteboard-page">
        <header className="whiteboard-header">
          <div>
            <p>Diagrammed</p>
            <h1>Design a URL Shortener</h1>
          </div>
          <button type="button">Save diagram</button>
        </header>

        <div className="whiteboard">
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
          </ReactFlow>
        </div>
      </main>
    )
  }

  export default App
