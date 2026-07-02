import { useState, useEffect, useMemo } from 'react';
import { Building2, Edit, Trash2, Eye, RefreshCw, Search, X, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import Toast from './Toast';
import ConfirmDialog from './ConfirmDialog';
import LoadingSpinner from './LoadingSpinner';

const ITEMS_PER_PAGE = 20;

const AdminBusinessView = () => {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const formatRegionDisplay = (region) => {
    if (!region) return '';
    const r = region.toLowerCase();
    if (r.includes('bac') || r.includes('bắc')) return 'Bắc';
    if (r.includes('nam')) return 'Nam';
    if (r.includes('trung')) return 'Trung';
    if (r.includes('toan')) return 'Toàn quốc';
    return region;
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/businesses?page_size=100');
      const data = await response.json();
      
      if (data.status === 'success') {
        setBusinesses(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const regions = ['all', 'Bắc', 'Trung', 'Nam'];

  const filteredBusinesses = useMemo(() => {
    return businesses.filter(b => {
      const matchSearch = !searchQuery || 
        b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.industry?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.location?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchRegion = selectedRegion === 'all' || b.region === selectedRegion;
      
      return matchSearch && matchRegion;
    });
  }, [businesses, searchQuery, selectedRegion]);

  const totalPages = Math.ceil(filteredBusinesses.length / ITEMS_PER_PAGE);
  const paginatedBusinesses = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBusinesses.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBusinesses, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedRegion]);

  const handleDelete = async (id) => {
    setConfirmDelete(id);
  };

  const confirmDeleteBusiness = async () => {
    const id = confirmDelete;
    setConfirmDelete(null);
    
    try {
      const response = await fetch(`/api/businesses/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        showToast('Đã xóa doanh nghiệp thành công!', 'success');
        fetchBusinesses();
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Lỗi khi xóa doanh nghiệp', 'error');
    }
  };

  const handleEdit = (business) => {
    setEditForm({
      id: business.id,
      name: business.name,
      industry: business.industry,
      region: business.region,
      location: business.location,
      phone: business.phone,
      email: business.email,
      website: business.website,
      scale: business.scale,
      trust_score: business.trust_score || 80,
      description: business.description || ''
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`/api/businesses/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ten_doanh_nghiep: editForm.name,
          nganh_nghe: editForm.industry,
          vung_mien: editForm.region,
          tinh_thanh: editForm.location,
          so_dien_thoai: editForm.phone,
          email: editForm.email,
          website: editForm.website,
          quy_mo: editForm.scale,
          do_tin_cay: editForm.trust_score,
          mo_ta: editForm.description
        })
      });
      
      if (response.ok) {
        showToast('Đã cập nhật doanh nghiệp thành công!', 'success');
        setShowEditModal(false);
        fetchBusinesses();
      }
    } catch (error) {
      console.error('Update error:', error);
      showToast('Lỗi khi cập nhật doanh nghiệp', 'error');
    }
  };

  const handleViewDetail = (business) => {
    setSelectedBusiness(business);
    setOpenDropdown(null);
  };

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

  if (loading && businesses.length === 0) {
    return <LoadingSpinner fullScreen message="Đang tải doanh nghiệp..." />;
  }

  return (
    <div className="admin-business-view">
      <div className="dashboard-header">
        <div>
          <h2>🏢 Business Management</h2>
          <p className="subtitle">Quản lý doanh nghiệp trong hệ thống</p>
        </div>
        <button onClick={fetchBusinesses} className="refresh-btn" disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon business">
            <Building2 size={24} />
          </div>
          <div className="stat-content">
            <h3>{businesses.length}</h3>
            <p>Tổng doanh nghiệp</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <Eye size={24} />
          </div>
          <div className="stat-content">
            <h3>{filteredBusinesses.length}</h3>
            <p>Kết quả lọc</p>
          </div>
        </div>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Tìm kiếm doanh nghiệp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="category-filters">
          {regions.map(region => (
            <button
              key={region}
              className={`category-filter-btn ${selectedRegion === region ? 'active' : ''}`}
              onClick={() => setSelectedRegion(region)}
            >
              {region === 'all' ? 'Tất cả' : region}
            </button>
          ))}
        </div>
      </div>

      <div className="business-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên doanh nghiệp</th>
              <th>Ngành nghề</th>
              <th>Vùng miền</th>
              <th>Địa điểm</th>
              <th>Trust Score</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {paginatedBusinesses.map(business => (
              <tr key={business.id}>
                <td>{business.id}</td>
                <td className="business-name">{business.name}</td>
                <td>{business.industry || 'N/A'}</td>
                <td>
                  <span className={`badge region-${business.region}`}>{formatRegionDisplay(business.region)}</span>
                </td>
                <td>{business.location}</td>
                <td>
                  <span className="trust-score">{business.trust_score || 'N/A'}</span>
                </td>
                <td className="actions-cell">
                  <div className="dropdown-wrapper">
                    <button
                      className="action-btn menu"
                      onClick={() => toggleDropdown(business.id)}
                      title="Hành động"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {openDropdown === business.id && (
                      <div className="dropdown-menu">
                        <button
                          className="dropdown-item"
                          onClick={() => handleViewDetail(business)}
                        >
                          <Eye size={16} />
                          <span>Xem chi tiết</span>
                        </button>
                        <button
                          className="dropdown-item"
                          onClick={() => { handleEdit(business); setOpenDropdown(null); }}
                        >
                          <Edit size={16} />
                          <span>Chỉnh sửa</span>
                        </button>
                        <button
                          className="dropdown-item delete"
                          onClick={() => { handleDelete(business.id); setOpenDropdown(null); }}
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

        {filteredBusinesses.length === 0 && (
          <div className="empty-state">
            <Building2 size={64} />
            <p>Không tìm thấy doanh nghiệp nào</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={18} />
            <span>Trước</span>
          </button>
          
          <div className="pagination-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <button
                    key={page}
                    className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                );
              } else if (page === currentPage - 2 || page === currentPage + 2) {
                return <span key={page} className="pagination-ellipsis">...</span>;
              }
              return null;
            })}
          </div>

          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <span>Sau</span>
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chỉnh sửa doanh nghiệp</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Tên doanh nghiệp</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  className="form-input"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ngành nghề</label>
                  <input
                    type="text"
                    value={editForm.industry}
                    onChange={(e) => setEditForm({...editForm, industry: e.target.value})}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Vùng miền</label>
                  <select
                    value={editForm.region}
                    onChange={(e) => setEditForm({...editForm, region: e.target.value})}
                    className="form-input"
                  >
                    <option value="Bắc">Bắc</option>
                    <option value="Trung">Trung</option>
                    <option value="Nam">Nam</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Địa điểm</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                  className="form-input"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Số điện thoại</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Website</label>
                  <input
                    type="text"
                    value={editForm.website}
                    onChange={(e) => setEditForm({...editForm, website: e.target.value})}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Quy mô</label>
                  <input
                    type="text"
                    value={editForm.scale}
                    onChange={(e) => setEditForm({...editForm, scale: e.target.value})}
                    className="form-input"
                    placeholder="VD: 50-100 nhân viên"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Mô tả</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  className="form-textarea"
                  rows="3"
                />
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

      {selectedBusiness && (
        <div className="modal-overlay" onClick={() => setSelectedBusiness(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chi tiết doanh nghiệp</h3>
              <button className="modal-close" onClick={() => setSelectedBusiness(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <h2 className="business-detail-title">{selectedBusiness.name}</h2>
              
              <div className="business-detail-meta">
                <span className="badge">{selectedBusiness.industry}</span>
                <span className={`badge region-${selectedBusiness.region}`}>{formatRegionDisplay(selectedBusiness.region)}</span>
                <span className="badge">Trust: {selectedBusiness.trust_score}/100</span>
              </div>

              <div className="business-detail-info">
                <p><strong>Địa điểm:</strong> {selectedBusiness.location}</p>
                <p><strong>Quy mô:</strong> {selectedBusiness.scale || 'N/A'}</p>
                {selectedBusiness.phone && <p><strong>SĐT:</strong> {selectedBusiness.phone}</p>}
                {selectedBusiness.email && <p><strong>Email:</strong> {selectedBusiness.email}</p>}
                {selectedBusiness.website && <p><strong>Website:</strong> <a href={selectedBusiness.website} target="_blank" rel="noopener noreferrer">{selectedBusiness.website}</a></p>}
                {selectedBusiness.description && (
                  <div className="business-detail-description">
                    <strong>Mô tả:</strong>
                    <p>{selectedBusiness.description}</p>
                  </div>
                )}
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
          message="Bạn có chắc chắn muốn xóa doanh nghiệp này? Hành động này không thể hoàn tác."
          confirmText="Xóa"
          cancelText="Hủy"
          type="danger"
          onConfirm={confirmDeleteBusiness}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

export default AdminBusinessView;
