import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import NavigationBar from './components/organisms/NavigationBar/NavigationBar';
import HomeDashboardView from './components/HomeDashboardView';
import BusinessManagementView from './components/BusinessManagementView';
import NewsStorageView from './components/NewsStorageView';
import JobsView from './components/JobsView';
import CandidateProfileView from './components/CandidateProfileView';
import EmployerJobsView from './components/EmployerJobsView';
import ChatControlView from './components/ChatControlView';
import AuthView from './components/AuthView';
import ResetPasswordView from './components/ResetPasswordView';
import EditProfileView from './components/EditProfileView';
import FavoritesView from './components/FavoritesView';
import MyBusinessesView from './components/MyBusinessesView';
import BusinessDetailView from './components/BusinessDetailView';
import ChatbotAvatar from './components/ChatbotAvatar';
import HyperspaceBackground from './components/HyperspaceBackground';
import AdminPortal from './pages/AdminPortal';

function App() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        setCurrentUser(user);
      } catch (e) {
        console.error('Invalid user data:', e);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setShowAuthModal(false);

    if (user.role === 'admin') {
      window.location.href = '/admin';
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
  };

  const handleShowAuth = (mode = 'login') => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  const handleShowEditProfile = () => {
    setShowEditModal(true);
  };

  const handleUpdateSuccess = (updatedUser) => {
    setCurrentUser(updatedUser);
  };

  return (
    <BrowserRouter>
      <Routes>
 
        <Route path="/reset-password" element={<ResetPasswordView />} />

        <Route
          path="/admin"
          element={
            <AdminPortal 
              currentUser={currentUser} 
              onLogout={handleLogout}
            />
          } 
        />

        <Route 
          path="/*" 
          element={
            <>
              <MainApp 
                currentUser={currentUser} 
                onLogout={handleLogout}
                onShowAuth={handleShowAuth}
                onShowEditProfile={handleShowEditProfile}
              />
 
              {showAuthModal && (
                <div className="auth-modal-overlay" onClick={() => setShowAuthModal(false)}>
                  <div className="auth-modal-wrapper" onClick={(e) => e.stopPropagation()}>
                    <button className="auth-modal-close" onClick={() => setShowAuthModal(false)}>✕</button>
                    <AuthView onLoginSuccess={handleLoginSuccess} initialMode={authModalMode} />
                  </div>
                </div>
              )}
 
              {showEditModal && (
                <EditProfileView
                  currentUser={currentUser}
                  onClose={() => setShowEditModal(false)}
                  onUpdateSuccess={handleUpdateSuccess}
                />
              )}
            </>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

const SPLASH_SEEN_KEY = 'hyperspaceBackgroundSeen';
// Past this many px of scroll, the navbar switches to its compact style.
const HEADER_COMPACT_THRESHOLD = 80;

function MainApp({ currentUser, onLogout, onShowAuth, onShowEditProfile }) {

  const [showSplash, setShowSplash] = useState(() => !localStorage.getItem(SPLASH_SEEN_KEY));

  const handleSplashFinish = () => {
    localStorage.setItem(SPLASH_SEEN_KEY, '1');
    setShowSplash(false);
  };

  // Draggable (and throwable) floating chat button. Intentionally in-memory
  // only (not localStorage) — a reload should always snap it back to the
  // default bottom-right corner rather than remembering where it landed.
  const [chatBtnPos, setChatBtnPos] = useState(null); // null = default CSS corner
  const chatBtnDragRef = useRef({
    dragging: false, moved: false, offsetX: 0, offsetY: 0,
    lastX: 0, lastY: 0, lastT: 0, vx: 0, vy: 0,
  });
  const chatBtnFlingRef = useRef(null); // requestAnimationFrame id of the in-flight throw

  const handleChatBtnPointerDown = (e) => {
    if (chatBtnFlingRef.current) {
      cancelAnimationFrame(chatBtnFlingRef.current);
      chatBtnFlingRef.current = null;
    }
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const now = performance.now();
    chatBtnDragRef.current = {
      dragging: true, moved: false,
      offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top,
      lastX: e.clientX, lastY: e.clientY, lastT: now, vx: 0, vy: 0,
    };
    el.setPointerCapture(e.pointerId);
  };

  const handleChatBtnPointerMove = (e) => {
    const state = chatBtnDragRef.current;
    if (!state.dragging) return;
    state.moved = true;
    const el = e.currentTarget;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const x = Math.min(Math.max(0, e.clientX - state.offsetX), window.innerWidth - w);
    const y = Math.min(Math.max(0, e.clientY - state.offsetY), window.innerHeight - h);
    setChatBtnPos({ x, y });

    // Track velocity (px/ms) from recent pointer movement so release can
    // fling the button onward instead of just dropping it in place.
    const now = performance.now();
    const dt = Math.max(1, now - state.lastT);
    state.vx = (e.clientX - state.lastX) / dt;
    state.vy = (e.clientY - state.lastY) / dt;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    state.lastT = now;
  };

  const handleChatBtnPointerUp = () => {
    const state = chatBtnDragRef.current;
    state.dragging = false;
    if (!state.moved) {
      setIsChatOpen(true);
      return;
    }

    // Throw physics: keep coasting on the last tracked velocity, bouncing
    // off the viewport edges with energy loss, and decaying from friction
    // until it's slow enough to just settle in place.
    const FRICTION = 0.985;
    const BOUNCE_DAMPING = 0.6;
    const STOP_SPEED = 0.02; // px/ms
    let vx = state.vx * 16; // px/frame at ~60fps
    let vy = state.vy * 16;
    const BTN_SIZE = 64;

    const step = () => {
      setChatBtnPos((prev) => {
        const cur = prev || { x: window.innerWidth - BTN_SIZE - 24, y: window.innerHeight - BTN_SIZE - 24 };
        let nx = cur.x + vx;
        let ny = cur.y + vy;
        const maxX = window.innerWidth - BTN_SIZE;
        const maxY = window.innerHeight - BTN_SIZE;

        if (nx < 0) { nx = 0; vx = -vx * BOUNCE_DAMPING; }
        else if (nx > maxX) { nx = maxX; vx = -vx * BOUNCE_DAMPING; }
        if (ny < 0) { ny = 0; vy = -vy * BOUNCE_DAMPING; }
        else if (ny > maxY) { ny = maxY; vy = -vy * BOUNCE_DAMPING; }

        return { x: nx, y: ny };
      });

      vx *= FRICTION;
      vy *= FRICTION;

      if (Math.hypot(vx, vy) > STOP_SPEED) {
        chatBtnFlingRef.current = requestAnimationFrame(step);
      } else {
        chatBtnFlingRef.current = null;
      }
    };

    if (Math.hypot(vx, vy) > STOP_SPEED) {
      chatBtnFlingRef.current = requestAnimationFrame(step);
    }
  };

  useEffect(() => {
    return () => {
      if (chatBtnFlingRef.current) cancelAnimationFrame(chatBtnFlingRef.current);
    };
  }, []);

  const [activeTab, setActiveTab] = useState('home');
  // Set by the chatbot's "Thêm doanh nghiệp ngay" action button so the
  // business tab opens straight into the create-business modal.
  const [autoOpenBusinessCreate, setAutoOpenBusinessCreate] = useState(false);
  // Shrinks the navbar to a compact bar with a shadow once the active
  // tab's own scroll container (.main-content-area) passes the threshold.
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const workspaceRef = useRef(null);

  // Every tab view renders its own `.main-content-area` as the real scroll
  // container (the wrapper below it has overflow: hidden), so this has to
  // re-query and re-attach whenever the active tab swaps that node out.
  useEffect(() => {
    const scrollEl = workspaceRef.current?.querySelector('.main-content-area');
    if (!scrollEl) return;

    let compact = false;
    const handleScroll = () => {
      const next = scrollEl.scrollTop > HEADER_COMPACT_THRESHOLD;
      if (next === compact) return;
      compact = next;
      setIsHeaderCompact(next);
    };

    scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener('scroll', handleScroll);
      setIsHeaderCompact(false);
    };
  }, [activeTab]);

  const [isChatOpen, setIsChatOpen] = useState(false);
 
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [isEnriching, setIsEnriching] = useState(false);
  const [allBusinesses, setAllBusinesses] = useState([]);
  const [isFetchBusinessLoading, setIsFetchBusinessLoading] = useState(true);
 
  const [allNews, setAllNews] = useState([]);
  const [isFetchNewsLoading, setIsFetchNewsLoading] = useState(true);
  const [newsSearchQuery, setNewsSearchQuery] = useState('');
  const [openNewsId, setOpenNewsId] = useState(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState(null);
  const [pendingJobDetail, setPendingJobDetail] = useState(null);

  const openBusinessDetail = (businessId) => {
    setSelectedBusinessId(businessId);
  };

  // Opening a job from inside the business-detail modal: close that modal,
  // switch to the Tuyển Dụng tab, and hand the job straight to JobsView so
  // it opens the same detail modal it would show from its own list —
  // JobsView owns `selectedJob` internally, so this is a one-shot handoff
  // it consumes and clears (see onConsumePendingJobDetail below).
  const openJobDetailFromBusiness = (job) => {
    setSelectedBusinessId(null);
    setActiveTab('jobs');
    setPendingJobDetail(job);
  };
 
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [messages, setMessages] = useState([
    { id: Date.now(), sender: 'ai', text: 'Chào bạn! 👋 Em là Company đây, chuyên tìm việc, soi nhà tuyển dụng và cập nhật tin tức nghề nghiệp cho bạn. Hỏi em bất cứ điều gì nha! 😄' }
  ]);
 
  const fetchAllNews = async () => {
    try {
      setIsFetchNewsLoading(true);

      // /api/news caps page_size at 1000 — station_news already has 1357+
      // rows and keeps growing (auto-crawl every 30 min), so a single fetch
      // silently drops the oldest articles. That's exactly why searching for
      // a title that genuinely exists in the DB could come back empty: it
      // was simply never loaded into this page's state. Page through
      // everything instead of trusting one request to cover it all.
      const PAGE_SIZE = 1000;
      let allRows = [];
      let page = 1;
      let totalPages = 1;
      do {
        const resp = await fetch(`/api/news?page=${page}&page_size=${PAGE_SIZE}&published_only=true`);
        if (!resp.ok) break;
        const pageData = await resp.json();
        allRows = allRows.concat(pageData.data || []);
        totalPages = pageData.total_pages || 1;
        page += 1;
      } while (page <= totalPages);

      const mappedNews = allRows.map(news => ({
        id: news.id,
        tieu_de: news.title,
        tom_tat: news.summary,
        nha_dai: news.source,
        vung_mien: news.region,
        chuyen_muc: news.category,
        created_at: news.created_at,
        url: news.url,
        anh_dai_dien: news.image,
        thoi_gian_dang: news.published_at,
        tu_khoa: news.keywords,
        do_tin_cay: news.trust_score,
        trang_thai: news.status
      }));

      const sortedNews = mappedNews.sort((a, b) => {
        const dateA = new Date(a.created_at || a.thoi_gian_dang || 0);
        const dateB = new Date(b.created_at || b.thoi_gian_dang || 0);
        return dateB - dateA;
      });

      console.log('📰 Đã tải tin tức:', sortedNews.length, 'bài');
      if (sortedNews.length > 0) {
        console.log('📅 Tin mới nhất:', sortedNews[0].tieu_de, '- Thời gian:', sortedNews[0].created_at);
        console.log('📅 Tin cũ nhất:', sortedNews[sortedNews.length - 1].tieu_de, '- Thời gian:', sortedNews[sortedNews.length - 1].created_at);
      }

      setAllNews(sortedNews);
    } catch (error) {
      console.error("Lỗi lấy danh sách bài viết từ Supabase:", error);
    } finally {
      setIsFetchNewsLoading(false);
    }
  };
 
  const fetchAllBusinesses = async () => {
    try {
      setIsFetchBusinessLoading(true);
      const response = await fetch('/api/businesses?page=1&page_size=100');
      if (response.ok) {
        const data = await response.json();
        setAllBusinesses(data.data || []);
        setSearchQuery('');
        setRegionFilter('all');
      }
    } catch (error) {
      console.error("Lỗi lấy danh sách doanh nghiệp:", error);
    } finally {
      setIsFetchBusinessLoading(false);
    }
  };
 
  useEffect(() => {
    fetchAllNews();
    fetchAllBusinesses();
  }, []);
 
  const handleClearSearch = () => { setSearchQuery(''); setRegionFilter('all'); };
 
  const handleSimulateRawInput = async () => {
    if (isEnriching) return;
    setIsEnriching(true);

    try {
      const response = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: "" }) 
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Cào thành công:", result);

        await fetchAllBusinesses();
      }
    } catch (error) {
      console.error("❌ Lỗi khi cào doanh nghiệp:", error);
    } finally {
      setIsEnriching(false);
    }
  };
 
  const simulateStreaming = (text, suggestedNews = [], suggestedBusinesses = [], actionButtons = [], followupSuggestions = [], onComplete = null) => {
 
    const msgId = Date.now() + Math.random();
    setMessages(prev => [...prev, { 
      id: msgId, 
      sender: 'ai', 
      text: text,
      suggestedNews: suggestedNews,
      suggestedBusinesses: suggestedBusinesses,
      actionButtons: actionButtons,
      followupSuggestions: followupSuggestions  // Add followup suggestions
    }]);
    
    setIsChatLoading(false);

    if (onComplete) {
      setTimeout(onComplete, 100);
    }
  };
 
  // Session management for conversation memory
  const [sessionId, setSessionId] = useState(() => {
    let id = localStorage.getItem('chat_session_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('chat_session_id', id);
    }
    return id;
  });

  // chat_session_id lives in localStorage so a page reload keeps the same
  // conversation going — but MainApp never remounts across login/logout
  // (same route, same component instance), so without this, a shared
  // device would carry one identity's chat history straight into the
  // next: user A logs out, user B logs in (or stays anonymous) on the same
  // browser, and the backend — which only keys history by session_id —
  // would keep answering with A's context. Reset the session on any
  // identity change (login, logout, or switching accounts).
  const prevUserIdRef = useRef(currentUser?.id ?? null);
  useEffect(() => {
    const nextUserId = currentUser?.id ?? null;
    if (prevUserIdRef.current === nextUserId) return;
    prevUserIdRef.current = nextUserId;

    const freshId = crypto.randomUUID();
    localStorage.setItem('chat_session_id', freshId);
    setSessionId(freshId);
    setMessages([
      { id: Date.now(), sender: 'ai', text: 'Chào bạn! 👋 Em là Company đây, chuyên tìm việc, soi nhà tuyển dụng và cập nhật tin tức nghề nghiệp cho bạn. Hỏi em bất cứ điều gì nha! 😄' }
    ]);
  }, [currentUser]);

  // Extracted from handleSendChat so dashboard quick-actions can fire a
  // message straight into the chat (already sent, just waiting on the AI)
  // without needing a form submit event.
  const sendChatMessage = async (userText, actionButtonId = null) => {
    if (!userText.trim() || isChatLoading) return;

    setMessages(prev => [...prev, { id: Date.now() + Math.random(), sender: 'user', text: userText }]);
    setIsChatLoading(true);

    try {
      const requestBody = { 
        message: userText,
        session_id: sessionId  // Add session ID for conversation memory
      };
      if (actionButtonId) {
        requestBody.action_button_id = actionButtonId;
      }

      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();

        // Update session_id if backend created a new one
        if (data.session_id && data.session_id !== sessionId) {
          setSessionId(data.session_id);
          localStorage.setItem('chat_session_id', data.session_id);
        }

        let reply = data.answer || "Company đã xử lý yêu cầu của bạn.";
 
        simulateStreaming(
          reply, 
          data.suggested_news || [], 
          data.suggested_businesses || [],
          data.action_buttons || [],
          data.followup_suggestions || [],  // Add followup suggestions
          () => {
    
            if (data.suggested_news && data.suggested_news.length > 0) {
              fetchAllNews();
            }
          }
        );
      } else {
        const errorText = await response.text();
        throw new Error('API call failed');
      }
    } catch (error) {
      let reply = `Xin lỗi, Company gặp sự cố khi xử lý yêu cầu "${userText}". Backend có thể chưa chạy hoặc có lỗi kết nối.`;
      setTimeout(() => {
        simulateStreaming(reply, [], [], [], []);
      }, 500);
    }
  };

  const handleSendChat = (e, actionButtonId = null) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    const userText = chatInput.trim();
    setChatInput('');
    sendChatMessage(userText, actionButtonId);
  };

  // Opens the chat popup with a prompt already sent — used by the home
  // dashboard's "Bạn muốn AI làm gì?" quick-action cards so the user lands
  // straight on the typing indicator instead of an empty input.
  const openChatWithPrompt = (prompt) => {
    setIsChatOpen(true);
    sendChatMessage(prompt);
  };

  // Clear conversation function
  const clearConversation = async () => {
    try {
      await fetch(`/api/chat/conversation/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Generate new session
      const newId = crypto.randomUUID();
      setSessionId(newId);
      localStorage.setItem('chat_session_id', newId);
      
      // Clear UI
      setMessages([]);
      
      alert('✅ Đã xóa lịch sử chat!');
    } catch (error) {
      console.error('Clear error:', error);
      alert('❌ Lỗi khi xóa chat');
    }
  };

  return (
    <div className="dashboard-master-container">
      {showSplash && <HyperspaceBackground onFinish={handleSplashFinish} />}
      <NavigationBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
        currentUser={currentUser}
        onLogout={onLogout}
        onShowAuth={onShowAuth}
        onShowEditProfile={onShowEditProfile}
        isCompact={isHeaderCompact}
      />

      <div className="dynamic-workspace-layout" ref={workspaceRef}>
        {activeTab === 'home' && (
          <HomeDashboardView
            currentUser={currentUser}
            allBusinesses={allBusinesses}
            allNews={allNews}
            isFetchBusinessLoading={isFetchBusinessLoading}
            isFetchNewsLoading={isFetchNewsLoading}
            onOpenChatWithPrompt={openChatWithPrompt}
            onGoToBusiness={(bizName) => {
              if (bizName) setSearchQuery(bizName);
              setActiveTab('business');
            }}
            onGoToJobs={() => setActiveTab('jobs')}
            onGoToProfile={() => setActiveTab('candidate-profile')}
            onGoToNews={(newsTitle, newsId) => {
              if (newsId) setOpenNewsId(newsId);
              else if (newsTitle) setNewsSearchQuery(newsTitle);
              setActiveTab('news');
            }}
            onOpenBusinessDetail={openBusinessDetail}
            onOpenJob={openJobDetailFromBusiness}
            onShowAuth={onShowAuth}
          />
        )}

        {activeTab === 'business' && (
          <BusinessManagementView
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            regionFilter={regionFilter}
            setRegionFilter={setRegionFilter}
            handleClearSearch={handleClearSearch}
            allBusinesses={allBusinesses}
            allNews={allNews}
            isLoading={isFetchBusinessLoading}
            isEnriching={isEnriching}
            handleSimulateRawInput={handleSimulateRawInput}
            onRefresh={fetchAllBusinesses}
            currentUser={currentUser}
            onOpenBusinessDetail={openBusinessDetail}
            autoOpenCreate={autoOpenBusinessCreate}
            onAutoOpenHandled={() => setAutoOpenBusinessCreate(false)}
          />
        )}

        {activeTab === 'jobs' && (
          <JobsView
            onOpenBusinessDetail={openBusinessDetail}
            currentUser={currentUser}
            onShowAuth={onShowAuth}
            pendingJobDetail={pendingJobDetail}
            onConsumePendingJobDetail={() => setPendingJobDetail(null)}
          />
        )}

        {activeTab === 'news' && (
          <NewsStorageView
            allNews={allNews}
            isFetchNewsLoading={isFetchNewsLoading}
            fetchAllNews={fetchAllNews}
            newsSearchQuery={newsSearchQuery}
            setNewsSearchQuery={setNewsSearchQuery}
            openNewsId={openNewsId}
            onOpenNewsIdHandled={() => setOpenNewsId(null)}
            onNewsClick={() => setIsChatOpen(false)}
          />
        )}

        {activeTab === 'favorites' && (
          <FavoritesView currentUser={currentUser} />
        )}

        {activeTab === 'my-businesses' && (
          <MyBusinessesView currentUser={currentUser} allNews={allNews} onOpenBusinessDetail={openBusinessDetail} />
        )}

        {activeTab === 'candidate-profile' && (
          <CandidateProfileView currentUser={currentUser} />
        )}

        {activeTab === 'employer-jobs' && (
          <EmployerJobsView currentUser={currentUser} />
        )}
      </div>

      {selectedBusinessId && (
        <BusinessDetailView
          businessId={selectedBusinessId}
          currentUser={currentUser}
          onClose={() => setSelectedBusinessId(null)}
          onShowAuth={onShowAuth}
          onDeleted={() => fetchAllBusinesses()}
          onOpenJob={openJobDetailFromBusiness}
        />
      )}

      {/* Floating Chat Button - draggable anywhere on screen, snaps back to
          the default bottom-right corner on reload (position isn't persisted). */}
      {!isChatOpen && (
        <button
          className="floating-chat-button"
          style={chatBtnPos ? { left: chatBtnPos.x, top: chatBtnPos.y, right: 'auto', bottom: 'auto' } : undefined}
          onPointerDown={handleChatBtnPointerDown}
          onPointerMove={handleChatBtnPointerMove}
          onPointerUp={handleChatBtnPointerUp}
          title="Chat với Company"
        >
          <div className="floating-chat-avatar-wrapper">
            <ChatbotAvatar className="floating-chat-avatar" />
          </div>
        </button>
      )}
 
      {isChatOpen && (
        <div className="chat-popup-container">
          <div className="chat-popup-header">
            <div className="chat-popup-title">
              <div className="chat-popup-icon">
                <ChatbotAvatar className="chat-popup-avatar" />
              </div>
              <div>
                <h3>Company trợ lý</h3>
                <p>hãy hỏi khi cần trợ giúp</p>
              </div>
            </div>
            <button className="chat-popup-close" onClick={() => setIsChatOpen(false)}>✕</button>
          </div>
          <div className="chat-popup-content">
            <ChatControlView
              messages={messages}
              isChatLoading={isChatLoading}
              chatInput={chatInput}
              setChatInput={setChatInput}
              handleSendChat={handleSendChat}
              sendChatMessage={sendChatMessage}
              clearConversation={clearConversation}
              onNewsClick={(newsTitle) => {
                setNewsSearchQuery(newsTitle);
                setActiveTab('news');
              }}
              onBusinessCardClick={(bizName) => {
                setSearchQuery(bizName);
                setActiveTab('business');
              }}
              onActionButtonClick={(actionButton) => {
                if (actionButton.id === 'open_add_business') {
                  if (!currentUser) { onShowAuth('login'); return; }
                  setActiveTab('business');
                  setAutoOpenBusinessCreate(true);
                  setIsChatOpen(false);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
