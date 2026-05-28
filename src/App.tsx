import { useEffect, useMemo, useState } from 'react';
import { activateBackendToken, getAuthStatus, routeWidgetTool, sendChat, defaultGovernanceContext } from './api/widgetdcClient';
import { canvasModes, claims, events, phantomRun, platformMetrics, services, tools } from './data/mockData';
import type { CanvasMode, ChatMessage, ToolDefinition } from './types/widgetdc';
import { buildRejection, canExecuteFromBrowser } from './utils/governance';
import { createCorrelationId } from './utils/ids';
import { TopBar } from './components/TopBar';
import { LeftRail } from './components/LeftRail';
import { ChatPanel } from './components/ChatPanel';
import { GovernancePanel } from './components/GovernancePanel';
import { MissionControl } from './components/MissionControl';
import { EventSpineTimeline } from './components/EventSpineTimeline';
import { ClaimsPanel } from './components/ClaimsPanel';
import { PhantomBomPanel } from './components/PhantomBomPanel';
import { ConnectorsPanel } from './components/ConnectorsPanel';
import { CanvasView } from './components/CanvasView';

const initialMessages: ChatMessage[] = [
  {
    id: 'msg-system',
    role: 'system',
    timestamp: Date.now() - 1000 * 60 * 3,
    content: 'WidgeTDC Aurora UI is a governed frontend shell. Browser calls stay read-only or route through the server-side BFF.'
  },
  {
    id: 'msg-assistant',
    role: 'assistant',
    timestamp: Date.now() - 1000 * 60 * 2,
    content: 'Ask for runtime truth, a read-only tool check, EventSpine replay, Phantom BOM review, or a HyperAgent plan path.'
  }
];

export default function App() {
  const [activeMode, setActiveMode] = useState<CanvasMode['id']>('mission');
  const [authenticated, setAuthenticated] = useState(false);
  const [serverReachable, setServerReachable] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [busy, setBusy] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolDefinition>(tools[0]);
  const [toolOutput, setToolOutput] = useState<string>();

  useEffect(() => {
    void getAuthStatus().then((status) => {
      setAuthenticated(status.authenticated);
      setServerReachable(status.serverReachable);
    });
  }, []);

  const activeDescription = useMemo(() => canvasModes.find((mode) => mode.id === activeMode)?.description ?? '', [activeMode]);

  async function handleSend(content: string) {
    const correlationId = createCorrelationId('chat');
    const userMessage: ChatMessage = {
      id: createCorrelationId('msg'),
      role: 'user',
      content,
      timestamp: Date.now(),
      metadata: { correlation_id: correlationId }
    };

    if (!serverReachable) {
      setMessages((current) => [
        ...current,
        userMessage,
        {
          id: createCorrelationId('msg'),
          role: 'assistant',
          content: 'This is a static preview. Token activation and chat routing require the Express BFF deployment; use this preview for visual review only.',
          timestamp: Date.now(),
          metadata: { correlation_id: correlationId }
        }
      ]);
      return;
    }

    setMessages((current) => [...current, userMessage]);
    setBusy(true);

    try {
      const response = await sendChat([
        'Use WidgeTDC claim-safe language.',
        'Do not request raw graph writes or browser secrets.',
        `correlation_id: ${correlationId}`,
        `operator_request: ${content}`
      ].join('\n'));

      setMessages((current) => [
        ...current,
        {
          id: createCorrelationId('msg'),
          role: 'assistant',
          content: response.text ?? (typeof response.result === 'string' ? response.result : response.result ? JSON.stringify(response.result, null, 2) : 'No text response returned from server route.'),
          timestamp: Date.now(),
          metadata: { correlation_id: correlationId }
        }
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown routing error';
      setMessages((current) => [
        ...current,
        {
          id: createCorrelationId('msg'),
          role: 'assistant',
          content: `Server route is not reachable from this static package. Fallback guidance: treat this as a WorkArtifactDraft, use read-only checks only, and route staged/prod actions through HyperAgent. Detail: ${detail}`,
          timestamp: Date.now(),
          metadata: { correlation_id: correlationId }
        }
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function handleActivateToken(token: string) {
    const result = await activateBackendToken(token);
    if (!result.success) {
      throw new Error('Token activation failed.');
    }
    const status = await getAuthStatus();
    setAuthenticated(status.authenticated);
    setServerReachable(status.serverReachable);
  }

  async function handleRunTool(tool: ToolDefinition) {
    const context = defaultGovernanceContext({ evidence_ref: 'frontend:widgetdc-aurora-ui' });

    if (!serverReachable) {
      setToolOutput([
        'Static preview: server-side governed proxy is not reachable from GitHub Pages.',
        `tool: ${tool.name}`,
        'result: deploy the Express BFF to execute read-only checks or staged HyperAgent paths.'
      ].join('\n'));
      return;
    }

    if (!canExecuteFromBrowser(tool)) {
      setToolOutput(buildRejection(tool, context.correlation_id));
      return;
    }

    setToolOutput(`Routing ${tool.name} through server-side governed proxy…\ncorrelation_id: ${context.correlation_id}`);

    try {
      const response = await routeWidgetTool({
        tool: tool.name,
        payload: {
          mode: 'read_only_ui_check',
          requested_from: 'widgetdc-aurora-frontend'
        },
        governance: context
      });
      setToolOutput(JSON.stringify(response, null, 2));
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown routing error';
      setToolOutput([
        `Read-only route not reachable in this local artifact.`,
        `Tool: ${tool.name}`,
        `correlation_id: ${context.correlation_id}`,
        `Detail: ${detail}`
      ].join('\n'));
    }
  }

  function renderWorkspace() {
    switch (activeMode) {
      case 'mission':
        return (
          <div className="workspace-grid wide">
            <MissionControl metrics={platformMetrics} services={services} tools={tools} />
            <GovernancePanel tools={tools} selectedTool={selectedTool} onSelectTool={setSelectedTool} onRunTool={handleRunTool} toolOutput={toolOutput} />
          </div>
        );
      case 'chat':
        return (
          <div className="workspace-grid split">
            <ChatPanel
              messages={messages}
              busy={busy}
              onSend={handleSend}
              authenticated={authenticated}
              serverReachable={serverReachable}
              onActivateToken={handleActivateToken}
            />
            <CanvasView run={phantomRun} claims={claims} events={events} />
          </div>
        );
      case 'phantom':
        return (
          <div className="workspace-grid split">
            <PhantomBomPanel run={phantomRun} />
            <CanvasView run={phantomRun} claims={claims} events={events} />
          </div>
        );
      case 'events':
        return (
          <div className="workspace-grid split">
            <EventSpineTimeline events={events} />
            <GovernancePanel tools={tools} selectedTool={selectedTool} onSelectTool={setSelectedTool} onRunTool={handleRunTool} toolOutput={toolOutput} />
          </div>
        );
      case 'claims':
        return (
          <div className="workspace-grid split">
            <ClaimsPanel claims={claims} />
            <EventSpineTimeline events={events} />
          </div>
        );
      case 'connectors':
        return (
          <div className="workspace-grid split">
            <ConnectorsPanel services={services} tools={tools} />
            <GovernancePanel tools={tools} selectedTool={selectedTool} onSelectTool={setSelectedTool} onRunTool={handleRunTool} toolOutput={toolOutput} />
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="app-shell">
      <TopBar activeMode={activeMode} onModeChange={setActiveMode} modes={canvasModes} authenticated={authenticated} serverReachable={serverReachable} />
      <div className="app-body">
        <LeftRail modes={canvasModes} activeMode={activeMode} onModeChange={setActiveMode} services={services} />
        <main className="workbench" id={activeMode}>
          <div className="workspace-title">
            <span className="section-kicker">{activeMode}</span>
            <p>{activeDescription}</p>
          </div>
          {renderWorkspace()}
        </main>
      </div>
    </div>
  );
}
