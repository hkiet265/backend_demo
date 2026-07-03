import { Building2, Newspaper, LogOut, User, Settings, ChevronDown, Heart, Briefcase, Menu, X } from 'lucide-react';
import { useState } from 'react';
import UnifiedNotificationBell from './UnifiedNotificationBell';

function NavigationBar({ activeTab, setActiveTab, isChatOpen, setIsChatOpen, currentUser, onLogout, onShowAuth, onShowEditProfile }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setShowMobileMenu(false);
  };

  return (
    <nav className="premium-navbar">
      <div className="nav-branding">
        <div className="nav-logo-glow">
          <img src="/emtu2.0.png" alt="Em Tư" className="nav-logo-image" />
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

          {currentUser && (
            <>
              <button 
                className={`nav-tab-item ${activeTab === 'favorites' ? 'active' : ''}`}
                onClick={() => setActiveTab('favorites')}
              >
                <Heart size={16} /> Yêu Thích
              </button>
              
              <button 
                className={`nav-tab-item ${activeTab === 'my-businesses' ? 'active' : ''}`}
                onClick={() => setActiveTab('my-businesses')}
              >
                <Briefcase size={16} /> DN Của Tôi
              </button>
            </>
          )}
        </div>
      </div>

      <div className="nav-right-section">
        {/* Notification Bell - visible on both desktop and mobile */}
        {currentUser && <UnifiedNotificationBell currentUser={currentUser} />}
        
        {/* Hamburger button - mobile only */}
        <button 
          className="mobile-menu-btn"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
        >
          {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Desktop: show normal buttons */}
        <div className="nav-desktop-actions">
          {currentUser ? (
            <>
              <button 
                className="nav-chat-button"
                onClick={() => setIsChatOpen(!isChatOpen)}
              >
                <img src="/emtu2.0.png" alt="Em Tư" className="nav-chat-icon" />
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
                <img src="/emtu2.0.png" alt="Em Tư" className="nav-chat-icon" />
                <span>Hãy Hỏi Em Tư</span>
              </button>

              <button className="nav-login-btn" onClick={onShowAuth}>
                <span>Đăng nhập</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile menu dropdown - positioned on the right side */}
      {showMobileMenu && (
        <>
          <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)} />
          <div className="mobile-menu-dropdown">
            <button 
              className={`mobile-menu-item ${activeTab === 'business' ? 'active' : ''}`}
              onClick={() => handleTabChange('business')}
            >
              <Building2 size={18} />
              <span>Em Tư Doanh Nghiệp</span>
            </button>
            
            <button 
              className={`mobile-menu-item ${activeTab === 'news' ? 'active' : ''}`}
              onClick={() => handleTabChange('news')}
            >
              <Newspaper size={18} />
              <span>Em Tư Tin Tức</span>
            </button>

            {currentUser && (
              <>
                <button 
                  className={`mobile-menu-item ${activeTab === 'favorites' ? 'active' : ''}`}
                  onClick={() => handleTabChange('favorites')}
                >
                  <Heart size={18} />
                  <span>Yêu Thích</span>
                </button>
                
                <button 
                  className={`mobile-menu-item ${activeTab === 'my-businesses' ? 'active' : ''}`}
                  onClick={() => handleTabChange('my-businesses')}
                >
                  <Briefcase size={18} />
                  <span>DN Của Tôi</span>
                </button>
              </>
            )}

            {/* Divider */}
            <div className="mobile-menu-divider"></div>

            {/* Action buttons inside dropdown */}
            {currentUser ? (
              <>
                <button 
                  className="mobile-menu-item mobile-menu-action"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setIsChatOpen(!isChatOpen);
                  }}
                >
                  <img src="/emtu2.0.png" alt="Em Tư" className="mobile-menu-avatar" />
                  <span>Hãy Hỏi Em Tư</span>
                </button>

                <button 
                  className="mobile-menu-item mobile-menu-action"
                  onClick={() => {
                    setShowMobileMenu(false);
                    onShowEditProfile();
                  }}
                >
                  <Settings size={18} />
                  <span>Chỉnh sửa hồ sơ</span>
                </button>

                <button 
                  className="mobile-menu-item mobile-menu-action mobile-menu-logout"
                  onClick={() => {
                    setShowMobileMenu(false);
                    onLogout();
                  }}
                >
                  <LogOut size={18} />
                  <span>Đăng xuất</span>
                </button>
              </>
            ) : (
              <>
                <button 
                  className="mobile-menu-item mobile-menu-action"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setIsChatOpen(!isChatOpen);
                  }}
                >
                  <img src="/emtu2.0.png" alt="Em Tư" className="mobile-menu-avatar" />
                  <span>Hãy Hỏi Em Tư</span>
                </button>

                <button 
                  className="mobile-menu-item mobile-menu-action mobile-menu-login"
                  onClick={() => {
                    setShowMobileMenu(false);
                    onShowAuth();
                  }}
                >
                  <User size={18} />
                  <span>Đăng nhập</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </nav>
  );
}

export default NavigationBar;

