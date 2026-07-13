import React, { useState, useEffect, useMemo } from 'react';
import { Users, Shield, UserPlus, Lock, Search, RotateCcw, Download, Eye, Pencil, LockKeyhole, LockOpen, Trash2, X } from 'lucide-react';
import Spinner from './atoms/Spinner';
import Toast from './Toast';
import ConfirmDialog from './molecules/ConfirmDialog/ConfirmDialog';

const CARD_STYLE = {
  background: 'var(--bg-panel)', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '18px 20px', color: 'var(--text-main)'
};

const AVATAR_COLORS = ['#2563EB', '#16A34A', '#D97706', '#7C3AED', '#DB2777', '#0891B2', '#DC2626'];
function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function initials(name) {
  const parts = (name || '').trim().split(/\s+/);
  return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (name || '?').slice(0, 2).toUpperCase();
}

const STATUS_META = {
  active: { label: 'Hoạt động', color: '#16A34A' },
  pending: { label: 'Chờ xác minh', color: '#D97706' },
  locked: { label: 'Bị khóa', color: '#DC2626' },
};

function StatCard({ icon, color, bg, value, label }) {
  return (
    <div style={CARD_STYLE}>
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
        {icon}
      </div>
      <div style={{ fontSize: '22px', fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>{label}</div>
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const EMPTY_CREATE_FORM = { email: '', full_name: '', phone: '', role: 'user' };

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

const AdminUsersView = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [creating, setCreating] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [viewUser, setViewUser] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users', { headers: authHeaders() });
      const data = await response.json();
      if (data.status === 'success') {
        setUsers(data.data.users);
        setTotal(data.data.total);
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

  const counts = useMemo(() => ({
    all: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    user: users.filter(u => u.role === 'user').length,
    locked: users.filter(u => u.status === 'locked').length,
  }), [users]);

  const filtered = useMemo(() => {
    let list = users;
    if (activeTab === 'admin') list = list.filter(u => u.role === 'admin');
    else if (activeTab === 'user') list = list.filter(u => u.role === 'user');
    else if (activeTab === 'locked') list = list.filter(u => u.status === 'locked');

    if (roleFilter !== 'all') list = list.filter(u => u.role === roleFilter);
    if (statusFilter !== 'all') list = list.filter(u => (u.status || 'active') === statusFilter);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(u =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, activeTab, roleFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageUsers = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [activeTab, roleFilter, statusFilter, search, pageSize]);

  const toggleSelectAll = () => {
    if (selected.size === pageUsers.length && pageUsers.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pageUsers.map(u => u.id)));
    }
  };
  const toggleSelectOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleEdit = (user) => {
    setEditForm({ id: user.id, full_name: user.full_name, email: user.email, phone: user.phone || '', role: user.role });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`/api/admin/users/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ full_name: editForm.full_name, phone: editForm.phone, role: editForm.role })
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
      showToast('Lỗi khi cập nhật user', 'error');
    }
  };

  const toggleLock = async (user) => {
    if (user.role === 'admin') {
      showToast('Không thể khóa tài khoản admin', 'error');
      return;
    }
    const newStatus = user.status === 'locked' ? 'active' : 'locked';
    try {
      const response = await fetch(`/api/admin/users/${user.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        showToast(newStatus === 'locked' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản', 'success');
        fetchUsers();
      } else {
        const data = await response.json();
        showToast(data.detail || 'Lỗi khi đổi trạng thái', 'error');
      }
    } catch (error) {
      showToast('Lỗi khi đổi trạng thái', 'error');
    }
  };

  const bulkSetStatus = async (status) => {
    if (selected.size === 0) return;
    let ids = [...selected];
    if (status === 'locked') {
      const adminSelected = users.filter(u => selected.has(u.id) && u.role === 'admin');
      ids = ids.filter(id => !adminSelected.some(a => a.id === id));
      if (adminSelected.length > 0) showToast('Bỏ qua tài khoản admin (không thể khóa)', 'error');
      if (ids.length === 0) return;
    }
    await Promise.all(ids.map(id =>
      fetch(`/api/admin/users/${id}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ status })
      })
    ));
    showToast(`Đã đổi trạng thái ${ids.length} user`, 'success');
    setSelected(new Set());
    fetchUsers();
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    const ids = [...selected];
    setConfirmDelete({ bulk: true, ids });
  };

  const confirmDeleteUsers = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    const ids = target.bulk ? target.ids : [target.id];
    try {
      await Promise.all(ids.map(id => fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: authHeaders() })));
      showToast(`Đã xóa ${ids.length} user`, 'success');
      setSelected(new Set());
      fetchUsers();
    } catch (error) {
      showToast('Lỗi khi xóa user', 'error');
    }
  };

  const handleCreateSubmit = async () => {
    if (!createForm.email.trim() || !createForm.full_name.trim()) {
      showToast('Vui lòng nhập email và họ tên', 'error');
      return;
    }
    setCreating(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(createForm)
      });
      const data = await response.json();
      if (response.ok) {
        setCreatedCredentials({ email: data.user.email, temp_password: data.temp_password });
        setCreateForm(EMPTY_CREATE_FORM);
        fetchUsers();
      } else {
        showToast(data.detail || 'Lỗi khi tạo user', 'error');
      }
    } catch (error) {
      showToast('Lỗi khi tạo user', 'error');
    } finally {
      setCreating(false);
    }
  };

  const exportCsv = () => {
    const header = ['ID', 'Họ tên', 'Email', 'SĐT', 'Vai trò', 'Trạng thái', 'Ngày đăng ký', 'Lần hoạt động gần nhất'];
    const rows = filtered.map(u => [
      u.id, u.full_name, u.email, u.phone || '', u.role,
      STATUS_META[u.status || 'active']?.label || u.status,
      new Date(u.created_at).toLocaleDateString('vi-VN'),
      u.last_login ? new Date(u.last_login).toLocaleString('vi-VN') : ''
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setSearch(''); setRoleFilter('all'); setStatusFilter('all'); setActiveTab('all');
  };

  if (loading && users.length === 0) {
    return (
      <div style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
        <p style={{ marginTop: '16px', color: 'var(--text-dim)' }}>Đang tải danh sách users...</p>
      </div>
    );
  }

  const TABS = [
    ['all', 'Tất cả', counts.all],
    ['admin', 'Admin', counts.admin],
    ['user', 'User thường', counts.user],
    ['locked', 'Bị khóa', counts.locked],
  ];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800 }}>User Management</h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-dim)' }}>Quản lý người dùng và phân quyền hệ thống</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tên, email, SĐT..."
              style={{ padding: '9px 12px 9px 32px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px', minWidth: '220px' }}
            />
          </div>
          <button onClick={resetFilters} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <RotateCcw size={14} /> Reset filter
          </button>
          <button onClick={() => { setCreateForm(EMPTY_CREATE_FORM); setCreatedCredentials(null); setShowCreateModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', border: 'none', background: 'var(--color-primary)', color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            <UserPlus size={15} /> Thêm user mới
          </button>
          <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px' }}>
          <option value="all">Vai trò: Tất cả</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px' }}>
          <option value="all">Trạng thái: Tất cả</option>
          <option value="active">Hoạt động</option>
          <option value="locked">Bị khóa</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <StatCard icon={<Users size={20} />} color="#2563EB" bg="rgba(37,99,235,0.1)" value={total} label="Tổng người dùng" />
        <StatCard icon={<Users size={20} />} color="#16A34A" bg="rgba(22,163,74,0.1)" value={counts.user} label="Người dùng thường" />
        <StatCard icon={<Shield size={20} />} color="#D97706" bg="rgba(217,119,6,0.1)" value={counts.admin} label="Admin" />
        <StatCard icon={<Lock size={20} />} color="#DC2626" bg="rgba(220,38,38,0.1)" value={counts.locked} label="Tài khoản bị khóa" />
      </div>

      <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '4px', padding: '10px 16px', borderBottom: '2px solid var(--border-neon)', overflowX: 'auto' }}>
          {TABS.map(([key, label, count]) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: 'none',
              background: activeTab === key ? 'rgba(215,30,40,0.1)' : 'transparent', color: activeTab === key ? 'var(--color-primary)' : 'var(--text-dim)',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap'
            }}>
              {label} <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '999px', background: activeTab === key ? 'var(--color-primary)' : 'var(--bg-input)', color: activeTab === key ? 'white' : 'var(--text-dim)' }}>{count}</span>
            </button>
          ))}
        </div>

        {selected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: 'var(--bg-input)', borderBottom: '2px solid var(--border-neon)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>Đã chọn {selected.size} user</span>
            <button onClick={() => bulkSetStatus('active')} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #16A34A', color: '#16A34A', background: 'var(--bg-panel)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>Mở khóa</button>
            <button onClick={() => bulkSetStatus('locked')} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #DC2626', color: '#DC2626', background: 'var(--bg-panel)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>Khóa</button>
            <button onClick={bulkDelete} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #DC2626', color: '#DC2626', background: 'var(--bg-panel)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>Xóa đã chọn</button>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-input)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}><input type="checkbox" checked={pageUsers.length > 0 && selected.size === pageUsers.length} onChange={toggleSelectAll} /></th>
                <th style={{ padding: '10px 12px' }}>Người dùng</th>
                <th style={{ padding: '10px 12px' }}>Email</th>
                <th style={{ padding: '10px 12px' }}>SĐT</th>
                <th style={{ padding: '10px 12px' }}>Vai trò</th>
                <th style={{ padding: '10px 12px' }}>Trạng thái</th>
                <th style={{ padding: '10px 12px' }}>Ngày đăng ký</th>
                <th style={{ padding: '10px 12px' }}>Lần hoạt động gần nhất</th>
                <th style={{ padding: '10px 12px' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {pageUsers.map(user => {
                const status = user.status || 'active';
                const meta = STATUS_META[status] || STATUS_META.active;
                return (
                  <tr key={user.id} style={{ borderTop: '1px solid var(--border-neon)' }}>
                    <td style={{ padding: '10px 12px' }}><input type="checkbox" checked={selected.has(user.id)} onChange={() => toggleSelectOne(user.id)} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: avatarColor(user.full_name), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                          {initials(user.full_name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{user.full_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>ID: USR-{String(user.id).padStart(4, '0')}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-dim)' }}>{user.email}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-dim)' }}>{user.phone || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: user.role === 'admin' ? '#FEE2E2' : '#EFF6FF', color: user.role === 'admin' ? '#DC2626' : '#2563EB' }}>
                        {user.role === 'admin' ? 'ADMIN' : 'USER'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: meta.color }} /> {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-dim)' }}>{new Date(user.created_at).toLocaleDateString('vi-VN')}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-dim)' }}>{user.last_login ? new Date(user.last_login).toLocaleString('vi-VN') : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button title="Xem chi tiết" onClick={() => setViewUser(user)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-dim)' }}><Eye size={16} /></button>
                        <button title="Chỉnh sửa" onClick={() => handleEdit(user)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-dim)' }}><Pencil size={16} /></button>
                        <button
                          title={user.role === 'admin' ? 'Không thể khóa tài khoản admin' : (status === 'locked' ? 'Mở khóa' : 'Khóa tài khoản')}
                          onClick={() => toggleLock(user)}
                          disabled={user.role === 'admin'}
                          style={{ border: 'none', background: 'transparent', cursor: user.role === 'admin' ? 'not-allowed' : 'pointer', color: user.role === 'admin' ? '#CBD5E1' : (status === 'locked' ? '#16A34A' : '#DC2626') }}
                        >
                          {status === 'locked' ? <LockOpen size={16} /> : <LockKeyhole size={16} />}
                        </button>
                        <button title="Xóa" onClick={() => setConfirmDelete({ bulk: false, id: user.id })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#DC2626' }}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pageUsers.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
              <Users size={48} style={{ opacity: 0.4, marginBottom: '10px' }} />
              <p>Không tìm thấy user nào phù hợp</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '12px 16px', borderTop: '2px solid var(--border-neon)' }}>
          <div style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>
            Hiển thị {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} trong tổng số {filtered.length} kết quả
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={{ padding: '6px 8px', borderRadius: '8px', border: '2px solid var(--border-neon)', fontSize: '12.5px' }}>
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} dòng</option>)}
            </select>
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '6px 12px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>‹</button>
            <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ padding: '6px 12px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}>›</button>
          </div>
        </div>
      </div>

      {viewUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setViewUser(null)}>
          <div style={{ background: 'var(--bg-panel)', border: '2px solid var(--border-neon)', color: 'var(--text-main)', borderRadius: 'var(--radius-md)', padding: '24px', width: '380px', maxWidth: '92vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Chi tiết user</h3>
              <button onClick={() => setViewUser(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div><span style={{ color: 'var(--text-dim)' }}>ID: </span><strong>USR-{String(viewUser.id).padStart(4, '0')}</strong></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Họ tên: </span><strong>{viewUser.full_name}</strong></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Email: </span><strong>{viewUser.email}</strong></div>
              <div><span style={{ color: 'var(--text-dim)' }}>SĐT: </span><strong>{viewUser.phone || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Vai trò: </span><strong>{viewUser.role}</strong></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Trạng thái: </span><strong>{STATUS_META[viewUser.status || 'active']?.label}</strong></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Ngày đăng ký: </span><strong>{new Date(viewUser.created_at).toLocaleString('vi-VN')}</strong></div>
              <div><span style={{ color: 'var(--text-dim)' }}>Lần hoạt động gần nhất: </span><strong>{viewUser.last_login ? new Date(viewUser.last_login).toLocaleString('vi-VN') : 'Chưa đăng nhập'}</strong></div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chỉnh sửa user</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Email (không thể thay đổi)</label>
                <input type="email" value={editForm.email} disabled className="form-input" style={{ opacity: 0.6, cursor: 'not-allowed' }} />
              </div>
              <div className="form-group">
                <label>Tên đầy đủ</label>
                <input type="text" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className="form-input" />
              </div>
              <div className="form-group">
                <label>Số điện thoại</label>
                <input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="form-input" placeholder="Nhập số điện thoại" />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="form-input">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowEditModal(false)}>Hủy</button>
                <button className="btn-primary" onClick={handleSaveEdit}>Lưu thay đổi</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Thêm user mới</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {createdCredentials ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p style={{ fontSize: '13px' }}>Đã tạo user <strong>{createdCredentials.email}</strong> thành công. Mật khẩu tạm thời (chỉ hiển thị một lần, do hệ thống chưa cấu hình SMTP để gửi email tự động):</p>
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: 'monospace', fontWeight: 700, fontSize: '15px' }}>{createdCredentials.temp_password}</div>
                  <button className="btn-primary" onClick={() => { setShowCreateModal(false); setCreatedCredentials(null); }}>Đóng</button>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} className="form-input" placeholder="email@company.com" />
                  </div>
                  <div className="form-group">
                    <label>Họ và tên</label>
                    <input type="text" value={createForm.full_name} onChange={e => setCreateForm({ ...createForm, full_name: e.target.value })} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label>Số điện thoại</label>
                    <input type="text" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label>Vai trò</label>
                    <select value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })} className="form-input">
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="modal-actions">
                    <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>Hủy</button>
                    <button className="btn-primary" disabled={creating} onClick={handleCreateSubmit}>{creating ? 'Đang tạo...' : 'Tạo user'}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {confirmDelete && (
        <ConfirmDialog
          title="Xác nhận xóa"
          message={confirmDelete.bulk ? `Bạn có chắc chắn muốn xóa ${confirmDelete.ids.length} user đã chọn? Hành động này không thể hoàn tác.` : 'Bạn có chắc chắn muốn xóa user này? Hành động này không thể hoàn tác.'}
          confirmText="Xóa"
          cancelText="Hủy"
          type="danger"
          onConfirm={confirmDeleteUsers}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

export default AdminUsersView;
