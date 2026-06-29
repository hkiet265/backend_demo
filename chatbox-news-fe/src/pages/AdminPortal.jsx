import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboardView from '../components/AdminDashboardView';
import AdminUsersView from '../components/AdminUsersView';
import LogfireView from '../components/LogfireView';
import { BarChart3, LogOut, Home, Users, Activity } from 'lucide-react';

const AdminPortal = ({ currentUser, onLogout }) => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  // Check if user is admin
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="admin-portal-error">
        <div className="error-content">
          <h2>🚫 Access Denied</h2>
          <p>Bạn không có quyền truy cập trang này.</p>
          <button onClick={() => navigate('/')}>Quay về trang chủ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-portal">
      {/* Sidebar Navigation */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <img src="/emtu-avatar.png" alt="Em Tư Admin" />
          </div>
          <h2>Em Tư Admin</h2>
          <p className="admin-subtitle">Control Panel</p>
        </div>

        <nav className="admin-nav">
          <button
            className={`admin-nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveSection('dashboard')}
          >
            <BarChart3 size={20} />
            <span>Dashboard</span>
          </button>
          
          <button
            className={`admin-nav-item ${activeSection === 'users' ? 'active' : ''}`}
            onClick={() => setActiveSection('users')}
          >
            <Users size={20} />
            <span>Users</span>
          </button>
          
          <button
            className={`admin-nav-item ${activeSection === 'logfire' ? 'active' : ''}`}
            onClick={() => setActiveSection('logfire')}
          >
            <Activity size={20} />
            <span>Logfire Monitoring</span>
          </button>
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-footer-btn" onClick={handleBackToHome}>
            <Home size={18} />
            <span>Về trang chủ</span>
          </button>
          <button className="admin-footer-btn logout" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>

        <div className="admin-user-badge">
          <div className="user-avatar">
            {currentUser.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <span className="user-name">{currentUser.full_name}</span>
            <span className="user-role">Administrator</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-content">
        {activeSection === 'dashboard' && <AdminDashboardView />}
        {activeSection === 'users' && <AdminUsersView />}
        {activeSection === 'logfire' && <LogfireView />}
      </main>
    </div>
  );
};

export default AdminPortal;
