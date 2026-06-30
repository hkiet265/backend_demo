import { useState, useEffect } from 'react';
import { X, Trash2, Edit, Building2, RefreshCw } from 'lucide-react';
import { createPortal } from 'react-dom';
import Toast from './Toast';

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

function MyBusinessesView({ currentUser }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchMyBusinesses = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      showToast('Vui lòng đăng nhập', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('http://127.0.0.1:8000/api/businesses/my-businesses?page=1&page_size=100', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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

  const handleDelete = async (businessId, businessName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa "${businessName}"?`)) {
      return;
    }

    const token = localStorage.getItem('access_token');
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/businesses/${businessId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Xóa thất bại');
      }

      showToast('✅ Xóa doanh nghiệp thành công', 'success');
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

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="main-content-area fade-in-effect">
      <div className="my-businesses-view">
        <div className="view-header" style={{ marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
              <Building2 size={28} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
              Doanh nghiệp của tôi
            </h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
              Quản lý các doanh nghiệp bạn đã đăng ký
            </p>
          </div>
          <button 
            className="refresh-btn" 
            onClick={fetchMyBusinesses}
            disabled={loading}
            title="Làm mới"
          >
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
            <RefreshCw size={32} className="spinning" />
            <p style={{ marginTop: '12px' }}>Đang tải...</p>
          </div>
        ) : businesses.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '2px dashed var(--border-color)'
          }}>
            <Building2 size={48} style={{ color: 'var(--text-dim)', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>
              Chưa có doanh nghiệp nào
            </h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
              Bạn chưa đăng ký doanh nghiệp nào. Hãy thêm doanh nghiệp đầu tiên!
            </p>
          </div>
        ) : (
          <>
            <div style={{ 
              marginBottom: '16px', 
              padding: '12px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              color: 'var(--text-dim)'
            }}>
              📊 Tổng số: <strong style={{ color: 'var(--color-primary)' }}>{businesses.length}</strong> doanh nghiệp
            </div>

            <div className="my-businesses-list">
              {businesses.map((business) => (
                <div 
                  key={business.id} 
                  className="my-business-card"
                  onClick={() => openModal(business)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="business-card-header">
                    <h3 className="business-card-title">
                      {getBizIcon(business.name, business.description)} {business.name}
                    </h3>
                    <div className="business-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="icon-btn delete-btn"
                        onClick={() => handleDelete(business.id, business.name)}
                        title="Xóa"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="business-card-info">
                    {business.industry && (
                      <span className="info-badge">{business.industry}</span>
                    )}
                    {business.location && (
                      <span className="info-text">📍 {business.location}</span>
                    )}
                    {business.scale && (
                      <span className="info-text">👥 {business.scale}</span>
                    )}
                  </div>

                  <div className="business-card-meta">
                    <span>🕒 Đăng ngày: {formatDate(business.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

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
                  <div className="business-info-item">
                    <strong>📍 Địa chỉ:</strong>
                    <span>{selectedBusiness.address}</span>
                  </div>
                )}
                {selectedBusiness.location && (
                  <div className="business-info-item">
                    <strong>🏙️ Tỉnh/Thành:</strong>
                    <span>{selectedBusiness.location}</span>
                  </div>
                )}
                {selectedBusiness.phone && (
                  <div className="business-info-item">
                    <strong>📞 Điện thoại:</strong>
                    <span>{selectedBusiness.phone}</span>
                  </div>
                )}
                {selectedBusiness.email && (
                  <div className="business-info-item">
                    <strong>📧 Email:</strong>
                    <span>{selectedBusiness.email}</span>
                  </div>
                )}
                {selectedBusiness.scale && (
                  <div className="business-info-item">
                    <strong>👥 Quy mô:</strong>
                    <span>{selectedBusiness.scale}</span>
                  </div>
                )}
                {selectedBusiness.industry && (
                  <div className="business-info-item">
                    <strong>🏭 Ngành nghề:</strong>
                    <span>{selectedBusiness.industry}</span>
                  </div>
                )}
              </div>

              {selectedBusiness.description && (
                <div className="modal-detail">
                  <h4>📋 Mô tả</h4>
                  <p>{selectedBusiness.description}</p>
                </div>
              )}

              <div style={{ 
                marginTop: '24px', 
                paddingTop: '16px', 
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => handleDelete(selectedBusiness.id, selectedBusiness.name)}
                  className="btn-cancel"
                  style={{ 
                    background: '#ef4444', 
                    color: 'white',
                    border: 'none'
                  }}
                >
                  <Trash2 size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Xóa
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default MyBusinessesView;
