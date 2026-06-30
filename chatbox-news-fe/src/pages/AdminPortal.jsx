import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboardView from '../components/AdminDashboardView';
import AdminUsersView from '../components/AdminUsersView';
import LogfireView from '../components/LogfireView';
import AdminNewsView from '../components/AdminNewsView';
import AdminBusinessView from '../components/AdminBusinessView';
import { BarChart3, LogOut, Home, Users, Activity, Newspaper, Building2 } from 'lucide-react';

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
            className={`admin-nav-item ${activeSection === 'news' ? 'active' : ''}`}
            onClick={() => setActiveSection('news')}
          >
            <Newspaper size={20} />
            <span>News Management</span>
          </button>
          
          <button
            className={`admin-nav-item ${activeSection === 'business' ? 'active' : ''}`}
            onClick={() => setActiveSection('business')}
          >
            <Building2 size={20} />
            <span>Business Management</span>
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
      </aside>
 
      <main className="admin-content">
        {activeSection === 'dashboard' && <AdminDashboardView />}
        {activeSection === 'users' && <AdminUsersView />}
        {activeSection === 'news' && <AdminNewsView />}
        {activeSection === 'business' && <AdminBusinessView />}
        {activeSection === 'logfire' && <LogfireView />}
      </main>
    </div>
  );
};

export default AdminPortal;
