import React, { useState, useEffect } from 'react';
import { Users, Shield, UserCheck, Calendar, Mail, Phone, MoreVertical, Edit, Trash2, X } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import Toast from './Toast';
import ConfirmDialog from './ConfirmDialog';

const AdminUsersView = () => {
  const [users, setUsers] = useState([]);
  const [roleStats, setRoleStats] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const adminUsers = users.filter(u => u.role === 'admin');
  const regularUsers = users.filter(u => u.role === 'user'); 

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      
      if (data.status === 'success') {
        setUsers(data.data.users);
        setTotal(data.data.total);
        setRoleStats(data.data.role_stats); 
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    const interval = setInterval(fetchUsers, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleDropdown = (id) => {
    setOpenDropdown(openDropdown === id ? null : id);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.dropdown-menu') && !e.target.closest('.action-btn')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleEdit = (user) => {
    setEditForm({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || '',
      role: user.role
    });
    setShowEditModal(true);
    setOpenDropdown(null);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`/api/admin/users/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editForm.full_name,
          phone: editForm.phone,
          role: editForm.role
        })
      });

      if (response.ok) {
        showToast('Đã cập nhật user thành công!', 'success');
        setShowEditModal(false);
        fetchUsers();
      } else {
        const data = await response.json();
        showToast(data.detail || 'Lỗi khi cập nhật user', 'error');
      }
    } catch (error) {
      console.error('Update error:', error);
      showToast('Lỗi khi cập nhật user', 'error');
    }
  };

  const handleDelete = (id) => {
    setConfirmDelete(id);
    setOpenDropdown(null);
  };

  const confirmDeleteUser = async () => {
    const id = confirmDelete;
    setConfirmDelete(null);

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showToast('Đã xóa user thành công!', 'success');
        fetchUsers();
      } else {
        const data = await response.json();
        showToast(data.detail || 'Lỗi khi xóa user', 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Lỗi khi xóa user', 'error');
    }
  };

  if (loading && users.length === 0) {
    return <LoadingSpinner fullScreen message="Đang tải danh sách users..." />;
  }

  return (
    <div className="admin-users-view"> 
      <div className="dashboard-header">
        <div>
          <h2>👥 User Management</h2>
          <p className="subtitle">Quản lý người dùng đã đăng ký</p>
        </div>
     </div>
 
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
 
      <div className="users-table-container">
        <div className="table-header">
          <h3> Admin Users</h3>
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
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.full_name}</td>
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
                    <span className="role-badge admin">
                      Admin
                    </span>
                  </td>
                  <td>
                    <div className="date-cell">
                      <Calendar size={14} />
                      {new Date(user.created_at).toLocaleDateString('vi-VN')}
                    </div>
                  </td>
                  <td className="actions-cell">
                    <div className="dropdown-wrapper">
                      <button
                        className="action-btn menu"
                        onClick={() => toggleDropdown(user.id)}
                        title="Hành động"
                      >
                        <MoreVertical size={18} />
                      </button>
                      {openDropdown === user.id && (
                        <div className="dropdown-menu">
                          <button
                            className="dropdown-item"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit size={16} />
                            <span>Chỉnh sửa</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {adminUsers.length === 0 && !loading && (
          <div className="empty-state">
            <Shield size={64} />
            <p>Chưa có admin nào</p>
          </div>
        )}
      </div>

      <div className="users-table-container" style={{ marginTop: '32px' }}>
        <div className="table-header">
          <h3>Regular Users</h3>
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
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {regularUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.full_name}</td>
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
                    <span className="role-badge user">
                     User
                    </span>
                  </td>
                  <td>
                    <div className="date-cell">
                      <Calendar size={14} />
                      {new Date(user.created_at).toLocaleDateString('vi-VN')}
                    </div>
                  </td>
                  <td className="actions-cell">
                    <div className="dropdown-wrapper">
                      <button
                        className="action-btn menu"
                        onClick={() => toggleDropdown(user.id)}
                        title="Hành động"
                      >
                        <MoreVertical size={18} />
                      </button>
                      {openDropdown === user.id && (
                        <div className="dropdown-menu">
                          <button
                            className="dropdown-item"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit size={16} />
                            <span>Chỉnh sửa</span>
                          </button>
                          <button
                            className="dropdown-item delete"
                            onClick={() => handleDelete(user.id)}
                          >
                            <Trash2 size={16} />
                            <span>Xóa</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {regularUsers.length === 0 && !loading && (
          <div className="empty-state">
            <Users size={64} />
            <p>Chưa có user nào đăng ký</p>
          </div>
        )}
      </div>
      
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chỉnh sửa user</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Email (không thể thay đổi)</label>
                <input
                  type="email"
                  value={editForm.email}
                  disabled
                  className="form-input"
                  style={{opacity: 0.6, cursor: 'not-allowed'}}
                />
              </div>

              <div className="form-group">
                <label>Tên đầy đủ</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Số điện thoại</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                  className="form-input"
                  placeholder="Nhập số điện thoại"
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                  className="form-input"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowEditModal(false)}>
                  Hủy
                </button>
                <button className="btn-primary" onClick={handleSaveEdit}>
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {confirmDelete && (
        <ConfirmDialog
          title="Xác nhận xóa"
          message="Bạn có chắc chắn muốn xóa user này? Hành động này không thể hoàn tác."
          confirmText="Xóa"
          cancelText="Hủy"
          type="danger"
          onConfirm={confirmDeleteUser}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

export default AdminUsersView;
