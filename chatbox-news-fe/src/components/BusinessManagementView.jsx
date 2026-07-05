import { Search, Sparkles, BarChart3, X, RefreshCw, ChevronLeft, ChevronRight, Upload, Download, Heart } from 'lucide-react';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast';

const PAGE_SIZE = 10;

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
 
function BusinessCardSkeleton() {
  return (
    <div className="biz-card skeleton-card">
      <div className="skeleton-line" style={{ width: '60%', height: '14px', marginBottom: '8px' }} />
      <div className="skeleton-line" style={{ width: '90%', height: '20px', marginBottom: '12px' }} />
      <div className="skeleton-line" style={{ width: '50%', height: '13px', marginBottom: '6px' }} />
      <div className="skeleton-line" style={{ width: '70%', height: '13px', marginBottom: '6px' }} />
      <div className="skeleton-line" style={{ width: '80%', height: '40px' }} />
    </div>
  );
}

function BusinessManagementView({
  searchQuery,
  setSearchQuery,
  regionFilter,
  setRegionFilter,
  handleClearSearch,
  allBusinesses,
  isLoading,
  isEnriching,
  handleSimulateRawInput,
  onRefresh,
  currentUser
}) {
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isEnrichingAll, setIsEnrichingAll] = useState(false);
  const csvInputRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [bookmarkedBusinesses, setBookmarkedBusinesses] = useState(new Set());
  
  // Detect mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const pageSize = isMobile ? 6 : PAGE_SIZE;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const loadBookmarks = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        // Clear bookmarks when no token (logged out)
        setBookmarkedBusinesses(new Set());
        return;
      }

      try {
        const response = await fetch('/api/bookmarks/businesses', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const bookmarks = await response.json();
          console.log('📦 Loaded business bookmarks:', bookmarks);
          // Backend returns full business objects with 'id' field
          const bookmarkedIds = new Set(bookmarks.map(b => b.id));
          console.log('📌 Bookmarked IDs:', Array.from(bookmarkedIds));
          setBookmarkedBusinesses(bookmarkedIds);
        } else {
          // Clear bookmarks on error (e.g., 401 unauthorized)
          setBookmarkedBusinesses(new Set());
        }
      } catch (error) {
        console.error('Error loading bookmarks:', error);
        setBookmarkedBusinesses(new Set());
      }
    };

    loadBookmarks();
  }, [currentUser]); // Re-run when currentUser changes

  const handleBookmark = useCallback(async (businessId, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Vui lòng đăng nhập để sử dụng tính năng yêu thích', 'error');
      return;
    }

    try {
      if (bookmarkedBusinesses.has(businessId)) {
        // Remove bookmark
        const response = await fetch(`/api/bookmarks/businesses/${businessId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
          // Token expired or invalid - redirect to login
          showToast('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại', 'error');
          localStorage.removeItem('token');
          setTimeout(() => window.location.reload(), 1500);
          return;
        }

        if (response.ok) {
          setBookmarkedBusinesses(prev => {
            const newSet = new Set(prev);
            newSet.delete(businessId);
            return newSet;
          });
          showToast('Đã xóa khỏi yêu thích', 'success');
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Delete bookmark failed:', response.status, errorData);
          showToast(`Lỗi: ${errorData.detail || 'Không thể xóa'}`, 'error');
        }
      } else {
        // Add bookmark
        console.log('Adding bookmark for business:', businessId);
        const response = await fetch('/api/bookmarks/businesses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ business_id: businessId })
        });

        console.log('Bookmark response:', response.status);
        
        if (response.status === 401) {
          // Token expired or invalid - redirect to login
          showToast('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại', 'error');
          localStorage.removeItem('token');
          setTimeout(() => window.location.reload(), 1500);
          return;
        }

        if (response.ok) {
          setBookmarkedBusinesses(prev => new Set([...prev, businessId]));
          showToast('Đã thêm vào yêu thích', 'success');
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Add bookmark failed:', response.status, errorData);
          showToast(`Lỗi: ${errorData.detail || 'Không thể thêm'}`, 'error');
        }
      }
    } catch (error) {
      console.error('Bookmark error:', error);
      showToast(`Lỗi kết nối: ${error.message}`, 'error');
    }
  }, [bookmarkedBusinesses]);
 
  const normalizeText = (text) => {
    if (!text) return '';
    return text.toString().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
  };
 
  const businesses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const normalizedQ = normalizeText(q);
    
    return allBusinesses.filter(biz => {
      
      const matchRegion = regionFilter === 'all' || 
        normalizeText(biz.region).includes(normalizeText(regionFilter));

      const matchSearch = !q ||
        normalizeText(biz.name).includes(normalizedQ) ||
        normalizeText(biz.region).includes(normalizedQ) ||
        normalizeText(biz.location).includes(normalizedQ) ||
        normalizeText(biz.description).includes(normalizedQ) ||
        normalizeText(biz.scale).includes(normalizedQ) ||
        normalizeText(biz.industry).includes(normalizedQ);
      
      return matchRegion && matchSearch;
    });
  }, [searchQuery, regionFilter, allBusinesses]);

  const totalPages = Math.max(1, Math.ceil(businesses.length / pageSize));

  const pagedBusinesses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return businesses.slice(start, start + pageSize);
  }, [businesses, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, regionFilter, allBusinesses]);

  const goToPage = (page) => {
    setCurrentPage(page);
    
    // Scroll to top of main content area
    const mainContent = document.querySelector('.main-content-area');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
  };
  const goToPrevPage = () => { if (currentPage > 1) goToPage(currentPage - 1); };
  const goToNextPage = () => { if (currentPage < totalPages) goToPage(currentPage + 1); };

  const handleEnrichAll = async () => {
    setIsEnrichingAll(true);
    try {
      const res = await fetch('/api/ai/enrich-all', { method: 'POST' });
      const data = await res.json();
      if (data.enriched_count > 0) onRefresh();
    } catch (e) { console.error(e); }
    finally { setIsEnrichingAll(false); }
  };

  const handleExportCSV = () => {
    const q = regionFilter !== 'all' ? `?region=${regionFilter}` : '';
    window.open(`/api/businesses/export/csv${q}`, '_blank');
  };

  const handleDeleteBusiness = async (businessId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Vui lòng đăng nhập để xóa doanh nghiệp', 'error');
      return;
    }

    if (!window.confirm('Bạn có chắc chắn muốn xóa doanh nghiệp này không?')) {
      return;
    }

    try {
      const response = await fetch(`/api/businesses/${businessId}`, {
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
      closeModal();
      setCurrentPage(1);
      onRefresh();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showToast('⚠️ Vui lòng chọn file có định dạng .csv', 'error');
      e.target.value = '';
      return;
    } 

    const token = localStorage.getItem('token');
    if (!token) {
      showToast('⚠️ Vui lòng đăng nhập để thêm doanh nghiệp', 'error');
      e.target.value = '';
      return;
    }

    try {
      // Use secure endpoint with FormData (no need to parse CSV on frontend)
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://127.0.0.1:8000/api/secure/import-csv', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`
          // No Content-Type header - FormData sets it automatically
        },
        body: formData
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Import thất bại');
      }

      const data = await res.json();
      
      // Better messaging
      let message = '';
      let messageType = 'success';
      
      if (data.inserted > 0 && data.skipped === 0) {
        // All success
        message = `✅ Thêm thành công ${data.inserted} doanh nghiệp mới! 🔒 Dữ liệu nhạy cảm đã được mã hóa.`;
      } else if (data.inserted > 0 && data.skipped > 0) {
        // Partial success
        message = `⚠️ Thêm được ${data.inserted} doanh nghiệp mới. Bỏ qua ${data.skipped} doanh nghiệp vì đã tồn tại (trùng tên/SĐT/email).`;
        messageType = 'warning';
      } else if (data.inserted === 0 && data.skipped > 0) {
        // All duplicates
        message = `⚠️ Không thể thêm! ${data.skipped} doanh nghiệp đã tồn tại`;
        messageType = 'error';
      } else {
        // No valid data
        message = `⚠️ Không có dữ liệu hợp lệ để thêm.`;
        messageType = 'error';
      }
      
      showToast(message, messageType);
      setCurrentPage(1);
      onRefresh();

    } catch (err) {
      showToast('❌ Lỗi import: ' + err.message, 'error');
    } finally {
      e.target.value = '';
    }
  };

  const openModal = (business) => {
    setSelectedBusiness(business);
    const scrollContainer = document.querySelector('.main-content-area');
    if (scrollContainer) {
      scrollContainer.style.overflow = 'hidden';
    }
  };
  
  const closeModal = () => {
    setSelectedBusiness(null);
    const scrollContainer = document.querySelector('.main-content-area');
    if (scrollContainer) {
      scrollContainer.style.overflow = '';
    }
  };

  const formatRegionDisplay = (region) => {
    if (!region) return '';
    const r = region.toLowerCase();
    if (r.includes('bac') || r.includes('bắc')) return 'Bắc';
    if (r.includes('nam')) return 'Nam';
    if (r.includes('trung')) return 'Trung';
    if (r.includes('toan')) return 'Toàn quốc';
    return region;
  };

  const regionColor = (region) => {
    if (!region) return '';
    const r = region.toLowerCase();
    // Kiểm tra cả có dấu và không dấu
    if (r.includes('bắc') || r.includes('bac')) return 'region-Bắc';
    if (r.includes('nam')) return 'region-Nam';
    if (r.includes('trung')) return 'region-Trung';
    return 'region-default';
  };

  const formatPhone = (phone) => {
    if (!phone) return '';
    
    const cleaned = phone.toString().trim().replace(/[^\d+]/g, '');
    return cleaned;
  };

  const formatWebsite = (site) => {
    if (!site) return '';
    const s = site.toString().trim();
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
  };

  return (
    <>
      <div className="main-content-area fade-in-effect">
        <div style={{ 
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '2px solid var(--border-neon)',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: isMobile ? '12px' : '20px'
        }}>
          <div>
            <h3 style={{ 
              margin: '0 0 6px 0', 
              fontSize: '18px', 
              fontWeight: '700',
              color: 'var(--text-main)',
              lineHeight: '1.2'
            }}>
              Tìm việc làm cùng Em Tư
            </h3>
            <p style={{ 
              margin: '0', 
              fontSize: '13px', 
              color: 'var(--text-dim)',
              lineHeight: '1.4'
            }}>
              Khám phá các cơ hội nghề nghiệp phù hợp!
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flexShrink: 0 }}>
            <button 
              onClick={onRefresh} 
              className="refresh-btn" 
              title="Làm mới"
              style={{
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <RefreshCw size={18} />
            </button>
            {currentUser && (
              <>
                <button 
                  title="Nhập CSV" 
                  onClick={() => csvInputRef.current?.click()} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    height: '42px',
                    background: '#F8FAFC',
                    border: '2px solid var(--border-neon)',
                    borderRadius: '10px',
                    color: 'var(--color-secondary)',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #D71E28, #B91C1C)';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(185, 28, 28, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#F8FAFC';
                    e.currentTarget.style.color = 'var(--color-secondary)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <Download size={18} />
                  <span>Nhập</span>
                </button>
                <button 
                  title="Xuất CSV" 
                  onClick={handleExportCSV} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    height: '42px',
                    background: '#F8FAFC',
                    border: '2px solid var(--border-neon)',
                    borderRadius: '10px',
                    color: 'var(--color-secondary)',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #D71E28, #B91C1C)';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(185, 28, 28, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#F8FAFC';
                    e.currentTarget.style.color = 'var(--color-secondary)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <Upload size={18} />
                  <span>Xuất</span>
                </button>
                <input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
              </>
            )}
          </div>
        </div>

        <div className="news-filters">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên, ngành nghề, địa chỉ, mô tả..."
              className="search-input"
            />
            {searchQuery && (
              <button className="clear-search" onClick={handleClearSearch}>✕</button>
            )}
            <button className="search-submit-btn" onClick={(e) => e.preventDefault()}>
              Tìm kiếm
            </button>
          </div>
 
          <div className="category-filters">
            {['all', 'Bac', 'Trung', 'Nam'].map(r => (
              <button
                key={r}
                className={`category-filter-btn ${regionFilter === r ? 'active' : ''}`}
                onClick={() => setRegionFilter(r)}
              >
                {r === 'all' ? 'Tất cả' : r === 'Bac' ? '🏙️ Miền Bắc' : r === 'Trung' ? '🌊 Miền Trung' : '🌴 Miền Nam'}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Em Tư đang tìm kiếm doanh nghiệp cho bạn...</p>
          </div>
        ) : businesses.length === 0 ? (
          <div className="empty-state">
            <p>{searchQuery ? `Không tìm thấy doanh nghiệp nào khớp với "${searchQuery}"` : 'Em Tư không tìm thấy doanh nghiêp nào cả'}</p>
          </div>
        ) : (
          <>
            <div className="biz-card-grid">
              {pagedBusinesses.map((biz) => (
                <div key={biz.id} className="biz-card" onClick={() => openModal(biz)}>
                  <button
                    className={`bookmark-heart-btn ${bookmarkedBusinesses.has(biz.id) ? 'bookmarked' : ''}`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleBookmark(biz.id, e);
                    }}
                    title={bookmarkedBusinesses.has(biz.id) ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}
                  >
                    <Heart size={18} fill={bookmarkedBusinesses.has(biz.id) ? 'currentColor' : 'none'} />
                  </button>

                  <div className="biz-card-icon">
                    {getBizIcon(biz.name, biz.description)}
                  </div>
 
                  <div className="biz-card-body">
                    <h4 className="biz-card-name">{biz.name}</h4>
                    <p className="biz-card-location">
                      📍 {biz.location || 'Việt Nam'}
                      {biz.phone && <span> · 📞 {biz.phone}</span>}
                    </p>
                    <div className="biz-card-tags">
                      {biz.region && (
                        <span className={`biz-tag ${regionColor(biz.region)}`}>{formatRegionDisplay(biz.region)}</span>
                      )}
                      {(biz.industry || biz.scale) && (
                        <span className="biz-tag biz-tag-scale">{biz.industry || biz.scale}</span>
                      )}
                      {biz.trust_score >= 80 && (
                        <span className="biz-tag biz-tag-trusted">✓ Tin cậy</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button 
                  className="pagination-btn" 
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={18} />
                  <span>Trước</span>
                </button>

                <div className="pagination-numbers">
                  {(() => {
                    const pages = [];
                    const showEllipsisStart = currentPage > 3;
                    const showEllipsisEnd = currentPage < totalPages - 2;

                    pages.push(
                      <button
                        key={1}
                        className={`pagination-number ${1 === currentPage ? 'active' : ''}`}
                        onClick={() => goToPage(1)}
                      >
                        1
                      </button>
                    );

                    if (showEllipsisStart) {
                      pages.push(<span key="ellipsis-start" className="pagination-ellipsis">...</span>);
                    }

                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(totalPages - 1, currentPage + 1);
                    
                    for (let i = start; i <= end; i++) {
                      pages.push(
                        <button
                          key={i}
                          className={`pagination-number ${i === currentPage ? 'active' : ''}`}
                          onClick={() => goToPage(i)}
                        >
                          {i}
                        </button>
                      );
                    }

                    if (showEllipsisEnd) {
                      pages.push(<span key="ellipsis-end" className="pagination-ellipsis">...</span>);
                    }

                    if (totalPages > 1) {
                      pages.push(
                        <button
                          key={totalPages}
                          className={`pagination-number ${totalPages === currentPage ? 'active' : ''}`}
                          onClick={() => goToPage(totalPages)}
                        >
                          {totalPages}
                        </button>
                      );
                    }
                    
                    return pages;
                  })()}
                </div>

                <button 
                  className="pagination-btn" 
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  <span>Sau</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedBusiness && createPortal(
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content biz-modal-wide" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}><X size={20} /></button>
 
            <div className="modal-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {selectedBusiness.region && (
                <span className={`biz-tag ${regionColor(selectedBusiness.region)}`}>{formatRegionDisplay(selectedBusiness.region)}</span>
              )}
              {selectedBusiness.industry && (
                <span className="biz-tag biz-tag-scale">{selectedBusiness.industry}</span>
              )}
              {selectedBusiness.trust_score != null && (
                <span className={`biz-tag ${selectedBusiness.trust_score >= 80 ? 'biz-tag-trusted' : 'biz-tag-muted'}`}>
                  ⭐ Độ tin cậy: {selectedBusiness.trust_score}%
                </span>
              )}
              {selectedBusiness.status && selectedBusiness.status !== 'Hoat_dong' && (
                <span className="biz-tag" style={{ background: 'rgba(237,137,54,0.2)', color: '#c05621' }}>
                  ⚠️ {selectedBusiness.status}
                </span>
              )}
            </div>

            <h2 className="modal-title">{getBizIcon(selectedBusiness.name, selectedBusiness.description)} {selectedBusiness.name}</h2>

            <div className="modal-body">
              <div className="business-info-grid">
 
                {(selectedBusiness.address || selectedBusiness.location) && (
                  <div className="business-info-item">
                    <strong>📍 Địa chỉ:</strong>
                    <span>{selectedBusiness.address || selectedBusiness.location}</span>
                  </div>
                )}
                {selectedBusiness.location && selectedBusiness.address && (
                  <div className="business-info-item">
                    <strong>🏙️ Tỉnh/Thành:</strong>
                    <span>{selectedBusiness.location}</span>
                  </div>
                )}
                {selectedBusiness.phone && (
                  <div className="business-info-item">
                    <strong>📞 Điện thoại:</strong>
                    <a href={`tel:${formatPhone(selectedBusiness.phone)}`} style={{ color: 'var(--color-primary)' }}>
                      {selectedBusiness.phone}
                    </a>
                  </div>
                )}
                {selectedBusiness.email && (
                  <div className="business-info-item">
                    <strong>📧 Email:</strong>
                    <a href={`mailto:${selectedBusiness.email}`} style={{ color: 'var(--color-primary)' }}>
                      {selectedBusiness.email}
                    </a>
                  </div>
                )}
                {selectedBusiness.scale && (
                  <div className="business-info-item">
                    <strong>👥 Quy mô:</strong>
                    <span>{selectedBusiness.scale}</span>
                  </div>
                )}
 
                {(selectedBusiness.facebook || selectedBusiness.zalo || selectedBusiness.linkedin) && (
                  <div className="business-info-item" style={{ gridColumn: '1 / -1' }}>
                    <strong>🔗 Mạng xã hội:</strong>
                    <span style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {selectedBusiness.facebook && (
                        <a href={selectedBusiness.facebook} target="_blank" rel="noreferrer"
                           style={{ color: '#1877f2', fontWeight: 600 }}>Facebook</a>
                      )}
                      {selectedBusiness.zalo && (
                        <a href={`https://zalo.me/${selectedBusiness.zalo}`} target="_blank" rel="noreferrer"
                           style={{ color: '#0068ff', fontWeight: 600 }}>Zalo</a>
                      )}
                      {selectedBusiness.linkedin && (
                        <a href={selectedBusiness.linkedin} target="_blank" rel="noreferrer"
                           style={{ color: '#0a66c2', fontWeight: 600 }}>LinkedIn</a>
                      )}
                    </span>
                  </div>
                )}
                {selectedBusiness.tags && (
                  <div className="business-info-item" style={{ gridColumn: '1 / -1' }}>
                    <strong>🏷️ Tags:</strong>
                    <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {selectedBusiness.tags.split(',').map((t, i) => (
                        <span key={i} className="biz-tag biz-tag-muted">{t.trim()}</span>
                      ))}
                    </span>
                  </div>
                )}
              </div>

              {/* Mobile bookmark button - rectangular with text */}
              <button
                className={`modal-bookmark-btn-mobile ${bookmarkedBusinesses.has(selectedBusiness.id) ? 'bookmarked' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleBookmark(selectedBusiness.id, e);
                }}
              >
                <Heart size={18} fill={bookmarkedBusinesses.has(selectedBusiness.id) ? 'currentColor' : 'none'} />
                <span>{bookmarkedBusinesses.has(selectedBusiness.id) ? 'Đã yêu thích' : 'Thêm vào yêu thích'}</span>
              </button>

              {selectedBusiness.description && (
                <div className="modal-detail">
                  <h4>📋 Mô tả doanh nghiệp</h4>
                  <p>{selectedBusiness.description}</p>
                </div>
              )}

              {/* Delete button for business owner */}
              {currentUser && selectedBusiness.created_by_user_id === currentUser.id && (
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    onClick={() => handleDeleteBusiness(selectedBusiness.id)}
                    className="btn-cancel"
                    style={{ 
                      background: '#ef4444', 
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                  >
                    🗑️ Xóa doanh nghiệp
                  </button>
                  <p style={{ 
                    fontSize: '12px', 
                    color: 'var(--text-dim)', 
                    marginTop: '8px' 
                  }}>
                    Bạn là người tạo doanh nghiệp này nên có thể xóa
                  </p>
                </div>
              )}
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
    </>
  );
}
export default BusinessManagementView;
