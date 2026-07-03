import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';

function TypingIndicator() {
  return (
    <div className="chat-bubble-wrapper ai">
      <div className="chat-bubble-content typing-indicator-bubble">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}

function ChatControlView({
  messages,
  isChatLoading,
  chatInput,
  setChatInput,
  handleSendChat,
  onNewsClick,
  onBusinessCardClick
}) {
  const chatEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const checkIfAtBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 100;
  };

  const handleScroll = () => {
    setShowScrollButton(!checkIfAtBottom());
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isChatLoading]);
 
  const handleQuickAction = (actionText) => {
    setChatInput(actionText);
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} };
      handleSendChat(fakeEvent);
    }, 100);
  };
 
  return (
    <div className="full-chat-workspace fade-in-effect">
      <div className="chatbox-messages" ref={messagesContainerRef} onScroll={handleScroll}>
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble-wrapper ${msg.sender}`}>
            <div className="chat-bubble-content">
              <p className="bubble-text" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
 
              {msg.suggestedNews && msg.suggestedNews.length > 0 && (
                <div className="suggested-news-list">
                  <div className="news-list-header">📰 Tin tức liên quan:</div>
                  {msg.suggestedNews.map((news, idx) => (
                    <div
                      key={idx}
                      className="chat-news-card"
                      onClick={() => onNewsClick && onNewsClick(news.tieu_de)}
                      title="Click để xem trong tab Tin Tức"
                    >
                      <div className="chat-news-index">{idx + 1}</div>
                      <div className="chat-news-content">
                        <h4 className="chat-news-title">{news.tieu_de}</h4>
                        {news.tom_tat && <p className="chat-news-summary">{news.tom_tat}</p>}
                        {news.chuyen_muc && <span className="chat-news-badge">{news.chuyen_muc}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
 
              {msg.suggestedBusinesses && msg.suggestedBusinesses.length > 0 && (
                <div className="suggested-news-list">
                  <div className="news-list-header">🏢 Doanh nghiệp phù hợp:</div>
                  <div className="simple-business-list">
                    {msg.suggestedBusinesses.map((biz, idx) => (
                      <div
                        key={idx}
                        className="simple-business-item"
                        onClick={() => onBusinessCardClick && onBusinessCardClick(biz.name)}
                        title="Click để xem trong tab Doanh Nghiệp"
                      >
                        <div>
                          <div className="simple-business-name">
                            {idx + 1}. {biz.name}
                          </div>
                          {biz.location && (
                            <div className="simple-business-location">
                              📍 {biz.location} {biz.region && `· ${biz.region}`}
                            </div>
                          )}
                        </div>
                        <div className="simple-business-phone">
                          📞 {biz.phone || 'Chưa có SĐT'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
 
        {isChatLoading && (
          messages[messages.length - 1]?.sender !== 'ai' || messages[messages.length - 1]?.text === ''
        ) && <TypingIndicator />}

        <div ref={chatEndRef} />
      </div>
 
      <div className="quick-actions-top">
        <button
          className="quick-action-btn-top"
          onClick={() => handleQuickAction('Tìm doanh nghiệp')}
          disabled={isChatLoading}
        >
          🏢 Tìm doanh nghiệp
        </button>
        <button
          className="quick-action-btn-top"
          onClick={() => handleQuickAction('Tìm tin tức')}
          disabled={isChatLoading}
        >
          📰 Tìm tin tức
        </button>
      </div>
 
      {showScrollButton && (
        <button className="scroll-to-bottom-btn" onClick={scrollToBottom} title="Cuộn xuống cuối">
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <polyline points="7 13 12 18 17 13"></polyline>
            <polyline points="7 6 12 11 17 6"></polyline>
          </svg>
        </button>
      )}

      <form onSubmit={handleSendChat} className="chatbox-input-form">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Hãy hỏi Em Tư"
          disabled={isChatLoading}
        />
        <button type="submit" disabled={isChatLoading || !chatInput.trim()}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default ChatControlView;
