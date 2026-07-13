import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send } from 'lucide-react';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

const POLL_INTERVAL_MS = 4000;

/**
 * Message thread modal for one (jobId, candidateUserId) conversation.
 * Polls for new messages every few seconds while open — no WebSocket
 * infra in this project yet, and polling is plenty for a low-traffic
 * employer<->candidate chat.
 */
function ChatThread({ jobId, candidateUserId, currentUserId, title, subtitle, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(`/api/messages/jobs/${jobId}/candidates/${candidateUserId}`, { headers: authHeaders() });
      if (!response.ok) return;
      const data = await response.json();
      setMessages(data.data || []);
    } catch (error) {
      console.error('Fetch messages failed:', error);
    }
  }, [jobId, candidateUserId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content) return;
    setIsSending(true);
    setInput('');
    try {
      const response = await fetch(`/api/messages/jobs/${jobId}/candidates/${candidateUserId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ content }),
      });
      if (response.ok) {
        fetchMessages();
      } else {
        setInput(content);
      }
    } catch (error) {
      setInput(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content chat-thread-modal"
        style={{ maxWidth: '480px', width: '92%', height: '70vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: 0, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '2px solid var(--border-neon)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px' }}>{title}</h3>
            {subtitle && <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}><X size={20} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {messages.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px', marginTop: '20px' }}>Chưa có tin nhắn nào. Bắt đầu trò chuyện nhé!</p>
          ) : (
            messages.map(m => {
              const isMine = m.sender_id === currentUserId;
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '75%', padding: '8px 12px', borderRadius: '12px', fontSize: '13.5px',
                    background: isMine ? 'var(--color-primary)' : 'var(--bg-input)',
                    color: isMine ? 'white' : 'var(--text-main)',
                    borderBottomRightRadius: isMine ? '2px' : '12px',
                    borderBottomLeftRadius: isMine ? '12px' : '2px',
                  }}>
                    {!isMine && <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '2px', opacity: 0.8 }}>{m.sender_name}</div>}
                    {m.content}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderTop: '2px solid var(--border-neon)' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập tin nhắn..."
            style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px' }}
          />
          <button
            onClick={handleSend}
            disabled={isSending || !input.trim()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: (isSending || !input.trim()) ? 0.5 : 1 }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatThread;
