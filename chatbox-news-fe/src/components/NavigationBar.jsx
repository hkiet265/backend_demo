import { Building2, Newspaper, LogOut, User, Settings, ChevronDown } from 'lucide-react';
import { useState } from 'react';

function NavigationBar({ activeTab, setActiveTab, isChatOpen, setIsChatOpen, currentUser, onLogout, onShowAuth, onShowEditProfile }) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <nav className="premium-navbar">
      <div className="nav-branding">
        <div className="nav-logo-glow">
          <img src="/emtu-avatar.png" alt="Em Tư" className="nav-logo-image" />
        </div>
        <div className="nav-brand-text">
          <h1>Em Tư</h1>
          <p className="nav-description">Tìm tin tức kiếm Em Tư</p>
        </div>
        
        <div className="nav-tabs-wrapper">
          <button 
            className={`nav-tab-item ${activeTab === 'business' ? 'active' : ''}`}
            onClick={() => setActiveTab('business')}
          >
            <Building2 size={16} /> Em Tư Doanh Nghiệp
          </button>
          
          <button 
            className={`nav-tab-item ${activeTab === 'news' ? 'active' : ''}`}
            onClick={() => setActiveTab('news')}
          >
            <Newspaper size={16} /> Em Tư Tin Tức
          </button>
        </div>
      </div>

      <div className="nav-right-section">
        {currentUser ? (
          <>
            <button 
              className="nav-chat-button"
              onClick={() => setIsChatOpen(!isChatOpen)}
            >
              <img src="/emtu-avatar.png" alt="Em Tư" className="nav-chat-icon" />
              <span>Hãy Hỏi Em Tư</span>
            </button>

            <div className="nav-user-dropdown">
              <button 
                className="nav-user-btn" 
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <User size={18} />
                <span className="nav-user-name">{currentUser.full_name}</span>
                <ChevronDown size={16} className={`dropdown-arrow ${showUserMenu ? 'open' : ''}`} />
              </button>

              {showUserMenu && (
                <>
                  <div className="dropdown-overlay" onClick={() => setShowUserMenu(false)} />
                  <div className="nav-user-menu">
                    <button className="menu-item" onClick={() => { setShowUserMenu(false); onShowEditProfile(); }}>
                      <Settings size={16} />
                      <span>Chỉnh sửa</span>
                    </button>
                    <button className="menu-item logout" onClick={() => { setShowUserMenu(false); onLogout(); }}>
                      <LogOut size={16} />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <button 
              className="nav-chat-button"
              onClick={() => setIsChatOpen(!isChatOpen)}
            >
              <img src="/emtu-avatar.png" alt="Em Tư" className="nav-chat-icon" />
              <span>Hãy Hỏi Em Tư</span>
            </button>

            <button className="nav-login-btn" onClick={onShowAuth}>
              <span>Đăng nhập</span>
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

export default NavigationBar;
