import React, { useState, useEffect, useMemo } from 'react';
import { Building2, CheckCircle2, Clock, ShieldCheck, TrendingUp, Search, RotateCcw, Download, Plus, Eye, Pencil, BadgeCheck, Trash2, X } from 'lucide-react';
import Toast from './Toast';
import ConfirmDialog from './molecules/ConfirmDialog/ConfirmDialog';
import Spinner from './atoms/Spinner';

const CARD_STYLE = { background: 'var(--bg-panel)', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '18px 20px', color: 'var(--text-main)' };

const STATUS_META = {
  Hoat_dong: { label: 'Hoạt động', color: '#16A34A', bg: '#DCFCE7' },
  Cho_xac_minh: { label: 'Chờ xác minh', color: '#D97706', bg: '#FEF3C7' },
  Tam_ngung: { label: 'Tạm ngưng', color: '#DC2626', bg: '#FEE2E2' },
};
function statusMeta(status) {
  return STATUS_META[status] || { label: status || 'Không rõ', color: '#64748B', bg: '#F1F5F9' };
}
function formatRegion(region) {
  if (!region) return '—';
  const r = region.toLowerCase();
  if (r.includes('bac') || r.includes('bắc')) return 'Bắc';
  if (r.includes('nam')) return 'Nam';
  if (r.includes('trung')) return 'Trung';
  return region;
}

function StatCard({ icon, color, bg, value, label, sub }) {
  return (
    <div style={CARD_STYLE}>
      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '21px', fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

const DONUT_COLORS = ['#2563EB', '#16A34A', '#7C3AED', '#94A3B8'];
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
      <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: gradient, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '58px', height: '58px', borderRadius: '50%', background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: 800 }}>{total}</span>
          <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>Tổng số</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '140px' }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            <strong>{s.count} ({s.pct.toFixed(1)}%)</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const EMPTY_CREATE_FORM = { ten_doanh_nghiep: '', nganh_nghe: '', vung_mien: 'Bắc', tinh_thanh: '', so_dien_thoai: '', email: '', quy_mo: '' };
const authHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` });

const AdminBusinessView = () => {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scaleFilter, setScaleFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [viewBusiness, setViewBusiness] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [creating, setCreating] = useState(false);
  const [showAssignRegion, setShowAssignRegion] = useState(false);
  const [assignRegionValue, setAssignRegionValue] = useState('Bắc');
  const [showAssignStatus, setShowAssignStatus] = useState(false);
  const [assignStatusValue, setAssignStatusValue] = useState('Hoat_dong');

  const showToast = (message, type = 'success') => setToast({ message, type });

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/businesses?page_size=200');
      const data = await response.json();
      if (data.status === 'success') setBusinesses(data.data);
    } catch (error) {
      console.error('Failed to fetch businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
    const interval = setInterval(fetchBusinesses, 60000);
    return () => clearInterval(interval);
  }, []);

  const regions = useMemo(() => [...new Set(businesses.map(b => b.region).filter(Boolean))], [businesses]);
  const industries = useMemo(() => [...new Set(businesses.map(b => b.industry).filter(Boolean))].sort(), [businesses]);
  const provinces = useMemo(() => [...new Set(businesses.map(b => b.location).filter(Boolean))].sort(), [businesses]);
  const scales = useMemo(() => [...new Set(businesses.map(b => b.scale).filter(Boolean))], [businesses]);
  const sources = useMemo(() => [...new Set(businesses.map(b => b.source).filter(Boolean))], [businesses]);

  const counts = useMemo(() => ({
    total: businesses.length,
    active: businesses.filter(b => (b.status || 'Hoat_dong') === 'Hoat_dong').length,
    pending: businesses.filter(b => b.status === 'Cho_xac_minh').length,
    highTrust: businesses.filter(b => (b.trust_score ?? 0) >= 80).length,
    newThisWeek: businesses.filter(b => b.created_at && (Date.now() - new Date(b.created_at).getTime()) < 7 * 24 * 3600 * 1000).length,
    noTaxCode: businesses.filter(b => !b.tax_code).length,
    lowTrust: businesses.filter(b => (b.trust_score ?? 100) < 50).length,
  }), [businesses]);

  const filtered = useMemo(() => {
    let list = businesses;
    if (regionFilter !== 'all') list = list.filter(b => b.region === regionFilter);
    if (industryFilter !== 'all') list = list.filter(b => b.industry === industryFilter);
    if (provinceFilter !== 'all') list = list.filter(b => b.location === provinceFilter);
    if (statusFilter !== 'all') list = list.filter(b => (b.status || 'Hoat_dong') === statusFilter);
    if (scaleFilter !== 'all') list = list.filter(b => b.scale === scaleFilter);
    if (sourceFilter !== 'all') list = list.filter(b => b.source === sourceFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(b =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.tax_code || '').toLowerCase().includes(q) ||
        (b.phone || '').toLowerCase().includes(q) ||
        (b.email || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [businesses, regionFilter, industryFilter, provinceFilter, statusFilter, scaleFilter, sourceFilter, search]);

  useEffect(() => { setPage(1); }, [regionFilter, industryFilter, provinceFilter, statusFilter, scaleFilter, sourceFilter, search, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageBusinesses = filtered.slice((page - 1) * pageSize, page * pageSize);

  const regionDistribution = useMemo(() => {
    const map = {};
    businesses.forEach(b => { const k = formatRegion(b.region); map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  }, [businesses]);

  const industryDistribution = useMemo(() => {
    const map = {};
    businesses.forEach(b => { const k = b.industry || 'Khác'; map[k] = (map[k] || 0) + 1; });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 5).map(([label, count]) => ({ label, count }));
  }, [businesses]);

  const toggleSelectAll = () => {
    if (selected.size === pageBusinesses.length && pageBusinesses.length > 0) setSelected(new Set());
    else setSelected(new Set(pageBusinesses.map(b => b.id)));
  };
  const toggleSelectOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const putBusiness = (id, body) => fetch(`/api/businesses/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) });

  const handleEdit = (b) => {
    setEditForm({
      id: b.id, name: b.name, industry: b.industry, region: b.region, location: b.location,
      phone: b.phone, email: b.email, website: b.website, scale: b.scale,
      trust_score: b.trust_score ?? 60, status: b.status || 'Hoat_dong', description: b.description || ''
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await putBusiness(editForm.id, {
        ten_doanh_nghiep: editForm.name, nganh_nghe: editForm.industry, vung_mien: editForm.region,
        tinh_thanh: editForm.location, so_dien_thoai: editForm.phone, email: editForm.email,
        website: editForm.website, quy_mo: editForm.scale, do_tin_cay: Number(editForm.trust_score),
        trang_thai: editForm.status, mo_ta: editForm.description
      });
      if (response.ok) {
        showToast('Đã cập nhật doanh nghiệp thành công!', 'success');
        setShowEditModal(false);
        fetchBusinesses();
      } else {
        const data = await response.json().catch(() => ({}));
        showToast(data.detail || 'Lỗi khi cập nhật doanh nghiệp', 'error');
      }
    } catch (error) {
      showToast('Lỗi khi cập nhật doanh nghiệp', 'error');
    }
  };

  const verifyOne = async (b) => {
    const response = await putBusiness(b.id, { trang_thai: 'Hoat_dong', do_tin_cay: 90 });
    if (response.ok) { showToast('Đã xác minh doanh nghiệp', 'success'); fetchBusinesses(); }
    else showToast('Lỗi khi xác minh', 'error');
  };

  const bulkVerify = async () => {
    if (selected.size === 0) return;
    const results = await Promise.all([...selected].map(id => putBusiness(id, { trang_thai: 'Hoat_dong', do_tin_cay: 90 })));
    const okCount = results.filter(r => r.ok).length;
    showToast(`Đã xác minh ${okCount}/${selected.size} doanh nghiệp`, okCount === selected.size ? 'success' : 'error');
    setSelected(new Set());
    fetchBusinesses();
  };

  const bulkAssignRegion = async () => {
    if (selected.size === 0) return;
    const results = await Promise.all([...selected].map(id => putBusiness(id, { vung_mien: assignRegionValue })));
    const okCount = results.filter(r => r.ok).length;
    showToast(`Đã gán vùng cho ${okCount}/${selected.size} doanh nghiệp`, okCount === selected.size ? 'success' : 'error');
    setSelected(new Set());
    setShowAssignRegion(false);
    fetchBusinesses();
  };

  const bulkAssignStatus = async () => {
    if (selected.size === 0) return;
    const results = await Promise.all([...selected].map(id => putBusiness(id, { trang_thai: assignStatusValue })));
    const okCount = results.filter(r => r.ok).length;
    showToast(`Đã cập nhật trạng thái cho ${okCount}/${selected.size} doanh nghiệp`, okCount === selected.size ? 'success' : 'error');
    setSelected(new Set());
    setShowAssignStatus(false);
    fetchBusinesses();
  };

  const bulkDelete = () => {
    if (selected.size === 0) return;
    setConfirmDelete({ bulk: true, ids: [...selected] });
  };
  const confirmDeleteBusinesses = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    const ids = target.bulk ? target.ids : [target.id];
    const results = await Promise.all(ids.map(id => fetch(`/api/businesses/${id}`, { method: 'DELETE', headers: authHeaders() })));
    const okCount = results.filter(r => r.ok).length;
    showToast(`Đã xóa ${okCount}/${ids.length} doanh nghiệp`, okCount === ids.length ? 'success' : 'error');
    setSelected(new Set());
    fetchBusinesses();
  };

  const handleCreateSubmit = async () => {
    if (!createForm.ten_doanh_nghiep.trim()) {
      showToast('Vui lòng nhập tên doanh nghiệp', 'error');
      return;
    }
    setCreating(true);
    try {
      const response = await fetch('/api/businesses', { method: 'POST', headers: authHeaders(), body: JSON.stringify(createForm) });
      if (response.ok) {
        showToast('Đã thêm doanh nghiệp thành công!', 'success');
        setShowCreateModal(false);
        setCreateForm(EMPTY_CREATE_FORM);
        fetchBusinesses();
      } else {
        const data = await response.json().catch(() => ({}));
        showToast(data.detail || 'Lỗi khi thêm doanh nghiệp', 'error');
      }
    } catch (error) {
      showToast('Lỗi khi thêm doanh nghiệp', 'error');
    } finally {
      setCreating(false);
    }
  };

  const exportCsv = () => {
    const header = ['ID', 'Tên doanh nghiệp', 'Mã số thuế', 'Ngành nghề', 'Vùng miền', 'Tỉnh/Thành', 'Quy mô', 'Trạng thái', 'Độ tin cậy', 'Nguồn dữ liệu', 'Ngày cập nhật'];
    const rows = filtered.map(b => [b.id, b.name, b.tax_code || '', b.industry || '', formatRegion(b.region), b.location || '', b.scale || '', statusMeta(b.status).label, b.trust_score ?? '', b.source || '', b.updated_at ? new Date(b.updated_at).toLocaleDateString('vi-VN') : '']);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `businesses_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setSearch(''); setRegionFilter('all'); setIndustryFilter('all'); setProvinceFilter('all');
    setStatusFilter('all'); setScaleFilter('all'); setSourceFilter('all');
  };

  if (loading && businesses.length === 0) {
    return (
      <div style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
        <p style={{ marginTop: '16px', color: 'var(--text-dim)' }}>Đang tải doanh nghiệp...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800 }}>Business Management</h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-dim)' }}>Quản lý doanh nghiệp trong hệ thống</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={fetchBusinesses} title="Làm mới" style={{ width: '38px', height: '38px', borderRadius: '10px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RotateCcw size={16} />
          </button>
          <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <Download size={14} /> Xuất dữ liệu
          </button>
          <button onClick={() => { setCreateForm(EMPTY_CREATE_FORM); setShowCreateModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', border: 'none', background: 'var(--color-primary)', color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={15} /> Thêm doanh nghiệp
          </button>
        </div>
      </div>

      <div className="admin-two-col-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px' }}>
            <StatCard icon={<Building2 size={18} />} color="#2563EB" bg="rgba(37,99,235,0.1)" value={counts.total} label="Tổng doanh nghiệp" sub="100% tổng số" />
            <StatCard icon={<CheckCircle2 size={18} />} color="#16A34A" bg="rgba(22,163,74,0.1)" value={counts.active} label="Hoạt động" sub={`${counts.total ? ((counts.active / counts.total) * 100).toFixed(1) : 0}% tổng số`} />
            <StatCard icon={<Clock size={18} />} color="#D97706" bg="rgba(217,119,6,0.1)" value={counts.pending} label="Chờ xác minh" sub={`${counts.total ? ((counts.pending / counts.total) * 100).toFixed(1) : 0}% tổng số`} />
            <StatCard icon={<ShieldCheck size={18} />} color="#0891B2" bg="rgba(8,145,178,0.1)" value={counts.highTrust} label="Độ tin cậy cao (≥80)" sub={`${counts.total ? ((counts.highTrust / counts.total) * 100).toFixed(1) : 0}% tổng số`} />
            <StatCard icon={<TrendingUp size={18} />} color="#7C3AED" bg="rgba(124,58,237,0.1)" value={counts.newThisWeek} label="Mới thêm tuần này" />
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm doanh nghiệp, mã số thuế, người liên hệ..." style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 32px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px' }} />
            </div>
            <button onClick={resetFilters} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <RotateCcw size={14} /> Đặt lại bộ lọc
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px' }}>
              <option value="all">Vùng miền: Tất cả</option>
              {regions.map(r => <option key={r} value={r}>{formatRegion(r)}</option>)}
            </select>
            <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px' }}>
              <option value="all">Ngành nghề: Tất cả</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <select value={provinceFilter} onChange={e => setProvinceFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px' }}>
              <option value="all">Tỉnh/Thành: Tất cả</option>
              {provinces.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px' }}>
              <option value="all">Trạng thái: Tất cả</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={scaleFilter} onChange={e => setScaleFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px' }}>
              <option value="all">Quy mô: Tất cả</option>
              {scales.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px' }}>
              <option value="all">Nguồn dữ liệu: Tất cả</option>
              {sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
            {selected.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: 'var(--bg-input)', borderBottom: '2px solid var(--border-neon)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>Đã chọn {selected.size} doanh nghiệp</span>
                <button onClick={() => setShowAssignRegion(true)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-neon)', background: 'var(--bg-panel)', color: 'var(--text-main)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>Gán vùng</button>
                <button onClick={() => setShowAssignStatus(true)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-neon)', background: 'var(--bg-panel)', color: 'var(--text-main)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>Cập nhật trạng thái</button>
                <button onClick={bulkVerify} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #16A34A', color: '#16A34A', background: 'var(--bg-panel)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>Xác minh</button>
                <button onClick={bulkDelete} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #DC2626', color: '#DC2626', background: 'var(--bg-panel)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>Xóa</button>
                <button onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '12.5px' }}>Bỏ chọn ✕</button>
              </div>
            )}

            {showAssignRegion && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--bg-input)', borderBottom: '2px solid var(--border-neon)' }}>
                <select value={assignRegionValue} onChange={e => setAssignRegionValue(e.target.value)} style={{ padding: '7px 10px', borderRadius: '8px', border: '2px solid var(--border-neon)', fontSize: '12.5px' }}>
                  <option value="Bắc">Bắc</option>
                  <option value="Trung">Trung</option>
                  <option value="Nam">Nam</option>
                </select>
                <button onClick={bulkAssignRegion} style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'white', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Gán</button>
                <button onClick={() => setShowAssignRegion(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-dim)' }}><X size={16} /></button>
              </div>
            )}
            {showAssignStatus && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--bg-input)', borderBottom: '2px solid var(--border-neon)' }}>
                <select value={assignStatusValue} onChange={e => setAssignStatusValue(e.target.value)} style={{ padding: '7px 10px', borderRadius: '8px', border: '2px solid var(--border-neon)', fontSize: '12.5px' }}>
                  {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <button onClick={bulkAssignStatus} style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'white', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Cập nhật</button>
                <button onClick={() => setShowAssignStatus(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-dim)' }}><X size={16} /></button>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-input)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}><input type="checkbox" checked={pageBusinesses.length > 0 && selected.size === pageBusinesses.length} onChange={toggleSelectAll} /></th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>ID</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Doanh nghiệp</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Ngành nghề</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Vùng miền</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Địa điểm</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Quy mô</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Trạng thái</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Độ tin cậy</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Cập nhật</th>
                    <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {pageBusinesses.map(b => {
                    const meta = statusMeta(b.status);
                    return (
                      <tr key={b.id} style={{ borderTop: '1px solid var(--border-neon)' }}>
                        <td style={{ padding: '10px 12px' }}><input type="checkbox" checked={selected.has(b.id)} onChange={() => toggleSelectOne(b.id)} /></td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{b.id}</td>
                        <td style={{ padding: '10px 12px', minWidth: '220px' }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            {b.logo_url ? (
                              <img src={b.logo_url} alt="" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, border: '1px solid var(--border-neon)' }} />
                            ) : (
                              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--bg-input)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Building2 size={16} color="var(--text-dim)" /></div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>{b.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>MST: {b.tax_code || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{b.industry || '—'}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatRegion(b.region)}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{b.location || '—'}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{b.scale || '—'}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: meta.bg, color: meta.color }}>{meta.label}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{b.trust_score != null ? `${b.trust_score}%` : '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{b.updated_at ? new Date(b.updated_at).toLocaleDateString('vi-VN') : '—'}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button title="Xem chi tiết" onClick={() => setViewBusiness(b)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-dim)' }}><Eye size={15} /></button>
                            <button title="Chỉnh sửa" onClick={() => handleEdit(b)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-dim)' }}><Pencil size={15} /></button>
                            <button title="Xác minh" onClick={() => verifyOne(b)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#16A34A' }}><BadgeCheck size={15} /></button>
                            <button title="Xóa" onClick={() => setConfirmDelete({ bulk: false, id: b.id })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#DC2626' }}><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pageBusinesses.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  <Building2 size={48} style={{ opacity: 0.4, marginBottom: '10px' }} />
                  <p>Không tìm thấy doanh nghiệp nào</p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '12px 16px', borderTop: '2px solid var(--border-neon)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={{ padding: '6px 8px', borderRadius: '8px', border: '2px solid var(--border-neon)', fontSize: '12.5px' }}>
                  {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} / trang</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '6px 12px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>‹</button>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ padding: '6px 12px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}>›</button>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>
                Hiển thị {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} đến {Math.min(page * pageSize, filtered.length)} của {filtered.length} kết quả
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={CARD_STYLE}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800 }}>Phân bố theo vùng</h3>
            <DonutChart data={regionDistribution} />
          </div>

          <div style={CARD_STYLE}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800 }}>Ngành nghề nổi bật</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {industryDistribution.map((d, idx) => {
                const max = industryDistribution[0]?.count || 1;
                return (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span>{d.label}</span>
                      <strong>{d.count} ({((d.count / businesses.length) * 100).toFixed(0)}%)</strong>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-input)', overflow: 'hidden' }}>
                      <div style={{ width: `${(d.count / max) * 100}%`, height: '100%', background: '#DC2626', borderRadius: '3px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={CARD_STYLE}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800 }}>Thống kê nhanh</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
              {[
                ['Chờ xác minh', counts.pending],
                ['Chưa có mã số thuế', counts.noTaxCode],
                ['Độ tin cậy thấp (<50)', counts.lowTrust],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>{label}</span><strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {viewBusiness && (
        <div className="modal-overlay" onClick={() => setViewBusiness(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chi tiết doanh nghiệp</h3>
              <button className="modal-close" onClick={() => setViewBusiness(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <h2 className="business-detail-title">{viewBusiness.name}</h2>
              <div className="business-detail-meta">
                <span className="badge">{viewBusiness.industry || 'Chưa phân loại'}</span>
                <span className="badge">{formatRegion(viewBusiness.region)}</span>
                <span className="badge">Tin cậy: {viewBusiness.trust_score}/100</span>
              </div>
              <div className="business-detail-info">
                <p><strong>MST:</strong> {viewBusiness.tax_code || '—'}</p>
                <p><strong>Địa điểm:</strong> {viewBusiness.location || '—'}</p>
                <p><strong>Quy mô:</strong> {viewBusiness.scale || 'N/A'}</p>
                <p><strong>Trạng thái:</strong> {statusMeta(viewBusiness.status).label}</p>
                <p><strong>Nguồn dữ liệu:</strong> {viewBusiness.source || '—'}</p>
                {viewBusiness.phone && <p><strong>SĐT:</strong> {viewBusiness.phone}</p>}
                {viewBusiness.email && <p><strong>Email:</strong> {viewBusiness.email}</p>}
                {viewBusiness.website && <p><strong>Website:</strong> <a href={viewBusiness.website} target="_blank" rel="noopener noreferrer">{viewBusiness.website}</a></p>}
                {viewBusiness.description && (
                  <div className="business-detail-description">
                    <strong>Mô tả:</strong>
                    <p>{viewBusiness.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chỉnh sửa doanh nghiệp</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tên doanh nghiệp</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="form-input" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Ngành nghề</label>
                  <input type="text" value={editForm.industry} onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Vùng miền</label>
                  <select value={editForm.region} onChange={(e) => setEditForm({ ...editForm, region: e.target.value })} className="form-input">
                    <option value="Bắc">Bắc</option>
                    <option value="Trung">Trung</option>
                    <option value="Nam">Nam</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Địa điểm</label>
                <input type="text" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="form-input" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Số điện thoại</label>
                  <input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="form-input" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Website</label>
                  <input type="text" value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Quy mô</label>
                  <input type="text" value={editForm.scale} onChange={(e) => setEditForm({ ...editForm, scale: e.target.value })} className="form-input" placeholder="VD: 50-100 nhân viên" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Trạng thái</label>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="form-input">
                    {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Độ tin cậy (0-100)</label>
                  <input type="number" min="0" max="100" value={editForm.trust_score} onChange={(e) => setEditForm({ ...editForm, trust_score: e.target.value })} className="form-input" />
                </div>
              </div>
              <div className="form-group">
                <label>Mô tả</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="form-textarea" rows="3" />
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
              <h3>Thêm doanh nghiệp</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tên doanh nghiệp</label>
                <input type="text" value={createForm.ten_doanh_nghiep} onChange={e => setCreateForm({ ...createForm, ten_doanh_nghiep: e.target.value })} className="form-input" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Ngành nghề</label>
                  <input type="text" value={createForm.nganh_nghe} onChange={e => setCreateForm({ ...createForm, nganh_nghe: e.target.value })} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Vùng miền</label>
                  <select value={createForm.vung_mien} onChange={e => setCreateForm({ ...createForm, vung_mien: e.target.value })} className="form-input">
                    <option value="Bắc">Bắc</option>
                    <option value="Trung">Trung</option>
                    <option value="Nam">Nam</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Tỉnh/Thành</label>
                <input type="text" value={createForm.tinh_thanh} onChange={e => setCreateForm({ ...createForm, tinh_thanh: e.target.value })} className="form-input" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Số điện thoại</label>
                  <input type="text" value={createForm.so_dien_thoai} onChange={e => setCreateForm({ ...createForm, so_dien_thoai: e.target.value })} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} className="form-input" />
                </div>
              </div>
              <div className="form-group">
                <label>Quy mô</label>
                <input type="text" value={createForm.quy_mo} onChange={e => setCreateForm({ ...createForm, quy_mo: e.target.value })} className="form-input" placeholder="VD: 50-100 nhân viên" />
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>Hủy</button>
                <button className="btn-primary" disabled={creating} onClick={handleCreateSubmit}>{creating ? 'Đang thêm...' : 'Thêm doanh nghiệp'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {confirmDelete && (
        <ConfirmDialog
          title="Xác nhận xóa"
          message={confirmDelete.bulk ? `Bạn có chắc chắn muốn xóa ${confirmDelete.ids.length} doanh nghiệp đã chọn? Hành động này không thể hoàn tác.` : 'Bạn có chắc chắn muốn xóa doanh nghiệp này? Hành động này không thể hoàn tác.'}
          confirmText="Xóa"
          cancelText="Hủy"
          type="danger"
          onConfirm={confirmDeleteBusinesses}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

export default AdminBusinessView;
