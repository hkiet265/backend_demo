import { Home, Building2, Newspaper, LogOut, User, Settings, ChevronDown, Heart, Menu, X, Bookmark } from 'lucide-react';
import { useState } from 'react';
import UnifiedNotificationBell from '../../UnifiedNotificationBell';
import ChatbotAvatar from '../../ChatbotAvatar';
import './NavigationBar.css';

/**
 * Navigation Bar Component (Organism)
 * Main navigation bar for the application
 * 
 * @param {Object} props
 * @param {string} props.activeTab - Current active tab
 * @param {Function} props.setActiveTab - Set active tab
 * @param {boolean} props.isChatOpen - Chat open state
 * @param {Function} props.setIsChatOpen - Set chat open state
 * @param {Object} props.currentUser - Current user object
 * @param {Function} props.onLogout - Logout handler
 * @param {Function} props.onShowAuth - Show auth modal
 * @param {Function} props.onShowEditProfile - Show edit profile
 */
function NavigationBar({ activeTab, setActiveTab, isChatOpen, setIsChatOpen, currentUser, onLogout, onShowAuth, onShowEditProfile, isCompact = false }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setShowMobileMenu(false);
  };

  return (
    <nav className={`premium-navbar${isCompact ? ' is-compact' : ''}`}>
      <div className="navbar-inner">
      <div className="nav-branding">
        <div className="nav-logo-glow">
          <ChatbotAvatar className="nav-logo-image" trackCursor={false} />
        </div>
        <div className="nav-brand-text">
          <h1>Company</h1>
          <p className="nav-description">tuyển dụng thông minh - tin tức cập nhật</p>
        </div>
        
        <div className="nav-tabs-wrapper">
          <button
            className={`nav-tab-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <Home size={16} /> Trang Chủ
          </button>

          <button
            className={`nav-tab-item ${activeTab === 'business' ? 'active' : ''}`}
            onClick={() => setActiveTab('business')}
          >
            <Building2 size={16} /> Doanh Nghiệp
          </button>
          
          <button 
            className={`nav-tab-item ${activeTab === 'news' ? 'active' : ''}`}
            onClick={() => setActiveTab('news')}
          >
            <Newspaper size={16} /> Tin Tức
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
                DN Của Tôi
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
              <div className="nav-user-dropdown">
                <button
                  className="nav-user-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <span className="nav-user-avatar">
                    <User size={16} />
                  </span>
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
              <button className="nav-login-btn" onClick={() => onShowAuth('login')}>
                <span>Đăng nhập</span>
              </button>
            </>
          )}
        </div>
      </div>
      </div>

      {/* Mobile slide-in drawer */}
      {showMobileMenu && (
        <>
          <div className="mobile-drawer-overlay" onClick={() => setShowMobileMenu(false)} />
          <div className="mobile-drawer">
            <div className="mobile-drawer-topbar">
              <button className="mobile-drawer-close" onClick={() => setShowMobileMenu(false)}>
                <X size={22} />
              </button>
            </div>

            <div className="mobile-drawer-profile">
              <ChatbotAvatar className="mobile-drawer-avatar" />
              {currentUser ? (
                <div>
                  <p className="mobile-drawer-greeting">Chào {currentUser.full_name}!</p>
                  <p className="mobile-drawer-subtext">{currentUser.email}</p>
                </div>
              ) : (
                <div>
                  <p className="mobile-drawer-greeting">Chào bạn!</p>
                  <p className="mobile-drawer-subtext">Đăng nhập để trải nghiệm toàn bộ tính năng</p>
                </div>
              )}
            </div>

            {currentUser ? (
              <div className="mobile-drawer-auth-row">
                <button
                  className="mobile-drawer-btn mobile-drawer-btn-outline"
                  onClick={() => { setShowMobileMenu(false); onShowEditProfile(); }}
                >
                  <Settings size={15} /> Chỉnh sửa hồ sơ
                </button>
                <button
                  className="mobile-drawer-btn mobile-drawer-btn-outline mobile-drawer-btn-danger"
                  onClick={() => { setShowMobileMenu(false); onLogout(); }}
                >
                  <LogOut size={15} /> Đăng xuất
                </button>
              </div>
            ) : (
              <div className="mobile-drawer-auth-row">
                <button
                  className="mobile-drawer-btn mobile-drawer-btn-primary"
                  onClick={() => { setShowMobileMenu(false); onShowAuth('login'); }}
                >
                  Đăng nhập
                </button>
                <button
                  className="mobile-drawer-btn mobile-drawer-btn-outline"
                  onClick={() => { setShowMobileMenu(false); onShowAuth('register'); }}
                >
                  Đăng ký
                </button>
              </div>
            )}

            <p className="mobile-drawer-section-title">Truy cập nhanh</p>
            <div className="mobile-drawer-quick-grid">
              <button className="mobile-drawer-quick-item" onClick={() => handleTabChange('news')}>
                <Newspaper size={18} />
                <span>Tin tức</span>
              </button>
              <button className="mobile-drawer-quick-item" onClick={() => handleTabChange('business')}>
                <Building2 size={18} />
                <span>Doanh nghiệp</span>
              </button>
              {currentUser && (
                <>
                  <button className="mobile-drawer-quick-item" onClick={() => handleTabChange('favorites')}>
                    <Heart size={18} />
                    <span>Yêu thích</span>
                  </button>
                  <button className="mobile-drawer-quick-item" onClick={() => handleTabChange('my-businesses')}>
                    <Bookmark size={18} />
                    <span>DN của tôi</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Bottom tab bar - mobile only */}
      <div className="mobile-bottom-tabbar">
        <button className={`bottom-tab-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => handleTabChange('home')}>
          <Home size={20} />
          <span>Trang chủ</span>
        </button>
        <button className={`bottom-tab-item ${activeTab === 'business' ? 'active' : ''}`} onClick={() => handleTabChange('business')}>
          <Building2 size={20} />
          <span>Doanh nghiệp</span>
        </button>
        <button className={`bottom-tab-item ${activeTab === 'news' ? 'active' : ''}`} onClick={() => handleTabChange('news')}>
          <Newspaper size={20} />
          <span>Tin tức</span>
        </button>
        <button
          className={`bottom-tab-item ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => currentUser ? handleTabChange('favorites') : onShowAuth('login')}
        >
          <Heart size={20} />
          <span>Yêu thích</span>
        </button>
        <button className="bottom-tab-item" onClick={() => setShowMobileMenu(true)}>
          <User size={20} />
          <span>Tài khoản</span>
        </button>
      </div>
    </nav>
  );
}

export default NavigationBar;

