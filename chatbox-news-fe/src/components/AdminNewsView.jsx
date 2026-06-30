import { useState, useEffect, useMemo } from 'react';
import { Newspaper, Edit, Trash2, Eye, RefreshCw, Search, X, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import Toast from './Toast';
import ConfirmDialog from './ConfirmDialog';
import LoadingSpinner from './LoadingSpinner';

const ITEMS_PER_PAGE = 20;

const AdminNewsView = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedNews, setSelectedNews] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://127.0.0.1:8000/api/news?page_size=1000');
      const data = await response.json();
      
      if (data.status === 'success') {
        setNews(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const categories = useMemo(() => {
    const cats = [...new Set(news.map(n => n.category).filter(Boolean))];
    return ['all', ...cats.sort()];
  }, [news]);

  const filteredNews = useMemo(() => {
    return news.filter(n => {
      const matchSearch = !searchQuery || 
        n.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.summary?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCategory = selectedCategory === 'all' || n.category === selectedCategory;
      
      return matchSearch && matchCategory;
    });
  }, [news, searchQuery, selectedCategory]);

  const totalPages = Math.ceil(filteredNews.length / ITEMS_PER_PAGE);
  const paginatedNews = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredNews.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredNews, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  const handleDelete = async (id) => {
    setConfirmDelete(id);
  };

  const confirmDeleteNews = async () => {
    const id = confirmDelete;
    setConfirmDelete(null);
    
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/news/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        showToast('Đã xóa tin tức thành công!', 'success');
        fetchNews();
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Lỗi khi xóa tin tức', 'error');
    }
  };

  const handleEdit = (newsItem) => {
    setEditForm({
      id: newsItem.id,
      title: newsItem.title,
      summary: newsItem.summary,
      category: newsItem.category,
      source: newsItem.source,
      region: newsItem.region,
      url: newsItem.url,
      image: newsItem.image,
      trust_score: newsItem.trust_score || 80,
      status: newsItem.status || 'active'
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/news/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tieu_de: editForm.title,
          tom_tat: editForm.summary,
          chuyen_muc: editForm.category,
          nha_dai: editForm.source,
          vung_mien: editForm.region,
          url: editForm.url,
          anh_dai_dien: editForm.image,
          do_tin_cay: editForm.trust_score,
          trang_thai: editForm.status
        })
      });
      
      if (response.ok) {
        showToast('Đã cập nhật tin tức thành công!', 'success');
        setShowEditModal(false);
        fetchNews();
      }
    } catch (error) {
      console.error('Update error:', error);
      showToast('Lỗi khi cập nhật tin tức', 'error');
    }
  };

  const handleViewDetail = (newsItem) => {
    setSelectedNews(newsItem);
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

  if (loading && news.length === 0) {
    return <LoadingSpinner fullScreen message="Đang tải tin tức..." />;
  }

  return (
    <div className="admin-news-view">
      <div className="dashboard-header">
        <div>
          <h2>📰 News Management</h2>
          <p className="subtitle">Quản lý tin tức trong hệ thống</p>
        </div>
        <button onClick={fetchNews} className="refresh-btn" disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon news">
            <Newspaper size={24} />
          </div>
          <div className="stat-content">
            <h3>{news.length}</h3>
            <p>Tổng số tin</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <Eye size={24} />
          </div>
          <div className="stat-content">
            <h3>{filteredNews.length}</h3>
            <p>Kết quả lọc</p>
          </div>
        </div>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Tìm kiếm tin tức..."
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
          {categories.map(cat => (
            <button
              key={cat}
              className={`category-filter-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat === 'all' ? 'Tất cả' : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="news-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tiêu đề</th>
              <th>Chuyên mục</th>
              <th>Nguồn</th>
              <th>Vùng</th>
              <th>Ngày tạo</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {paginatedNews.map(newsItem => (
              <tr key={newsItem.id}>
                <td>{newsItem.id}</td>
                <td className="news-title">{newsItem.title}</td>
                <td>
                  <span className="badge category">{newsItem.category || 'N/A'}</span>
                </td>
                <td>{newsItem.source}</td>
                <td>{newsItem.region}</td>
                <td>{new Date(newsItem.created_at).toLocaleDateString('vi-VN')}</td>
                <td className="actions-cell">
                  <div className="dropdown-wrapper">
                    <button
                      className="action-btn menu"
                      onClick={() => toggleDropdown(newsItem.id)}
                      title="Hành động"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {openDropdown === newsItem.id && (
                      <div className="dropdown-menu">
                        <button
                          className="dropdown-item"
                          onClick={() => handleViewDetail(newsItem)}
                        >
                          <Eye size={16} />
                          <span>Xem chi tiết</span>
                        </button>
                        <button
                          className="dropdown-item"
                          onClick={() => { handleEdit(newsItem); setOpenDropdown(null); }}
                        >
                          <Edit size={16} />
                          <span>Chỉnh sửa</span>
                        </button>
                        <button
                          className="dropdown-item delete"
                          onClick={() => { handleDelete(newsItem.id); setOpenDropdown(null); }}
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

        {filteredNews.length === 0 && (
          <div className="empty-state">
            <Newspaper size={64} />
            <p>Không tìm thấy tin tức nào</p>
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
              <h3>Chỉnh sửa tin tức</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Tiêu đề</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Tóm tắt</label>
                <textarea
                  value={editForm.summary}
                  onChange={(e) => setEditForm({...editForm, summary: e.target.value})}
                  className="form-textarea"
                  rows="4"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Chuyên mục</label>
                  <input
                    type="text"
                    value={editForm.category}
                    onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Nguồn</label>
                  <input
                    type="text"
                    value={editForm.source}
                    onChange={(e) => setEditForm({...editForm, source: e.target.value})}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
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

                <div className="form-group">
                  <label>Trạng thái</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                    className="form-input"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>URL</label>
                <input
                  type="text"
                  value={editForm.url}
                  onChange={(e) => setEditForm({...editForm, url: e.target.value})}
                  className="form-input"
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

      {selectedNews && (
        <div className="modal-overlay" onClick={() => setSelectedNews(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chi tiết tin tức</h3>
              <button className="modal-close" onClick={() => setSelectedNews(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <h2 className="news-detail-title">{selectedNews.title}</h2>
              
              <div className="news-detail-meta">
                <span className="badge">{selectedNews.category}</span>
                <span className="badge">{selectedNews.source}</span>
                <span className="badge">{selectedNews.region}</span>
              </div>

              <div className="news-detail-summary">
                <strong>Tóm tắt:</strong>
                <p>{selectedNews.summary}</p>
              </div>

              {selectedNews.image && (
                <div className="news-detail-image">
                  <img src={selectedNews.image} alt={selectedNews.title} />
                </div>
              )}

              <div className="news-detail-info">
                <p><strong>URL:</strong> <a href={selectedNews.url} target="_blank" rel="noopener noreferrer">{selectedNews.url}</a></p>
                <p><strong>Trust Score:</strong> {selectedNews.trust_score}/100</p>
                <p><strong>Ngày tạo:</strong> {new Date(selectedNews.created_at).toLocaleString('vi-VN')}</p>
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
          message="Bạn có chắc chắn muốn xóa tin tức này? Hành động này không thể hoàn tác."
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
