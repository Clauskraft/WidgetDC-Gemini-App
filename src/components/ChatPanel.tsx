import { useState } from 'react';
import type { ChatMessage } from '../types/widgetdc';
import { formatTime } from '../utils/ids';

interface ChatPanelProps {
  messages: ChatMessage[];
  busy: boolean;
  onSend: (message: string) => Promise<void>;
}

export function ChatPanel({ messages, busy, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState('');

  async function submit() {
    const value = draft.trim();
    if (!value || busy) return;
    setDraft('');
    await onSend(value);
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
          placeholder="Ask for a governed summary, read-only health check, EventSpine replay, or Phantom BOM plan…"
        />
        <button className="primary-action" onClick={() => void submit()} disabled={busy || !draft.trim()}>
          {busy ? 'Routing…' : 'Send'}
        </button>
      </div>
    </section>
  );
}
