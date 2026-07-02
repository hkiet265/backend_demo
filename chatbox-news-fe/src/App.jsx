import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import NavigationBar from './components/NavigationBar';
import BusinessManagementView from './components/BusinessManagementView';
import NewsStorageView from './components/NewsStorageView';
import ChatControlView from './components/ChatControlView';
import AuthView from './components/AuthView';
import EditProfileView from './components/EditProfileView';
import FavoritesView from './components/FavoritesView';
import MyBusinessesView from './components/MyBusinessesView';
import AdminPortal from './pages/AdminPortal';

function App() {
  const [showAuthModal, setShowAuthModal] = useState(false);
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

  const handleShowAuth = () => {
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
                    <AuthView onLoginSuccess={handleLoginSuccess} />
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

function MainApp({ currentUser, onLogout, onShowAuth, onShowEditProfile }) {
 
  const [activeTab, setActiveTab] = useState('business');

  const [isChatOpen, setIsChatOpen] = useState(false);
 
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [isEnriching, setIsEnriching] = useState(false);
  const [allBusinesses, setAllBusinesses] = useState([]);
  const [isFetchBusinessLoading, setIsFetchBusinessLoading] = useState(true);
 
  const [allNews, setAllNews] = useState([]);
  const [isFetchNewsLoading, setIsFetchNewsLoading] = useState(true);
  const [newsSearchQuery, setNewsSearchQuery] = useState('');
 
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [messages, setMessages] = useState([
    { id: Date.now(), sender: 'ai', text: 'Chào bạn! Em là Em Tư đây. Em chuyên giúp bạn tìm tin tức nha. Hỏi em về tin gì cũng được!' }
  ]);
 
  const fetchAllNews = async () => {
    try {
      setIsFetchNewsLoading(true);
      const response = await fetch('/api/news?page=1&page_size=1000');
      if (response.ok) {
        const data = await response.json();
 
        const mappedNews = (data.data || []).map(news => ({
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
      }
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
 
  const simulateStreaming = (text, suggestedNews = [], suggestedBusinesses = [], actionButtons = [], onComplete = null) => {
 
    const msgId = Date.now() + Math.random();
    setMessages(prev => [...prev, { 
      id: msgId, 
      sender: 'ai', 
      text: text,
      suggestedNews: suggestedNews,
      suggestedBusinesses: suggestedBusinesses,
      actionButtons: actionButtons
    }]);
    
    setIsChatLoading(false);

    if (onComplete) {
      setTimeout(onComplete, 100);
    }
  };
 
  const handleSendChat = async (e, actionButtonId = null) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userText = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), sender: 'user', text: userText }]);
    setIsChatLoading(true);

    try {
      const requestBody = { message: userText };
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

        let reply = data.answer || "Em Tư đã xử lý yêu cầu của bạn.";
 
        simulateStreaming(
          reply, 
          data.suggested_news || [], 
          data.suggested_businesses || [],
          data.action_buttons || [],
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
      let reply = `Xin lỗi, Em Tư gặp sự cố khi xử lý yêu cầu "${userText}". Backend có thể chưa chạy hoặc có lỗi kết nối.`;
      setTimeout(() => { 
        simulateStreaming(reply, [], [], []);
      }, 500);
    }
  };

  return (
    <div className="dashboard-master-container">
      <NavigationBar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
        currentUser={currentUser}
        onLogout={onLogout}
        onShowAuth={onShowAuth}
        onShowEditProfile={onShowEditProfile}
      />

      <div className="dynamic-workspace-layout">
        {activeTab === 'business' && (
          <BusinessManagementView
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            regionFilter={regionFilter}
            setRegionFilter={setRegionFilter}
            handleClearSearch={handleClearSearch}
            allBusinesses={allBusinesses}
            isLoading={isFetchBusinessLoading}
            isEnriching={isEnriching}
            handleSimulateRawInput={handleSimulateRawInput}
            onRefresh={fetchAllBusinesses}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'news' && (
          <NewsStorageView
            allNews={allNews}
            isFetchNewsLoading={isFetchNewsLoading}
            fetchAllNews={fetchAllNews}
            newsSearchQuery={newsSearchQuery}
            setNewsSearchQuery={setNewsSearchQuery}
            onNewsClick={() => setIsChatOpen(false)}
          />
        )}

        {activeTab === 'chat' && (
          <ChatControlView
            messages={messages}
            isChatLoading={isChatLoading}
            chatInput={chatInput}
            setChatInput={setChatInput}
            handleSendChat={handleSendChat}
            onNewsClick={(newsTitle) => {
              setNewsSearchQuery(newsTitle);
              setActiveTab('news');
            }}
            onBusinessCardClick={(bizName) => {
              setSearchQuery(bizName);
              setActiveTab('business');
            }}
          />
        )}

        {activeTab === 'favorites' && (
          <FavoritesView currentUser={currentUser} />
        )}

        {activeTab === 'my-businesses' && (
          <MyBusinessesView currentUser={currentUser} />
        )}
      </div>
 
      {isChatOpen && (
        <div className="chat-popup-container">
          <div className="chat-popup-header">
            <div className="chat-popup-title">
              <div className="chat-popup-icon">
                <img src="/emtu-avatar.png" alt="Em Tư" className="chat-popup-avatar" />
              </div>
              <div>
                <h3>Em Tư trợ lý</h3>
                <p>Tìm tin tức kiếm Em Tư</p>
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
              onNewsClick={(newsTitle) => {
                setNewsSearchQuery(newsTitle);
                setActiveTab('news');
                setIsChatOpen(false);
              }}
              onBusinessCardClick={(bizName) => {
                setSearchQuery(bizName);
                setActiveTab('business');
                setIsChatOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
