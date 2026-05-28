import { useState } from 'react';
import type { ChatMessage } from '../types/widgetdc';
import { formatTime } from '../utils/ids';

interface ChatPanelProps {
  messages: ChatMessage[];
  busy: boolean;
  onSend: (message: string) => Promise<void>;
  authenticated: boolean;
  serverReachable: boolean;
  onActivateToken: (token: string) => Promise<void>;
}

export function ChatPanel({ messages, busy, onSend, authenticated, serverReachable, onActivateToken }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [tokenDraft, setTokenDraft] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string>();

  async function submit() {
    const value = draft.trim();
    if (!value || busy || !serverReachable) return;
    setDraft('');
    await onSend(value);
  }

  async function activateToken() {
    const value = tokenDraft.trim();
    if (!value || authBusy || !serverReachable) return;
    setAuthBusy(true);
    setAuthMessage(undefined);
    try {
      await onActivateToken(value);
      setTokenDraft('');
      setAuthMessage('Token activated for this server session.');
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Token activation failed.');
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <div>
          <div className="section-kicker">Captain chat</div>
          <h2>Gemini + WidgeTDC routed assistant</h2>
        </div>
        <span className="pill">no browser key</span>
      </div>

      {!serverReachable && (
        <div className="notice-panel warn">
          This public preview is static. Token activation and chat routing require a full-stack deployment with the Express BFF running.
        </div>
      )}

      {serverReachable && !authenticated && (
        <div className="token-activation">
          <input
            type="password"
            value={tokenDraft}
            onChange={(event) => setTokenDraft(event.target.value)}
            placeholder="Paste operator bearer token"
            autoComplete="off"
          />
          <button className="secondary-action" onClick={() => void activateToken()} disabled={authBusy || !tokenDraft.trim()}>
            {authBusy ? 'Activating' : 'Activate token'}
          </button>
        </div>
      )}

      {authMessage && <div className="notice-panel">{authMessage}</div>}

      <div className="messages custom-scrollbar">
        {messages.map((message) => (
          <article className={`message ${message.role}`} key={message.id}>
            <div className="message-meta">
              <strong>{message.role === 'assistant' ? 'CaptainGPT' : message.role === 'system' ? 'System' : 'Operator'}</strong>
              <span>{formatTime(message.timestamp)}</span>
            </div>
            <p>{message.content}</p>
            {message.metadata?.correlation_id && (
              <code>{message.metadata.correlation_id}</code>
            )}
          </article>
        ))}
      </div>

      <div className="chat-input-wrap">
        <textarea
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              void submit();
            }
          }}
          placeholder={serverReachable ? 'Ask for a governed summary, read-only health check, EventSpine replay, or Phantom BOM plan…' : 'Static preview: deploy the Express BFF to enable chat routing.'}
          disabled={!serverReachable}
        />
        <button className="primary-action" onClick={() => void submit()} disabled={busy || !draft.trim() || !serverReachable}>
          {busy ? 'Routing…' : 'Send'}
        </button>
      </div>
    </section>
  );
}
