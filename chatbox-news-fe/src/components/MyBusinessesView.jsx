import { useState, useEffect, useMemo } from 'react';
import {
  X, Trash2, Edit, Building2, RefreshCw, History, Search,
  Users, Briefcase, Newspaper, LayoutGrid, List
} from 'lucide-react';
import { createPortal } from 'react-dom';
import Toast from './Toast';
import ConfirmDialog from './molecules/ConfirmDialog/ConfirmDialog';
import UserAuditLogModal from './UserAuditLogModal';

const FIELD_ICON = {
  'công nghệ': '💻', 'thông tin': '💻', 'phần mềm': '💻', 'ai': '🤖',
  'fintech': '💳', 'tài chính': '💳', 'ngân hàng': '💳',
  'xây dựng': '🏗️', 'bất động sản': '🏠',
  'giáo dục': '📚', 'đào tạo': '📚',
  'logistics': '🚚', 'vận chuyển': '🚚',
  'thương mại': '🛒', 'bán lẻ': '🛒',
  'du lịch': '✈️', 'khách sạn': '🏨',
  'thực phẩm': '🍜', 'đồ uống': '☕',
  'sản xuất': '🏭',
  'tư vấn': '📊',
};

function getBizIcon(name = '', description = '') {
  const text = (name + ' ' + description).toLowerCase();
  for (const [key, icon] of Object.entries(FIELD_ICON)) {
    if (text.includes(key)) return icon;
  }
  return '🏢';
}

function normalizeText(text) {
  if (!text) return '';
  return text.toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const EMPTY_FORM = {
  ten_doanh_nghiep: '', nganh_nghe: '', vung_mien: '', tinh_thanh: '', dia_chi: '',
  so_dien_thoai: '', email: '', website: '', quy_mo: '', nhan_su: '', dang_tuyen: '', mo_ta: ''
};

function businessToForm(b) {
  return {
    ten_doanh_nghiep: b.name || '', nganh_nghe: b.industry || '', vung_mien: b.region || '',
    tinh_thanh: b.location || '', dia_chi: b.address || '', so_dien_thoai: b.phone || '',
    email: b.email || '', website: b.website || '', quy_mo: b.scale || '',
    nhan_su: b.nhan_su ?? '', dang_tuyen: b.dang_tuyen ?? '', mo_ta: b.description || ''
  };
}

function MyBusinessesView({ currentUser, allNews = [] }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [toast, setToast] = useState(null);
  const [auditLogBusiness, setAuditLogBusiness] = useState(null);
  const [confirmDeleteBusiness, setConfirmDeleteBusiness] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');

  const [formMode, setFormMode] = useState(null); // null | 'create' | 'edit'
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingLogoUrl, setEditingLogoUrl] = useState(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchMyBusinesses = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Vui lòng đăng nhập', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/businesses/my-businesses?page=1&page_size=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Không thể tải danh sách doanh nghiệp');
      }

      const result = await response.json();
      setBusinesses(result.data || []);
    } catch (error) {
      showToast('❌ ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyBusinesses();
  }, []);

  const relatedNewsCountMap = useMemo(() => {
    const map = new Map();
    businesses.forEach((biz) => {
      const name = normalizeText(biz.name);
      if (!name) { map.set(biz.id, 0); return; }
      let count = 0;
      for (const news of allNews) {
        const haystack = normalizeText(news.tieu_de) + ' ' + normalizeText(news.tom_tat);
        if (haystack.includes(name)) count++;
      }
      map.set(biz.id, count);
    });
    return map;
  }, [businesses, allNews]);

  const stats = useMemo(() => ({ total: businesses.length }), [businesses]);

  const filteredBusinesses = useMemo(() => {
    const q = normalizeText(searchQuery);
    return businesses.filter((b) => {
      const matchRegion = regionFilter === 'all' || normalizeText(b.region).includes(normalizeText(regionFilter));
      const matchSearch = !q ||
        normalizeText(b.name).includes(q) ||
        normalizeText(b.industry).includes(q) ||
        normalizeText(b.location).includes(q);
      return matchRegion && matchSearch;
    });
  }, [businesses, searchQuery, regionFilter]);

  const handleDelete = async (businessId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Xóa thất bại');
      }

      showToast('✅ Xóa doanh nghiệp thành công', 'success');
      if (selectedBusiness?.id === businessId) closeModal();
      fetchMyBusinesses();
    } catch (error) {
      showToast('❌ ' + error.message, 'error');
    }
  };

  const openModal = (business) => {
    setSelectedBusiness(business);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setSelectedBusiness(null);
    document.body.style.overflow = 'auto';
  };

  const openEditForm = (business) => {
    setFormMode('edit');
    setFormData(businessToForm(business));
    setEditingId(business.id);
    setEditingLogoUrl(business.logo_url || null);
  };

  const closeForm = () => {
    setFormMode(null);
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setEditingLogoUrl(null);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editingId) return;

    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Vui lòng đăng nhập', 'error');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await fetch(`/api/businesses/${editingId}/upload-logo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formDataUpload
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Tải logo thất bại');
      }

      setEditingLogoUrl(data.logo_url);
      showToast('✅ Đã cập nhật logo', 'success');
      fetchMyBusinesses();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleFormFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Vui lòng đăng nhập', 'error');
      return;
    }
    if (!formData.ten_doanh_nghiep.trim()) {
      showToast('Vui lòng nhập tên doanh nghiệp', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        nhan_su: formData.nhan_su === '' ? null : Number(formData.nhan_su),
        dang_tuyen: formData.dang_tuyen === '' ? null : Number(formData.dang_tuyen),
      };

      const url = formMode === 'edit' ? `/api/businesses/${editingId}` : '/api/businesses';
      const method = formMode === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Lưu thất bại');
      }

      showToast(formMode === 'edit' ? '✅ Đã cập nhật doanh nghiệp' : '✅ Đã thêm doanh nghiệp mới', 'success');
      closeForm();
      fetchMyBusinesses();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="main-content-area fade-in-effect">
      <div style={{
        marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid var(--border-neon)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={22} /> Doanh nghiệp của tôi
          </h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '13px', margin: 0 }}>Quản lý các doanh nghiệp bạn đã đăng ký</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ background: 'white', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(215,30,40,0.1)', color: '#3B0199', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Building2 size={16} />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, lineHeight: 1 }}>{stats.total}</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>Tổng doanh nghiệp</div>
            </div>
          </div>

          <button onClick={fetchMyBusinesses} className="refresh-btn" title="Làm mới" style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      <div className="news-filters">
        <div className="search-box">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên, ngành nghề, địa điểm..."
              className="search-input"
              style={{ width: '100%' }}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '12px' }}>✕</button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div className="category-filters" style={{ margin: 0 }}>
            {['all', 'Bac', 'Trung', 'Nam'].map(r => (
              <button
                key={r}
                className={`category-filter-btn ${regionFilter === r ? 'active' : ''}`}
                onClick={() => setRegionFilter(r)}
              >
                {r === 'all' ? 'Tất cả' : r === 'Bac' ? 'Miền Bắc' : r === 'Trung' ? 'Miền Trung' : 'Miền Nam'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{ width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border-neon)', borderRadius: '8px', cursor: 'pointer', background: viewMode === 'grid' ? 'var(--color-primary)' : 'white', color: viewMode === 'grid' ? 'white' : 'var(--text-dim)' }}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{ width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border-neon)', borderRadius: '8px', cursor: 'pointer', background: viewMode === 'list' ? 'var(--color-primary)' : 'white', color: viewMode === 'list' ? 'white' : 'var(--text-dim)' }}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Đang tải...</p>
        </div>
      ) : filteredBusinesses.length === 0 ? (
        <div className="empty-state">
          <Building2 size={48} style={{ opacity: 0.4, marginBottom: '10px' }} />
          <p>{businesses.length === 0 ? 'Bạn chưa đăng ký doanh nghiệp nào. Hãy thêm doanh nghiệp đầu tiên!' : 'Không tìm thấy doanh nghiệp phù hợp.'}</p>
        </div>
      ) : (
        <div className="biz-card-grid" style={viewMode === 'list' ? { gridTemplateColumns: '1fr' } : undefined}>
          {filteredBusinesses.map((business) => (
            <div key={business.id} className="biz-card" onClick={() => openModal(business)}>
              <div className="biz-card-icon">
                {business.logo_url ? (
                  <img src={business.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  getBizIcon(business.name, business.description)
                )}
              </div>

              <div className="biz-card-body">
                <h4 className="biz-card-name">{business.name}</h4>
                <p className="biz-card-location">
                  📍 {business.location || 'Việt Nam'}
                  {business.industry && <span> · {business.industry}</span>}
                </p>
                <div style={{ display: 'flex', gap: '14px', marginTop: '8px', fontSize: '11.5px', color: 'var(--text-dim)' }}>
                  <span title="Nhân sự" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Users size={13} /> {business.nhan_su ?? '—'}
                  </span>
                  <span title="Đang tuyển dụng" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Briefcase size={13} /> {business.dang_tuyen ?? 0}
                  </span>
                  <span title="Tin tức liên quan" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Newspaper size={13} /> {relatedNewsCountMap.get(business.id) || 0}
                  </span>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--text-dim)' }}>🕒 Đăng ngày: {formatDate(business.created_at)}</p>
              </div>

              <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  onClick={() => openEditForm(business)}
                  title="Sửa"
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-main)' }}
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => setAuditLogBusiness(business)}
                  title="Xem lịch sử"
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: '2px solid rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#3b82f6' }}
                >
                  <History size={14} />
                </button>
                <button
                  onClick={() => setConfirmDeleteBusiness(business)}
                  title="Xóa"
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: '2px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedBusiness && createPortal(
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              <X size={20} />
            </button>

            <h2 className="modal-title">
              {getBizIcon(selectedBusiness.name, selectedBusiness.description)} {selectedBusiness.name}
            </h2>

            <div className="modal-body">
              <div className="business-info-grid">
                {selectedBusiness.address && (
                  <div className="business-info-item"><strong>📍 Địa chỉ:</strong><span>{selectedBusiness.address}</span></div>
                )}
                {selectedBusiness.location && (
                  <div className="business-info-item"><strong>🏙️ Tỉnh/Thành:</strong><span>{selectedBusiness.location}</span></div>
                )}
                {selectedBusiness.phone && (
                  <div className="business-info-item"><strong>📞 Điện thoại:</strong><span>{selectedBusiness.phone}</span></div>
                )}
                {selectedBusiness.email && (
                  <div className="business-info-item"><strong>📧 Email:</strong><span>{selectedBusiness.email}</span></div>
                )}
                {selectedBusiness.scale && (
                  <div className="business-info-item"><strong>👥 Quy mô:</strong><span>{selectedBusiness.scale}</span></div>
                )}
                {selectedBusiness.industry && (
                  <div className="business-info-item"><strong>🏭 Ngành nghề:</strong><span>{selectedBusiness.industry}</span></div>
                )}
                {selectedBusiness.nhan_su != null && (
                  <div className="business-info-item"><strong>👤 Nhân sự:</strong><span>{selectedBusiness.nhan_su}</span></div>
                )}
                {selectedBusiness.dang_tuyen != null && (
                  <div className="business-info-item"><strong>💼 Đang tuyển:</strong><span>{selectedBusiness.dang_tuyen} vị trí</span></div>
                )}
              </div>

              {selectedBusiness.description && (
                <div className="modal-detail">
                  <h4>📋 Mô tả</h4>
                  <p>{selectedBusiness.description}</p>
                </div>
              )}

              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button onClick={() => openEditForm(selectedBusiness)} className="btn-secondary">
                  <Edit size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Sửa
                </button>
                <button
                  onClick={() => setConfirmDeleteBusiness(selectedBusiness)}
                  className="btn-cancel"
                  style={{ background: '#ef4444', color: 'white', border: 'none' }}
                >
                  <Trash2 size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Xóa
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create / Edit Modal */}
      {formMode && createPortal(
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeForm}><X size={20} /></button>
            <h2 className="modal-title">{formMode === 'edit' ? 'Sửa doanh nghiệp' : 'Thêm doanh nghiệp'}</h2>

            {formMode === 'edit' && (
              <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '12px', background: '#F8FAFC',
                  border: '2px solid var(--border-neon)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                }}>
                  {editingLogoUrl ? (
                    <img src={editingLogoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <Building2 size={26} color="var(--text-dim)" />
                  )}
                </div>
                <div>
                  <label>Logo doanh nghiệp</label>
                  <div style={{ marginTop: '6px' }}>
                    <label className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', padding: '8px 16px' }}>
                      {isUploadingLogo ? 'Đang tải...' : 'Tải ảnh lên'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLogoUpload}
                        disabled={isUploadingLogo}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: 'var(--text-dim)' }}>PNG, JPG, WEBP hoặc SVG, tối đa 5MB</p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label>Tên doanh nghiệp *</label>
                <input className="form-input" value={formData.ten_doanh_nghiep}
                  onChange={(e) => handleFormFieldChange('ten_doanh_nghiep', e.target.value)} required />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ngành nghề</label>
                  <input className="form-input" value={formData.nganh_nghe}
                    onChange={(e) => handleFormFieldChange('nganh_nghe', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Quy mô</label>
                  <input className="form-input" value={formData.quy_mo}
                    onChange={(e) => handleFormFieldChange('quy_mo', e.target.value)} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Vùng miền</label>
                  <input className="form-input" value={formData.vung_mien} placeholder="Bắc / Trung / Nam"
                    onChange={(e) => handleFormFieldChange('vung_mien', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Tỉnh/Thành</label>
                  <input className="form-input" value={formData.tinh_thanh}
                    onChange={(e) => handleFormFieldChange('tinh_thanh', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>Địa chỉ</label>
                <input className="form-input" value={formData.dia_chi}
                  onChange={(e) => handleFormFieldChange('dia_chi', e.target.value)} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Số điện thoại</label>
                  <input className="form-input" value={formData.so_dien_thoai}
                    onChange={(e) => handleFormFieldChange('so_dien_thoai', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input className="form-input" type="email" value={formData.email}
                    onChange={(e) => handleFormFieldChange('email', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>Website</label>
                <input className="form-input" value={formData.website}
                  onChange={(e) => handleFormFieldChange('website', e.target.value)} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Nhân sự</label>
                  <input className="form-input" type="number" min="0" value={formData.nhan_su}
                    onChange={(e) => handleFormFieldChange('nhan_su', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Đang tuyển dụng</label>
                  <input className="form-input" type="number" min="0" value={formData.dang_tuyen}
                    onChange={(e) => handleFormFieldChange('dang_tuyen', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>Mô tả</label>
                <textarea className="form-textarea" value={formData.mo_ta}
                  onChange={(e) => handleFormFieldChange('mo_ta', e.target.value)} />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeForm}>Hủy</button>
                <button type="submit" className="btn-primary" disabled={isSaving}>
                  {isSaving ? 'Đang lưu...' : formMode === 'edit' ? 'Lưu thay đổi' : 'Thêm doanh nghiệp'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {confirmDeleteBusiness && (
        <ConfirmDialog
          title="Xác nhận xóa"
          message={`Bạn có chắc chắn muốn xóa "${confirmDeleteBusiness.name}"?`}
          confirmText="Xóa"
          cancelText="Hủy"
          type="danger"
          onConfirm={() => { handleDelete(confirmDeleteBusiness.id); setConfirmDeleteBusiness(null); }}
          onCancel={() => setConfirmDeleteBusiness(null)}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {auditLogBusiness && (
        <UserAuditLogModal
          business={auditLogBusiness}
          onClose={() => setAuditLogBusiness(null)}
        />
      )}
    </div>
  );
}

export default MyBusinessesView;
