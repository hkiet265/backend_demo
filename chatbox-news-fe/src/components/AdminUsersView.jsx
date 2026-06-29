import React, { useState, useEffect } from 'react';
import { Users, RefreshCw, Shield, UserCheck, Calendar, Mail, Phone } from 'lucide-react';

const AdminUsersView = () => {
  const [users, setUsers] = useState([]);
  const [roleStats, setRoleStats] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://127.0.0.1:8000/api/admin/users');
      const data = await response.json();
      
      if (data.status === 'success') {
        setUsers(data.data.users);
        setTotal(data.data.total);
        setRoleStats(data.data.role_stats);
        setLastUpdate(new Date().toLocaleTimeString('vi-VN'));
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  if (loading && users.length === 0) {
    return (
      <div className="admin-users-view loading">
        <div className="loading-spinner">Đang tải danh sách users...</div>
      </div>
    );
  }

  return (
    <div className="admin-users-view">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h2>👥 User Management</h2>
          <p className="subtitle">Quản lý người dùng đã đăng ký</p>
        </div>
        <div className="header-actions">
          <span className="last-update">Cập nhật: {lastUpdate}</span>
          <button onClick={fetchUsers} className="refresh-button" disabled={loading}>
            <RefreshCw size={16} />
            {loading ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon users">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <h3>{total}</h3>
            <p>Tổng Users</p>
          </div>
        </div>

        {roleStats.map((stat, idx) => (
          <div key={idx} className="stat-card">
            <div className={`stat-icon ${stat.role}`}>
              {stat.role === 'admin' ? <Shield size={24} /> : <UserCheck size={24} />}
            </div>
            <div className="stat-content">
              <h3>{stat.count}</h3>
              <p>{stat.role === 'admin' ? 'Admins' : 'Regular Users'}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="users-table-container">
        <div className="table-header">
          <h3>📋 Danh sách Users</h3>
        </div>
        
        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên đầy đủ</th>
                <th>Email</th>
                <th>Số điện thoại</th>
                <th>Role</th>
                <th>Ngày đăng ký</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar-small">
                        {user.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span>{user.full_name}</span>
                    </div>
                  </td>
                  <td>
                    <div className="email-cell">
                      <Mail size={14} />
                      {user.email}
                    </div>
                  </td>
                  <td>
                    <div className="phone-cell">
                      {user.phone ? (
                        <>
                          <Phone size={14} />
                          {user.phone}
                        </>
                      ) : (
                        <span className="no-data">—</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`role-badge ${user.role}`}>
                      {user.role === 'admin' ? '👑 Admin' : '👤 User'}
                    </span>
                  </td>
                  <td>
                    <div className="date-cell">
                      <Calendar size={14} />
                      {new Date(user.created_at).toLocaleDateString('vi-VN')}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && !loading && (
          <div className="empty-state">
            <Users size={64} />
            <p>Chưa có users nào đăng ký</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsersView;
