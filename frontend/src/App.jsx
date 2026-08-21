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
      id: 'starting-node',
      type: 'editable',
      position: { x: 320, y: 180 },
      data: { label: '', shape: 'rectangle' },
    },
  ]

  const startingEdges = []

  const sessionConfigElement = document.getElementById('session-config')
  const sessionConfig = sessionConfigElement
    ? JSON.parse(sessionConfigElement.textContent)
    : {}

  const practiceStages = [
    {
      title: 'Requirements',
      instruction: 'Add note shapes for the functional and non-functional requirements. Include the most important constraints.',
    },
    {
      title: 'Estimates and constraints',
      instruction: 'Add assumptions for traffic, storage, latency, availability, and any important limits.',
    },
    {
      title: 'High-level architecture',
      instruction: 'Add and connect the main system components. Use notes to explain the primary request flows.',
    },
    {
      title: 'Data design',
      instruction: 'Show the main stored data, keys, access patterns, and why your storage choices fit the problem.',
    },
    {
      title: 'Scaling and reliability',
      instruction: 'Update the design for growth and failure. Address bottlenecks, redundancy, recovery, and tradeoffs.',
    },
    {
      title: 'Final review',
      instruction: 'Review the complete board, fill any gaps, then submit it for final category scores and an overall average.',
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
    const [feedback, setFeedback] = useState(
      sessionConfig.feedback?.strengths && sessionConfig.feedback?.improvements
        ? sessionConfig.feedback
        : null,
    )
    const [gradeStatus, setGradeStatus] = useState('')
    const [currentStage, setCurrentStage] = useState(sessionConfig.currentStage || 0)
    const [stageFeedback, setStageFeedback] = useState(sessionConfig.stageFeedback || {})
    const [stageStatus, setStageStatus] = useState('')
    const activeStage = practiceStages[currentStage]
    const activeReview = stageFeedback[currentStage]

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

    const gradeDesign = useCallback(async () => {
      setGradeStatus('Grading...')
      try {
        const response = await fetch(sessionConfig.gradeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
          },
          body: JSON.stringify({
            diagram: {
              nodes: nodes.map((node) => ({
                ...node,
                data: {
                  label: node.data.label,
                  shape: node.data.shape || 'rectangle',
                },
              })),
              edges,
            },
            answers: {},
          }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Grading failed')
        setFeedback(result.feedback)
        setGradeStatus('Graded')
      } catch (error) {
        setGradeStatus(error.message)
      }
    }, [edges, nodes])

    const reviewStage = useCallback(async () => {
      setStageStatus('Reviewing...')
      try {
        const response = await fetch(sessionConfig.reviewStageUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
          },
          body: JSON.stringify({
            stageIndex: currentStage,
            stage: activeStage,
            diagram: {
              nodes: nodes.map((node) => ({
                ...node,
                data: {
                  label: node.data.label,
                  shape: node.data.shape || 'rectangle',
                },
              })),
              edges,
            },
          }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Review failed')
        setStageFeedback((reviews) => ({ ...reviews, [currentStage]: result.review }))
        setStageStatus('Reviewed')
      } catch (error) {
        setStageStatus(error.message)
      }
    }, [activeStage, currentStage, edges, nodes])

    const continueToNextStage = useCallback(async () => {
      const nextStage = currentStage + 1
      setStageStatus('Saving...')
      try {
        const response = await fetch(sessionConfig.advanceStageUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
          },
          body: JSON.stringify({ stage: nextStage }),
        })
        if (!response.ok) throw new Error('Could not continue')
        setCurrentStage(nextStage)
        setStageStatus('')
      } catch (error) {
        setStageStatus(error.message)
      }
    }, [currentStage])

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
          <aside className="interview-panel ai-panel">
            <div className="prompt-summary">
              <p className="panel-eyebrow">Design prompt</p>
              <h2>{sessionConfig.promptTitle || 'Practice diagram'}</h2>
              <p>{sessionConfig.promptDescription || 'Work through the design one step at a time.'}</p>
            </div>

            <div className="assistant-message">
              <div>
                <p className="panel-eyebrow">Stage {currentStage + 1} of {practiceStages.length}</p>
                <strong>{activeStage.title}</strong>
                <p>{activeStage.instruction}</p>
              </div>
            </div>

            <div className="grading-panel">
              {currentStage < practiceStages.length - 1 ? (
                <>
                  <button type="button" onClick={reviewStage} disabled={stageStatus === 'Reviewing...'}>
                    {stageStatus === 'Reviewing...' ? 'Reviewing stage...' : `Review ${activeStage.title.toLowerCase()}`}
                  </button>
                  {activeReview && (
                    <div className="stage-review">
                      <div className="stage-score-row">
                        <strong>Stage score</strong>
                        <span>{activeReview.score}/100</span>
                      </div>
                      <div className="score-meter" aria-label={`Stage score ${activeReview.score} out of 100`}>
                        <span
                          className={activeReview.score < 40 ? 'low' : activeReview.score < 70 ? 'medium' : 'high'}
                          style={{ width: `${activeReview.score}%` }}
                        />
                      </div>
                      <p>{activeReview.summary}</p>
                      {!!activeReview.strengths.length && (
                        <><h4>Working well</h4><ul>{activeReview.strengths.map((item) => <li key={item}>{item}</li>)}</ul></>
                      )}
                      {!!activeReview.improvements.length && (
                        <><h4>Before moving on</h4><ul>{activeReview.improvements.map((item) => <li key={item}>{item}</li>)}</ul></>
                      )}
                      <button type="button" onClick={continueToNextStage} disabled={!activeReview.ready_to_continue}>
                        Continue to next stage
                      </button>
                    </div>
                  )}
                  {stageStatus && !['Reviewed', 'Reviewing...', 'Saving...'].includes(stageStatus) && (
                    <p className="grading-error">{stageStatus}</p>
                  )}
                </>
              ) : (
                <button type="button" onClick={gradeDesign} disabled={gradeStatus === 'Grading...'}>
                  {gradeStatus === 'Grading...' ? 'Grading final design...' : 'Submit final design'}
                </button>
              )}
              {gradeStatus && gradeStatus !== 'Graded' && gradeStatus !== 'Grading...' && (
                <p className="grading-error">{gradeStatus}</p>
              )}
              {feedback && (
                <div className="feedback-card">
                  <div className="feedback-score">{feedback.score}<span>/100</span></div>
                  <h3>Design feedback</h3>
                  <p>{feedback.summary}</p>
                  {feedback.category_scores && (
                    <div className="score-breakdown">
                      {Object.entries(feedback.category_scores).map(([category, score]) => (
                        <div key={category}>
                          <span>{category}</span>
                          <strong>{score}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                  <h4>Strengths</h4>
                  <ul>{feedback.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
                  <h4>Improvements</h4>
                  <ul>{feedback.improvements.map((item) => <li key={item}>{item}</li>)}</ul>
                  <h4>Next step</h4>
                  <p>{feedback.next_step}</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    )
  }

  export default App
