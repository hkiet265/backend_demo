import React, { useState, useEffect, useMemo } from 'react';
import { Heart, Trash2, Calendar, MapPin, Phone, Globe, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import Toast from './Toast';
import ConfirmDialog from './ConfirmDialog';

const ITEMS_PER_PAGE = 5;

const FavoritesView = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState('news');
  const [newsBookmarks, setNewsBookmarks] = useState([]);
  const [businessBookmarks, setBusinessBookmarks] = useState([]);
  const [stats, setStats] = useState({ news_count: 0, business_count: 0, total: 0 });
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selectedNews, setSelectedNews] = useState(null);
  const [newsPage, setNewsPage] = useState(1);
  const [businessPage, setBusinessPage] = useState(1);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Paginated news
  const paginatedNews = useMemo(() => {
    const start = (newsPage - 1) * ITEMS_PER_PAGE;
    return newsBookmarks.slice(start, start + ITEMS_PER_PAGE);
  }, [newsBookmarks, newsPage]);

  const newsTotalPages = Math.ceil(newsBookmarks.length / ITEMS_PER_PAGE);

  // Paginated businesses
  const paginatedBusinesses = useMemo(() => {
    const start = (businessPage - 1) * ITEMS_PER_PAGE;
    return businessBookmarks.slice(start, start + ITEMS_PER_PAGE);
  }, [businessBookmarks, businessPage]);

  const businessTotalPages = Math.ceil(businessBookmarks.length / ITEMS_PER_PAGE);

  // Reset page when switching tabs
  useEffect(() => {
    if (activeTab === 'news') {
      setNewsPage(1);
    } else {
      setBusinessPage(1);
    }
  }, [activeTab]);

  const fetchBookmarks = async () => {
    if (!currentUser) return;

    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Vui lòng đăng nhập lại', 'error');
      return;
    }

    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [newsRes, businessRes, statsRes] = await Promise.all([
        fetch('/api/bookmarks/news', { headers }),
        fetch('/api/bookmarks/businesses', { headers }),
        fetch('/api/bookmarks/stats', { headers })
      ]);

      if (newsRes.ok) {
        const data = await newsRes.json();
        setNewsBookmarks(data || []);
      }

      if (businessRes.ok) {
        const data = await businessRes.json();
        setBusinessBookmarks(data || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.data);
      }

    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
      showToast('Lỗi khi tải danh sách yêu thích', 'error');
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, [currentUser]);

  // Cleanup: restore scroll when component unmounts
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const handleRemoveNews = (newsId) => {
    setConfirmDelete({ type: 'news', id: newsId });
  };

  const handleRemoveBusiness = (businessId) => {
    setConfirmDelete({ type: 'business', id: businessId });
  };

  const confirmRemove = async () => {
    const { type, id } = confirmDelete;
    setConfirmDelete(null);

    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Vui lòng đăng nhập lại', 'error');
      return;
    }

    try {
      const endpoint = type === 'news' 
        ? `/api/bookmarks/news/${id}`
        : `/api/bookmarks/businesses/${id}`;

      const response = await fetch(endpoint, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        showToast('Đã xóa khỏi yêu thích', 'success');
        fetchBookmarks();
      } else {
        showToast('Lỗi khi xóa', 'error');
      }
    } catch (error) {
      console.error('Error removing bookmark:', error);
      showToast('Lỗi khi xóa', 'error');
    }
  };

  const openNewsDetail = (news) => {
    setSelectedNews(news);
    document.body.style.overflow = 'hidden';
  };

  const closeNewsDetail = () => {
    setSelectedNews(null);
    document.body.style.overflow = 'auto';
  };

  if (!currentUser) {
    return (
      <div className="favorites-view">
        <div className="empty-state">
          <Heart size={64} />
          <p>Vui lòng đăng nhập để xem danh sách yêu thích</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content-area fade-in-effect">
      <div className="favorites-view">
        <div className="favorites-header">
          <div>
            <h2>❤️ Danh Sách Yêu Thích</h2>
            <p className="subtitle">Quản lý tin tức và doanh nghiệp bạn quan tâm</p>
          </div>
        </div>

        <div className="favorites-tabs">
        <button
          className={`tab-btn ${activeTab === 'news' ? 'active' : ''}`}
          onClick={() => setActiveTab('news')}
        >
          📰 Tin Tức ({stats.news_count})
        </button>
        <button
          className={`tab-btn ${activeTab === 'business' ? 'active' : ''}`}
          onClick={() => setActiveTab('business')}
        >
          🏢 Doanh Nghiệp ({stats.business_count})
        </button>
      </div>

      {activeTab === 'news' && (
        <>
          <div className="bookmarks-grid">
            {newsBookmarks.length === 0 ? (
              <div className="empty-state">
                <Heart size={64} />
                <p>Chưa có tin tức yêu thích</p>
                <p className="hint">Nhấn vào icon ❤️ ở tin tức để lưu vào danh sách này</p>
              </div>
            ) : (
              paginatedNews.map((item) => (
              <div key={item.id} className="bookmark-card">
                <div className="bookmark-header">
                  <div className="bookmark-meta">
                    <span className="badge category">{item.chuyen_muc}</span>
                    {item.vung_mien && (
                      <span className={`badge region-${item.vung_mien}`}>
                        {item.vung_mien}
                      </span>
                    )}
                  </div>
                  <button
                    className="remove-btn"
                    onClick={() => handleRemoveNews(item.id)}
                    title="Xóa khỏi yêu thích"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <h3 onClick={() => openNewsDetail(item)}>{item.tieu_de}</h3>
                
                {item.tom_tat && (
                  <p className="summary">{item.tom_tat}</p>
                )}

                <div className="bookmark-footer">
                  <div className="bookmark-date">
                    <Calendar size={12} />
                    Lưu: {new Date(item.bookmarked_at).toLocaleDateString('vi-VN')}
                  </div>
                  {item.link_bai_viet && (
                    <a 
                      href={item.link_bai_viet} 
                      target="_blank" 
                      rel="noreferrer"
                      className="read-link"
                    >
                      Đọc bài <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                {item.note && (
                  <div className="bookmark-note">
                    💡 Ghi chú: {item.note}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {newsTotalPages > 1 && (
          <div className="pagination">
            <button 
              className="pagination-btn" 
              onClick={() => setNewsPage(p => Math.max(1, p - 1))}
              disabled={newsPage === 1}
            >
              <ChevronLeft size={18} /> Trước
            </button>
            <div className="pagination-numbers">
              {Array.from({ length: newsTotalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  className={`pagination-number ${page === newsPage ? 'active' : ''}`}
                  onClick={() => setNewsPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>
            <button 
              className="pagination-btn" 
              onClick={() => setNewsPage(p => Math.min(newsTotalPages, p + 1))}
              disabled={newsPage === newsTotalPages}
            >
              Sau <ChevronRight size={18} />
            </button>
          </div>
        )}
        </>
      )}

      {activeTab === 'business' && (
        <>
          <div className="bookmarks-grid">
            {businessBookmarks.length === 0 ? (
              <div className="empty-state">
                <Heart size={64} />
                <p>Chưa có doanh nghiệp yêu thích</p>
                <p className="hint">Nhấn vào icon ❤️ ở doanh nghiệp để lưu vào danh sách này</p>
            </div>
          ) : (
            paginatedBusinesses.map((item) => (
              <div key={item.id} className="bookmark-card business">
                <div className="bookmark-header">
                  <div className="bookmark-meta">
                    {item.nganh_nghe && (
                      <span className="badge category">{item.nganh_nghe}</span>
                    )}
                    {item.vung_mien && (
                      <span className={`badge region-${item.vung_mien}`}>
                        {item.vung_mien}
                      </span>
                    )}
                  </div>
                  <button
                    className="remove-btn"
                    onClick={() => handleRemoveBusiness(item.id)}
                    title="Xóa khỏi yêu thích"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <h3>{item.ten_doanh_nghiep}</h3>
                
                {item.mo_ta && (
                  <p className="summary">{item.mo_ta}</p>
                )}

                <div className="business-info">
                  {item.dia_chi && (
                    <div className="info-row">
                      <MapPin size={12} />
                      <span>{item.dia_chi}</span>
                    </div>
                  )}
                  {item.dien_thoai && (
                    <div className="info-row">
                      <Phone size={12} />
                      <span>{item.dien_thoai}</span>
                    </div>
                  )}
                  {item.website && (
                    <div className="info-row">
                      <Globe size={12} />
                      <a href={item.website} target="_blank" rel="noreferrer">
                        {item.website}
                      </a>
                    </div>
                  )}
                </div>

                <div className="bookmark-footer">
                  <div className="bookmark-date">
                    <Calendar size={12} />
                    Lưu: {new Date(item.bookmarked_at).toLocaleDateString('vi-VN')}
                  </div>
                  {item.do_tin_cay && (
                    <div className="trust-score">
                      ⭐ {item.do_tin_cay}/10
                    </div>
                  )}
                </div>

                {item.note && (
                  <div className="bookmark-note">
                    💡 Ghi chú: {item.note}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {businessTotalPages > 1 && (
          <div className="pagination">
            <button 
              className="pagination-btn" 
              onClick={() => setBusinessPage(p => Math.max(1, p - 1))}
              disabled={businessPage === 1}
            >
              <ChevronLeft size={18} /> Trước
            </button>
            <div className="pagination-numbers">
              {Array.from({ length: businessTotalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  className={`pagination-number ${page === businessPage ? 'active' : ''}`}
                  onClick={() => setBusinessPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>
            <button 
              className="pagination-btn" 
              onClick={() => setBusinessPage(p => Math.min(businessTotalPages, p + 1))}
              disabled={businessPage === businessTotalPages}
            >
              Sau <ChevronRight size={18} />
            </button>
          </div>
        )}
        </>
      )}

      {selectedNews && (
        <div className="modal-overlay" onClick={closeNewsDetail}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeNewsDetail}>×</button>
            
            <div className="modal-header">
              <span className="badge category">{selectedNews.chuyen_muc}</span>
              {selectedNews.vung_mien && (
                <span className={`badge region-${selectedNews.vung_mien}`}>
                  {selectedNews.vung_mien}
                </span>
              )}
            </div>

            <h2 className="modal-title">{selectedNews.tieu_de}</h2>

            {selectedNews.tom_tat && (
              <p className="modal-summary">{selectedNews.tom_tat}</p>
            )}

            {selectedNews.noi_dung && (
              <div className="modal-detail">
                <h4>Nội dung chi tiết</h4>
                <p>{selectedNews.noi_dung}</p>
              </div>
            )}

            {selectedNews.link_bai_viet && (
              <a 
                href={selectedNews.link_bai_viet} 
                target="_blank" 
                rel="noreferrer"
                className="neon-search-btn"
                style={{ marginTop: '20px', display: 'inline-flex' }}
              >
                Đọc bài gốc <ExternalLink size={16} style={{ marginLeft: '8px' }} />
              </a>
            )}
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
          message={`Bạn có chắc chắn muốn xóa ${confirmDelete.type === 'news' ? 'tin tức' : 'doanh nghiệp'} này khỏi danh sách yêu thích?`}
          confirmText="Xóa"
          cancelText="Hủy"
          type="warning"
          onConfirm={confirmRemove}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      </div>
    </div>
  );
};

export default FavoritesView;
