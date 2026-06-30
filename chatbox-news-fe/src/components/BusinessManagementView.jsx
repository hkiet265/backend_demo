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

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const loadBookmarks = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      try {
        const response = await fetch('http://127.0.0.1:8000/api/bookmarks/businesses', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const bookmarks = await response.json();
          console.log('📦 Loaded business bookmarks:', bookmarks);
          // Backend returns full business objects with 'id' field
          const bookmarkedIds = new Set(bookmarks.map(b => b.id));
          console.log('📌 Bookmarked IDs:', Array.from(bookmarkedIds));
          setBookmarkedBusinesses(bookmarkedIds);
        }
      } catch (error) {
        console.error('Error loading bookmarks:', error);
      }
    };

    loadBookmarks();
  }, []);

  const handleBookmark = useCallback(async (businessId, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    const token = localStorage.getItem('access_token');
    if (!token) {
      showToast('Vui lòng đăng nhập để sử dụng tính năng yêu thích', 'error');
      return;
    }

    try {
      if (bookmarkedBusinesses.has(businessId)) {
        const response = await fetch(`http://127.0.0.1:8000/api/bookmarks/businesses/${businessId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          setBookmarkedBusinesses(prev => {
            const newSet = new Set(prev);
            newSet.delete(businessId);
            return newSet;
          });
          showToast('Đã xóa khỏi yêu thích', 'success');
        }
      } else {
        const response = await fetch('http://127.0.0.1:8000/api/bookmarks/businesses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ business_id: businessId })
        });

        if (response.ok) {
          setBookmarkedBusinesses(prev => new Set([...prev, businessId]));
          showToast('Đã thêm vào yêu thích', 'success');
        }
      }
    } catch (error) {
      console.error('Bookmark error:', error);
      showToast('Lỗi khi lưu yêu thích', 'error');
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

  const totalPages = Math.max(1, Math.ceil(businesses.length / PAGE_SIZE));

  const pagedBusinesses = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return businesses.slice(start, start + PAGE_SIZE);
  }, [businesses, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, regionFilter, allBusinesses]);

  const goToPage = (page) => {
    setCurrentPage(page);
    document.querySelector('.biz-card-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const goToPrevPage = () => { if (currentPage > 1) goToPage(currentPage - 1); };
  const goToNextPage = () => { if (currentPage < totalPages) goToPage(currentPage + 1); };

  const handleEnrichAll = async () => {
    setIsEnrichingAll(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/ai/enrich-all', { method: 'POST' });
      const data = await res.json();
      if (data.enriched_count > 0) onRefresh();
    } catch (e) { console.error(e); }
    finally { setIsEnrichingAll(false); }
  };

  const handleExportCSV = () => {
    const q = regionFilter !== 'all' ? `?region=${regionFilter}` : '';
    window.open(`http://127.0.0.1:8000/api/businesses/export/csv${q}`, '_blank');
  };

  const handleDeleteBusiness = async (businessId) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      showToast('Vui lòng đăng nhập để xóa doanh nghiệp', 'error');
      return;
    }

    if (!window.confirm('Bạn có chắc chắn muốn xóa doanh nghiệp này không?')) {
      return;
    }

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

    try {
      const text = await file.text();
      const lines = text.trim().split('\n').filter(line => line.trim());

      // Validate minimum lines
      if (lines.length < 2) {
        showToast('⚠️ File CSV phải có ít nhất 2 dòng (dòng tiêu đề + dòng dữ liệu)', 'error');
        e.target.value = '';
        return;
      }

      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      // Validate required headers
      const requiredHeaders = ['ten_doanh_nghiep'];
      const hasRequiredHeaders = requiredHeaders.every(required => 
        headers.some(h => h === required || h === 'name')
      );

      if (!hasRequiredHeaders) {
        showToast(
          '⚠️ File CSV sai định dạng!\n\n' +
          'Dòng đầu tiên phải có tiêu đề với cột bắt buộc: "ten_doanh_nghiep"\n\n' +
          'Các cột tùy chọn: tinh_thanh, so_dien_thoai, email, website, nganh_nghe, quy_mo\n\n' +
          'Ví dụ:\n' +
          'ten_doanh_nghiep,tinh_thanh,email\n' +
          'Công ty ABC,Hà Nội,abc@gmail.com',
          'error'
        );
        e.target.value = '';
        return;
      }

      // Parse records
      const records = lines.slice(1).map((line, index) => {
        const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || null; });
        return {
          ten_doanh_nghiep: obj.ten_doanh_nghiep || obj.name || '',
          nganh_nghe: obj.nganh_nghe || obj.industry || null,
          vung_mien: obj.vung_mien || obj.region || null,
          tinh_thanh: obj.tinh_thanh || obj.location || null,
          dia_chi: obj.dia_chi || obj.address || null,
          website: obj.website || null,
          email: obj.email || null,
          so_dien_thoai: obj.so_dien_thoai || obj.phone || null,
          quy_mo: obj.quy_mo || obj.scale || null,
          trang_thai: obj.trang_thai || 'Hoat_dong',
          tags: obj.tags || null,
          mo_ta: obj.mo_ta || obj.description || null,
        };
      }).filter(r => r.ten_doanh_nghiep);

      // Validate data records
      if (records.length === 0) { 
        showToast('⚠️ Không tìm thấy dữ liệu hợp lệ trong file CSV.\n\nĐảm bảo các dòng dữ liệu có giá trị trong cột "ten_doanh_nghiep"', 'error'); 
        e.target.value = '';
        return; 
      }

      // Send to backend
      const res = await fetch('http://127.0.0.1:8000/api/businesses/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Import thất bại');
      }

      const data = await res.json();
      showToast(`✅ Import thành công: ${data.inserted} doanh nghiệp mới, ${data.skipped} bỏ qua (trùng lặp)`, 'success');
      setCurrentPage(1);  // Reset về trang 1 để xem doanh nghiệp mới
      onRefresh();

    } catch (err) {
      showToast('❌ Lỗi import: ' + err.message, 'error');
    } finally {
      e.target.value = '';
    }
  };

  const openModal = (business) => {
    setSelectedBusiness(business);
    document.querySelector('.main-content-area')?.style.setProperty('overflow', 'hidden');
  };
  const closeModal = () => {
    setSelectedBusiness(null);
    document.querySelector('.main-content-area')?.style.setProperty('overflow', 'auto');
  };

  const regionColor = (region) => {
    if (!region) return '';
    const r = region.toLowerCase();
    if (r.includes('bắc')) return 'region-Bắc';
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
    <div className="main-content-area fade-in-effect">
  
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

 
      <div className="data-table-card" style={{ border: 'none', background: 'transparent', padding: '0', boxShadow: 'none' }}>
        <div className="table-header-action" style={{ marginBottom: '16px' }}>
          <div className="table-title">
            <BarChart3 size={20} className="text-emerald" />
            <h3>tìm việc làm cùng Em Tư</h3>
          </div>
          <div className="header-actions">
            <div className="news-count">
              <span className="count-number">
                {searchQuery || regionFilter !== 'all' ? `${businesses.length} / ${allBusinesses.length}` : businesses.length}
              </span>
              <span className="count-label">{searchQuery || regionFilter !== 'all' ? 'kết quả' : 'doanh nghiệp'}</span>
            </div>
            {currentUser && (
              <>
                <button className="action-btn" title="Nhập CSV" onClick={() => csvInputRef.current?.click()}>
                  <Upload size={18} />
                </button>
                <button className="action-btn" title="Xuất CSV" onClick={handleExportCSV}>
                  <Download size={18} />
                </button>
                <input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
              </>
            )}
            <button className="refresh-btn" onClick={onRefresh}>
              <RefreshCw size={18} />
            </button>
          </div>
          <button
            onClick={handleSimulateRawInput}
            className={`enrich-action-btn ${isEnriching ? 'running' : ''}`}
            disabled={isEnriching}
            style={{ display: 'none' }}
          >
            <Sparkles size={16} /> {isEnriching ? 'Đang cào...' : 'Cào dữ liệu'}
          </button>
        </div>

 
        {isLoading ? (
          <div className="biz-card-grid">
            {Array.from({ length: 12 }).map((_, i) => <BusinessCardSkeleton key={i} />)}
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
                        <span className={`biz-tag ${regionColor(biz.region)}`}>{biz.region}</span>
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
                <button className="pagination-btn" onClick={goToPrevPage} disabled={currentPage === 1}>
                  <ChevronLeft size={18} /> Trước
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
                <button className="pagination-btn" onClick={goToNextPage} disabled={currentPage === totalPages}>
                  Sau <ChevronRight size={18} />
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
                <span className={`biz-tag ${regionColor(selectedBusiness.region)}`}>{selectedBusiness.region}</span>
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
    </div>
  );
}

export default BusinessManagementView;
