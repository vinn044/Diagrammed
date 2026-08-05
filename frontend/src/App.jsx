import { useCallback, useState } from 'react'
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

  const sessionConfigElement = document.getElementById('session-config')
  const sessionConfig = sessionConfigElement
    ? JSON.parse(sessionConfigElement.textContent)
    : {}

  function getCookie(name) {
    const cookie = document.cookie
      .split('; ')
      .find((item) => item.startsWith(`${name}=`))
    return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : ''
  }

  function App() {
    const savedDiagram = sessionConfig.diagramData || {}
    const initialNodes = savedDiagram.nodes?.length ? savedDiagram.nodes : startingNodes
    const initialEdges = savedDiagram.nodes?.length ? (savedDiagram.edges || []) : startingEdges
    const [nodes, , onNodesChange] = useNodesState(initialNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
    const [saveStatus, setSaveStatus] = useState('Save diagram')

    const onConnect = useCallback(
      (connection) => setEdges((currentEdges) => addEdge(connection, currentEdges)),
      [setEdges],
    )

    const saveDiagram = useCallback(async () => {
      setSaveStatus('Saving...')
      try {
        const response = await fetch(sessionConfig.saveUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
          },
          body: JSON.stringify({ nodes, edges }),
        })
        if (!response.ok) throw new Error('Save failed')
        setSaveStatus('Saved')
        window.setTimeout(() => setSaveStatus('Save diagram'), 1500)
      } catch {
        setSaveStatus('Try again')
      }
    }, [nodes, edges])

    return (
      <main className="whiteboard-page">
        <header className="whiteboard-header">
          <div>
            <p>Diagrammed</p>
            <h1>{sessionConfig.promptTitle || 'Practice diagram'}</h1>
          </div>
          <button
            type="button"
            onClick={saveDiagram}
            disabled={saveStatus === 'Saving...'}
          >
            {saveStatus}
          </button>
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
