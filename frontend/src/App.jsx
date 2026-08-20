import { useCallback, useState } from 'react'
  import {
    ReactFlow,
    Background,
    Controls,
    Handle,
    Position,
    addEdge,
    useEdgesState,
    useNodesState,
  } from '@xyflow/react'
  import '@xyflow/react/dist/style.css'
  import './App.css'

  function EditableNode({ id, data, selected }) {
    const updateLabel = (event) => {
      data.onLabelChange(id, event.target.value)
    }

    return (
      <div className={`diagram-node ${data.shape || 'rectangle'}${selected ? ' selected' : ''}`}>
        <Handle type="target" position={Position.Left} />
        <textarea
          className="nodrag"
          aria-label="Shape label"
          value={data.label || ''}
          placeholder={data.shape === 'note' ? 'Type a note' : 'Type a label'}
          onChange={updateLabel}
          rows={1}
        />
        <Handle type="source" position={Position.Right} />
      </div>
    )
  }

  const nodeTypes = { editable: EditableNode }

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

  const defaultInterviewSteps = [
    {
      stage: 'Clarify requirements',
      question: 'What functional and non-functional requirements would you clarify first?',
    },
    {
      stage: 'Define the scope',
      question: 'What assumptions and constraints will guide your design?',
    },
    {
      stage: 'High-level design',
      question: 'Explain the main flow through the system you are building.',
    },
  ]

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
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
    const [saveStatus, setSaveStatus] = useState('Save diagram')
    const [selection, setSelection] = useState({ nodes: [], edges: [] })
    const [interviewStep, setInterviewStep] = useState(0)
    const [interviewAnswers, setInterviewAnswers] = useState(sessionConfig.clarificationAnswers || {})
    const [answerSaveStatus, setAnswerSaveStatus] = useState('')

    const promptQuestions = sessionConfig.clarifyingQuestions?.length
      ? sessionConfig.clarifyingQuestions.map((question, index) => ({
          stage: index === 0 ? 'Clarify requirements' : `Question ${index + 1}`,
          question: typeof question === 'string' ? question : question.question,
        }))
      : defaultInterviewSteps
    const currentInterviewStep = promptQuestions[interviewStep]

    const updateNodeLabel = useCallback((nodeId, label) => {
      setNodes((currentNodes) => currentNodes.map((node) => (
        node.id === nodeId
          ? { ...node, data: { ...node.data, label } }
          : node
      )))
    }, [setNodes])

    const addShape = useCallback((shape) => {
      const id = crypto.randomUUID()
      setNodes((currentNodes) => [
        ...currentNodes,
        {
          id,
          type: 'editable',
          position: {
            x: 120 + (currentNodes.length % 4) * 170,
            y: 100 + Math.floor(currentNodes.length / 4) * 130,
          },
          data: {
            label: '',
            shape,
          },
        },
      ])
    }, [setNodes])

    const nodesWithActions = nodes.map((node) => ({
      ...node,
      type: node.type || 'editable',
      data: { ...node.data, shape: node.data.shape || 'rectangle', onLabelChange: updateNodeLabel },
    }))

    const deleteSelection = useCallback(() => {
      const selectedNodeIds = new Set(selection.nodes.map((node) => node.id))
      const selectedEdgeIds = new Set(selection.edges.map((edge) => edge.id))
      setNodes((currentNodes) => currentNodes.filter((node) => !selectedNodeIds.has(node.id)))
      setEdges((currentEdges) => currentEdges.filter((edge) => (
        !selectedEdgeIds.has(edge.id)
        && !selectedNodeIds.has(edge.source)
        && !selectedNodeIds.has(edge.target)
      )))
      setSelection({ nodes: [], edges: [] })
    }, [selection, setEdges, setNodes])

    const saveInterviewAnswers = useCallback(async (advance = false) => {
      setAnswerSaveStatus('Saving...')
      try {
        const response = await fetch(sessionConfig.answerSaveUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
          },
          body: JSON.stringify({ answers: interviewAnswers }),
        })
        if (!response.ok) throw new Error('Save failed')
        setAnswerSaveStatus('Saved')
        if (advance) setInterviewStep((step) => step + 1)
      } catch {
        setAnswerSaveStatus('Try again')
      }
    }, [interviewAnswers])

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
          body: JSON.stringify({
            nodes: nodes.map((node) => ({
              ...node,
              data: {
                label: node.data.label,
                shape: node.data.shape || 'rectangle',
              },
            })),
            edges,
          }),
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
          <div className="session-heading">
            <img src="/static/branding/diagrammed-mark.svg" alt="" />
            <div>
              <p>Diagrammed</p>
            <h1>{sessionConfig.promptTitle || 'Practice diagram'}</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={saveDiagram}
            disabled={saveStatus === 'Saving...'}
          >
            {saveStatus}
          </button>
        </header>

        <div className="workspace">
          <aside className="shape-toolbar" aria-label="Shape toolbar">
            <h2>Shapes</h2>
            <button type="button" onClick={() => addShape('rectangle')}>Rectangle</button>
            <button type="button" onClick={() => addShape('circle')}>Circle</button>
            <button type="button" onClick={() => addShape('note')}>Note</button>
            <button
              className="delete-button"
              type="button"
              onClick={deleteSelection}
              disabled={!selection.nodes.length && !selection.edges.length}
            >
              Delete selected
            </button>
          </aside>
          <div className="whiteboard">
          <ReactFlow
            nodes={nodesWithActions}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={setSelection}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
          </div>
          <aside className="interview-panel">
            <div className="prompt-summary">
              <p className="panel-eyebrow">Design prompt</p>
              <h2>{sessionConfig.promptTitle || 'Practice diagram'}</h2>
              <p>{sessionConfig.promptDescription || 'Work through the design one step at a time.'}</p>
            </div>

            <div className="interview-step">
              <p className="panel-eyebrow">
                Step {interviewStep + 1} of {promptQuestions.length}
              </p>
              <h3>{currentInterviewStep.stage}</h3>
              <p>{currentInterviewStep.question}</p>
              <textarea
                value={interviewAnswers[interviewStep] || ''}
                placeholder="Explain your thinking..."
                onChange={(event) => {
                  setAnswerSaveStatus('')
                  setInterviewAnswers((answers) => ({
                    ...answers,
                    [interviewStep]: event.target.value,
                  }))
                }}
              />
              <div className="step-actions">
                <button
                  type="button"
                  disabled={interviewStep === 0}
                  onClick={() => setInterviewStep((step) => step - 1)}
                >
                  Back
                </button>
                <button
                  className="continue-button"
                  type="button"
                  disabled={answerSaveStatus === 'Saving...'}
                  onClick={() => saveInterviewAnswers(interviewStep < promptQuestions.length - 1)}
                >
                  {answerSaveStatus === 'Saving...'
                    ? 'Saving...'
                    : interviewStep === promptQuestions.length - 1
                      ? 'Save response'
                      : 'Save & continue'}
                </button>
              </div>
              <small>{answerSaveStatus || 'Responses are saved with this session.'}</small>
            </div>
          </aside>
        </div>
      </main>
    )
  }

  export default App
