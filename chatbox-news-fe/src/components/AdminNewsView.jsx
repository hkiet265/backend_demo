import React, { useState, useEffect, useMemo } from 'react';
import { Newspaper, Radio, Users, Filter, RefreshCw, Search, X, Eye, Pencil, CheckCircle2, EyeOff, Trash2, Star, Download, Plus } from 'lucide-react';
import Toast from './Toast';
import ConfirmDialog from './molecules/ConfirmDialog/ConfirmDialog';
import Spinner from './atoms/Spinner';

const CARD_STYLE = { background: 'var(--bg-panel)', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '18px 20px', color: 'var(--text-main)' };

const STATUS_META = {
  Moi: { label: 'Mới', color: '#D97706', bg: '#FEF3C7' },
  Cho_duyet: { label: 'Chờ xử lý', color: '#D97706', bg: '#FEF3C7' },
  Da_duyet: { label: 'Đã duyệt', color: '#16A34A', bg: '#DCFCE7' },
  An: { label: 'Đã ẩn', color: '#64748B', bg: '#F1F5F9' },
};
function statusMeta(status) {
  return STATUS_META[status] || { label: status || 'Không rõ', color: '#64748B', bg: '#F1F5F9' };
}

function StatCard({ icon, color, bg, value, label }) {
  return (
    <div style={CARD_STYLE}>
      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '21px', fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>{label}</div>
    </div>
  );
}

const DONUT_COLORS = ['#DC2626', '#16A34A', '#2563EB', '#D97706', '#7C3AED', '#94A3B8'];
function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  let cum = 0;
  const segs = data.map((d, i) => {
    const pct = total ? (d.count / total) * 100 : 0;
    const seg = { ...d, pct, start: cum, end: cum + pct, color: DONUT_COLORS[i % DONUT_COLORS.length] };
    cum += pct;
    return seg;
  });
  const gradient = total ? `conic-gradient(${segs.map(s => `${s.color} ${s.start}% ${s.end}%`).join(', ')})` : 'conic-gradient(var(--bg-input) 0% 100%)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
      <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: gradient, flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '140px' }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{s.label}</span>
            <strong>{s.count} ({s.pct.toFixed(0)}%)</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatViews(n) {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const EMPTY_EDIT = { id: null, title: '', summary: '', category: '', source: '', region: 'Bắc', url: '' };

const AdminNewsView = () => {
  const [news, setNews] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [viewNews, setViewNews] = useState(null);
  const [assignCategoryValue, setAssignCategoryValue] = useState('');
  const [showAssignCategory, setShowAssignCategory] = useState(false);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/news?page_size=5000');
      const data = await response.json();
      if (data.status === 'success') {
        setNews(data.data);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 60000);
    return () => clearInterval(interval);
  }, []);

  const sources = useMemo(() => [...new Set(news.map(n => n.source).filter(Boolean))].sort(), [news]);
  const regions = useMemo(() => [...new Set(news.map(n => n.region).filter(Boolean))].sort(), [news]);
  const categories = useMemo(() => [...new Set(news.map(n => n.category).filter(Boolean))].sort(), [news]);

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return news.filter(n => n.created_at && new Date(n.created_at).toDateString() === today).length;
  }, [news]);

  const counts = useMemo(() => ({
    all: news.length,
    latest: news.filter(n => n.created_at && (Date.now() - new Date(n.created_at).getTime()) < 7 * 24 * 3600 * 1000).length,
    uncategorized: news.filter(n => !n.category).length,
    published: news.filter(n => n.status === 'Da_duyet').length,
    featured: news.filter(n => n.featured).length,
  }), [news]);

  const filtered = useMemo(() => {
    let list = news;
    if (activeTab === 'latest') list = list.filter(n => n.created_at && (Date.now() - new Date(n.created_at).getTime()) < 7 * 24 * 3600 * 1000);
    else if (activeTab === 'uncategorized') list = list.filter(n => !n.category);
    else if (activeTab === 'published') list = list.filter(n => n.status === 'Da_duyet');
    else if (activeTab === 'featured') list = list.filter(n => n.featured);

    if (sourceFilter !== 'all') list = list.filter(n => n.source === sourceFilter);
    if (regionFilter !== 'all') list = list.filter(n => n.region === regionFilter);
    if (categoryFilter !== 'all') list = list.filter(n => n.category === categoryFilter);
    if (statusFilter !== 'all') list = list.filter(n => (n.status || '') === statusFilter);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(n => (n.title || '').toLowerCase().includes(q) || (n.summary || '').toLowerCase().includes(q));
    }
    return list;
  }, [news, activeTab, sourceFilter, regionFilter, categoryFilter, statusFilter, search]);

  useEffect(() => { setPage(1); }, [activeTab, sourceFilter, regionFilter, categoryFilter, statusFilter, search, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageNews = filtered.slice((page - 1) * pageSize, page * pageSize);

  const sourceDistribution = useMemo(() => {
    const map = {};
    news.forEach(n => { const k = n.source || 'Khác'; map[k] = (map[k] || 0) + 1; });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5).map(([label, count]) => ({ label, count }));
    const restCount = sorted.slice(5).reduce((s, [, c]) => s + c, 0);
    if (restCount > 0) top.push({ label: 'Khác', count: restCount });
    return top;
  }, [news]);

  const categoryDistribution = useMemo(() => {
    const map = {};
    news.forEach(n => { const k = n.category || 'Chưa phân loại'; map[k] = (map[k] || 0) + 1; });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5).map(([label, count]) => ({ label, count }));
    const restCount = sorted.slice(5).reduce((s, [, c]) => s + c, 0);
    if (restCount > 0) top.push({ label: 'Khác', count: restCount });
    return top;
  }, [news]);

  const lowTrustCount = useMemo(() => news.filter(n => (n.trust_score ?? 100) < 70).length, [news]);

  const toggleSelectAll = () => {
    if (selected.size === pageNews.length && pageNews.length > 0) setSelected(new Set());
    else setSelected(new Set(pageNews.map(n => n.id)));
  };
  const toggleSelectOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleEdit = (n) => {
    setEditForm({ id: n.id, title: n.title, summary: n.summary || '', category: n.category || '', source: n.source || '', region: n.region || 'Bắc', url: n.url || '' });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`/api/news/${editForm.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tieu_de: editForm.title, tom_tat: editForm.summary, chuyen_muc: editForm.category, nha_dai: editForm.source, vung_mien: editForm.region, url: editForm.url })
      });
      if (response.ok) {
        showToast('Đã cập nhật tin tức thành công!', 'success');
        setShowEditModal(false);
        fetchNews();
      } else {
        showToast('Lỗi khi cập nhật tin tức', 'error');
      }
    } catch (error) {
      showToast('Lỗi khi cập nhật tin tức', 'error');
    }
  };

  const setNewsField = async (id, field, value) => {
    await fetch(`/api/news/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) });
  };

  const toggleFeatured = async (n) => {
    await setNewsField(n.id, 'noi_bat', !n.featured);
    showToast(n.featured ? 'Đã bỏ nổi bật' : 'Đã đánh dấu nổi bật', 'success');
    fetchNews();
  };

  const approveOne = async (n) => {
    await setNewsField(n.id, 'trang_thai', 'Da_duyet');
    showToast('Đã duyệt tin', 'success');
    fetchNews();
  };
  const hideOne = async (n) => {
    await setNewsField(n.id, 'trang_thai', 'An');
    showToast('Đã ẩn tin', 'success');
    fetchNews();
  };

  const bulkApprove = async () => {
    if (selected.size === 0) return;
    await Promise.all([...selected].map(id => fetch(`/api/news/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trang_thai: 'Da_duyet' }) })));
    showToast(`Đã duyệt ${selected.size} tin`, 'success');
    setSelected(new Set());
    fetchNews();
  };
  const bulkHide = async () => {
    if (selected.size === 0) return;
    await Promise.all([...selected].map(id => fetch(`/api/news/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trang_thai: 'An' }) })));
    showToast(`Đã ẩn ${selected.size} tin`, 'success');
    setSelected(new Set());
    fetchNews();
  };
  const bulkDelete = () => {
    if (selected.size === 0) return;
    setConfirmDelete({ bulk: true, ids: [...selected] });
  };
  const confirmDeleteNews = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    const ids = target.bulk ? target.ids : [target.id];
    await Promise.all(ids.map(id => fetch(`/api/news/${id}`, { method: 'DELETE' })));
    showToast(`Đã xóa ${ids.length} tin`, 'success');
    setSelected(new Set());
    fetchNews();
  };

  const bulkAssignCategory = async () => {
    if (selected.size === 0 || !assignCategoryValue.trim()) return;
    await Promise.all([...selected].map(id => fetch(`/api/news/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chuyen_muc: assignCategoryValue.trim() }) })));
    showToast(`Đã gán chuyên mục cho ${selected.size} tin`, 'success');
    setSelected(new Set());
    setShowAssignCategory(false);
    setAssignCategoryValue('');
    fetchNews();
  };

  const exportCsv = () => {
    const header = ['ID', 'Tiêu đề', 'Chuyên mục', 'Nguồn', 'Vùng', 'Ngày tạo', 'Trạng thái', 'Độ tin cậy', 'Lượt xem'];
    const rows = filtered.map(n => [n.id, n.title, n.category || '', n.source || '', n.region || '', new Date(n.created_at).toLocaleDateString('vi-VN'), statusMeta(n.status).label, n.trust_score ?? '', n.views ?? 0]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `news_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && news.length === 0) {
    return (
      <div style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
        <p style={{ marginTop: '16px', color: 'var(--text-dim)' }}>Đang tải tin tức...</p>
      </div>
    );
  }

  const TABS = [
    ['all', 'Tất cả', counts.all],
    ['latest', 'Mới nhất', counts.latest],
    ['uncategorized', 'Chưa phân loại', counts.uncategorized],
    ['published', 'Đã xuất bản', counts.published],
    ['featured', 'Nổi bật', counts.featured],
  ];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800 }}>News Management</h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-dim)' }}>Quản lý tin tức trong hệ thống</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={fetchNews} title="Làm mới" style={{ width: '38px', height: '38px', borderRadius: '10px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
          <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <Download size={14} /> Xuất dữ liệu
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tiêu đề, nội dung..." style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 32px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px' }} />
        </div>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px' }}>
          <option value="all">Tất cả nguồn</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px' }}>
          <option value="all">Tất cả vùng</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px' }}>
          <option value="all">Tất cả chuyên mục</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px' }}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="admin-two-col-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px' }}>
            <StatCard icon={<Newspaper size={18} />} color="#2563EB" bg="rgba(37,99,235,0.1)" value={total.toLocaleString()} label="Tổng số tin" />
            <StatCard icon={<Radio size={18} />} color="#16A34A" bg="rgba(22,163,74,0.1)" value={todayCount} label="Tin hôm nay" />
            <StatCard icon={<Users size={18} />} color="#7C3AED" bg="rgba(124,58,237,0.1)" value={sources.length} label="Nguồn đang hoạt động" />
            <StatCard icon={<Filter size={18} />} color="#D97706" bg="rgba(217,119,6,0.1)" value={filtered.length} label="Kết quả lọc" />
          </div>

          <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: '4px', padding: '10px 16px', borderBottom: '2px solid var(--border-neon)', overflowX: 'auto' }}>
              {TABS.map(([key, label, count]) => (
                <button key={key} onClick={() => setActiveTab(key)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: 'none',
                  background: activeTab === key ? 'rgba(215,30,40,0.1)' : 'transparent', color: activeTab === key ? 'var(--color-primary)' : 'var(--text-dim)',
                  fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', whiteSpace: 'nowrap'
                }}>
                  {label} <span style={{ fontSize: '10.5px', padding: '1px 7px', borderRadius: '999px', background: activeTab === key ? 'var(--color-primary)' : 'var(--bg-input)', color: activeTab === key ? 'white' : 'var(--text-dim)' }}>{count}</span>
                </button>
              ))}
            </div>

            {selected.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: 'var(--bg-input)', borderBottom: '2px solid var(--border-neon)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>Đã chọn {selected.size} tin</span>
                <button onClick={() => setShowAssignCategory(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-neon)', background: 'var(--bg-panel)', color: 'var(--text-main)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}><Plus size={13} /> Gán chuyên mục</button>
                <button onClick={bulkApprove} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #16A34A', color: '#16A34A', background: 'var(--bg-panel)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}><CheckCircle2 size={13} /> Duyệt</button>
                <button onClick={bulkHide} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #D97706', color: '#D97706', background: 'var(--bg-panel)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}><EyeOff size={13} /> Ẩn tin</button>
                <button onClick={bulkDelete} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #DC2626', color: '#DC2626', background: 'var(--bg-panel)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}><Trash2 size={13} /> Xóa</button>
                <button onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '12.5px' }}>Bỏ chọn ✕</button>
              </div>
            )}

            {showAssignCategory && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--bg-input)', borderBottom: '2px solid var(--border-neon)' }}>
                <input value={assignCategoryValue} onChange={e => setAssignCategoryValue(e.target.value)} placeholder="Nhập tên chuyên mục..." list="category-options" style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '2px solid var(--border-neon)', fontSize: '12.5px' }} />
                <datalist id="category-options">{categories.map(c => <option key={c} value={c} />)}</datalist>
                <button onClick={bulkAssignCategory} style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'white', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Gán</button>
                <button onClick={() => setShowAssignCategory(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-dim)' }}><X size={16} /></button>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-input)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}><input type="checkbox" checked={pageNews.length > 0 && selected.size === pageNews.length} onChange={toggleSelectAll} /></th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>ID</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Tiêu đề</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Chuyên mục</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Nguồn</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Vùng</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Ngày tạo</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Trạng thái</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Độ tin cậy</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {pageNews.map(n => {
                    const meta = statusMeta(n.status);
                    return (
                      <tr key={n.id} style={{ borderTop: '1px solid var(--border-neon)' }}>
                        <td style={{ padding: '10px 12px' }}><input type="checkbox" checked={selected.has(n.id)} onChange={() => toggleSelectOne(n.id)} /></td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-dim)' }}>{n.id}</td>
                        <td style={{ padding: '10px 12px', minWidth: '260px' }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            {n.image ? (
                              <img src={n.image} alt="" style={{ width: '52px', height: '38px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: '52px', height: '38px', borderRadius: '6px', background: 'var(--bg-input)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Newspaper size={16} color="var(--text-dim)" /></div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {n.featured && <Star size={12} color="#D97706" fill="#D97706" style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
                                {n.title}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                {new Date(n.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {formatViews(n.views)} lượt xem
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          {n.category ? <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: '#FEE2E2', color: '#DC2626', whiteSpace: 'nowrap' }}>{n.category}</span> : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{n.source || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{n.region || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{new Date(n.created_at).toLocaleDateString('vi-VN')}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: meta.bg, color: meta.color, whiteSpace: 'nowrap' }}>{meta.label}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{n.trust_score != null ? `${n.trust_score}%` : '—'}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button title="Xem chi tiết" onClick={() => setViewNews(n)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-dim)' }}><Eye size={15} /></button>
                            <button title="Chỉnh sửa" onClick={() => handleEdit(n)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-dim)' }}><Pencil size={15} /></button>
                            {n.status === 'Da_duyet' ? (
                              <button title="Ẩn tin" onClick={() => hideOne(n)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#D97706' }}><EyeOff size={15} /></button>
                            ) : (
                              <button title="Duyệt" onClick={() => approveOne(n)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#16A34A' }}><CheckCircle2 size={15} /></button>
                            )}
                            <button title={n.featured ? 'Bỏ nổi bật' : 'Đánh dấu nổi bật'} onClick={() => toggleFeatured(n)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: n.featured ? '#D97706' : 'var(--text-dim)' }}><Star size={15} fill={n.featured ? '#D97706' : 'none'} /></button>
                            <button title="Xóa" onClick={() => setConfirmDelete({ bulk: false, id: n.id })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#DC2626' }}><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pageNews.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  <Newspaper size={48} style={{ opacity: 0.4, marginBottom: '10px' }} />
                  <p>Không tìm thấy tin tức nào</p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '12px 16px', borderTop: '2px solid var(--border-neon)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={{ padding: '6px 8px', borderRadius: '8px', border: '2px solid var(--border-neon)', fontSize: '12.5px' }}>
                  {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>tin mỗi trang</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '6px 12px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>‹</button>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ padding: '6px 12px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}>›</button>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>
                Hiển thị {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} trong tổng số {filtered.length} tin
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={CARD_STYLE}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800 }}>Nguồn tin phổ biến</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sourceDistribution.map((s, idx) => {
                const max = sourceDistribution[0]?.count || 1;
                return (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span>{s.label}</span>
                      <strong>{s.count.toLocaleString()} ({((s.count / news.length) * 100).toFixed(0)}%)</strong>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-input)', overflow: 'hidden' }}>
                      <div style={{ width: `${(s.count / max) * 100}%`, height: '100%', background: '#DC2626', borderRadius: '3px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-neon)' }}>
              <span style={{ color: 'var(--text-dim)' }}>Tổng cộng</span><strong>{news.length.toLocaleString()}</strong>
            </div>
          </div>

          <div style={CARD_STYLE}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800 }}>Chuyên mục nổi bật</h3>
            <DonutChart data={categoryDistribution} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-neon)' }}>
              <span style={{ color: 'var(--text-dim)' }}>Tổng cộng</span><strong>{news.length.toLocaleString()}</strong>
            </div>
          </div>

          <div style={CARD_STYLE}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800 }}>Thống kê nhanh</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
              {[
                ['Tin chờ xử lý', counts.all - counts.published - news.filter(n => n.status === 'An').length],
                ['Tin nổi bật', counts.featured],
                ['Tin chưa phân loại', counts.uncategorized],
                ['Tin có độ tin cậy thấp (<70%)', lowTrustCount],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>{label}</span><strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {viewNews && (
        <div className="modal-overlay" onClick={() => setViewNews(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chi tiết tin tức</h3>
              <button className="modal-close" onClick={() => setViewNews(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <h2 className="news-detail-title">{viewNews.title}</h2>
              <div className="news-detail-meta">
                <span className="badge">{viewNews.category || 'Chưa phân loại'}</span>
                <span className="badge">{viewNews.source}</span>
                <span className="badge">{viewNews.region}</span>
              </div>
              <div className="news-detail-summary">
                <strong>Tóm tắt:</strong>
                <p>{viewNews.summary}</p>
              </div>
              {viewNews.image && (
                <div className="news-detail-image"><img src={viewNews.image} alt={viewNews.title} /></div>
              )}
              <div className="news-detail-info">
                <p><strong>URL:</strong> <a href={viewNews.url} target="_blank" rel="noopener noreferrer">{viewNews.url}</a></p>
                <p><strong>Độ tin cậy:</strong> {viewNews.trust_score}%</p>
                <p><strong>Lượt xem:</strong> {viewNews.views ?? 0}</p>
                <p><strong>Trạng thái:</strong> {statusMeta(viewNews.status).label}</p>
                <p><strong>Ngày tạo:</strong> {new Date(viewNews.created_at).toLocaleString('vi-VN')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chỉnh sửa tin tức</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tiêu đề</label>
                <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="form-input" />
              </div>
              <div className="form-group">
                <label>Tóm tắt</label>
                <textarea value={editForm.summary} onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })} className="form-textarea" rows="4" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Chuyên mục</label>
                  <input type="text" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Nguồn</label>
                  <input type="text" value={editForm.source} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} className="form-input" />
                </div>
              </div>
              <div className="form-group">
                <label>Vùng miền</label>
                <select value={editForm.region} onChange={(e) => setEditForm({ ...editForm, region: e.target.value })} className="form-input">
                  <option value="Bắc">Bắc</option>
                  <option value="Trung">Trung</option>
                  <option value="Nam">Nam</option>
                </select>
              </div>
              <div className="form-group">
                <label>URL</label>
                <input type="text" value={editForm.url} onChange={(e) => setEditForm({ ...editForm, url: e.target.value })} className="form-input" />
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowEditModal(false)}>Hủy</button>
                <button className="btn-primary" onClick={handleSaveEdit}>Lưu thay đổi</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {confirmDelete && (
        <ConfirmDialog
          title="Xác nhận xóa"
          message={confirmDelete.bulk ? `Bạn có chắc chắn muốn xóa ${confirmDelete.ids.length} tin đã chọn? Hành động này không thể hoàn tác.` : 'Bạn có chắc chắn muốn xóa tin tức này? Hành động này không thể hoàn tác.'}
          confirmText="Xóa"
          cancelText="Hủy"
          type="danger"
          onConfirm={confirmDeleteNews}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

export default AdminNewsView;
