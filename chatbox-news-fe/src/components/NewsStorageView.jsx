import { RefreshCw, ChevronLeft, ChevronRight, Search, Heart } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Spinner from './atoms/Spinner';
import Toast from './Toast';

function NewsStorageView({ allNews, isFetchNewsLoading, fetchAllNews, newsSearchQuery, setNewsSearchQuery, onNewsClick }) {
  const [selectedNews, setSelectedNews] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [toast, setToast] = useState(null);
  const [bookmarkedNews, setBookmarkedNews] = useState(new Set());
  
  // Detect mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const itemsPerPage = isMobile ? 4 : 8;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const loadBookmarks = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await fetch('/api/bookmarks/news', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const bookmarks = await response.json();
          console.log('📦 Loaded news bookmarks:', bookmarks);
          // Backend returns full news objects with 'id' field
          const bookmarkedIds = new Set(bookmarks.map(b => b.id));
          console.log('📌 Bookmarked news IDs:', Array.from(bookmarkedIds));
          setBookmarkedNews(bookmarkedIds);
        }
      } catch (error) {
        console.error('Error loading bookmarks:', error);
      }
    };

    loadBookmarks();
  }, []);

  const handleBookmark = useCallback(async (newsId, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    console.log('🔥 Bookmark clicked for news:', newsId);
    
    const token = localStorage.getItem('token');
    console.log('🔑 Token:', token ? 'Found' : 'Not found');
    
    if (!token) {
      showToast('Vui lòng đăng nhập để sử dụng tính năng yêu thích', 'error');
      return;
    }

    try {
      console.log('📍 Bookmark status:', bookmarkedNews.has(newsId) ? 'Already bookmarked' : 'Not bookmarked');
      
      if (bookmarkedNews.has(newsId)) {
        console.log('🗑️ Removing bookmark...');
        const response = await fetch(`/api/bookmarks/news/${newsId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('📡 Delete response:', response.status);
        
        if (response.status === 401) {
          // Token expired or invalid - redirect to login
          showToast('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại', 'error');
          localStorage.removeItem('token');
          setTimeout(() => window.location.reload(), 1500);
          return;
        }
        
        if (response.ok) {
          setBookmarkedNews(prev => {
            const newSet = new Set(prev);
            newSet.delete(newsId);
            return newSet;
          });
          showToast('Đã xóa khỏi yêu thích', 'success');
        } else {
          const error = await response.json();
          console.error('❌ Delete error:', error);
          showToast(error.detail || 'Lỗi khi xóa', 'error');
        }
      } else {
        console.log('➕ Adding bookmark...');
        const response = await fetch('/api/bookmarks/news', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ news_id: newsId })
        });

        console.log('📡 Add response:', response.status);

        if (response.status === 401) {
          // Token expired or invalid - redirect to login
          showToast('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại', 'error');
          localStorage.removeItem('token');
          setTimeout(() => window.location.reload(), 1500);
          return;
        }

        if (response.ok) {
          setBookmarkedNews(prev => new Set([...prev, newsId]));
          showToast('Đã thêm vào yêu thích', 'success');
        } else {
          const error = await response.json();
          console.error('❌ Add error:', error);
          showToast(error.detail || 'Lỗi khi thêm', 'error');
        }
      }
    } catch (error) {
      console.error('💥 Bookmark error:', error);
      showToast('Lỗi khi lưu yêu thích', 'error');
    }
  }, [bookmarkedNews]);
 
  useEffect(() => {
    if (newsSearchQuery) {
      setSearchQuery(newsSearchQuery);
      setCurrentPage(1);

      if (setNewsSearchQuery) {
        setTimeout(() => setNewsSearchQuery(''), 100);
      }
    }
  }, [newsSearchQuery, setNewsSearchQuery]);
 
  const normalizeCategory = useCallback((text) => {
    if (!text) return '';
    return text
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }, []);
 
  const filteredNews = useMemo(() => {
    return allNews.filter((news) => {
      const matchSearch = searchQuery === '' || 
        news.tieu_de.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (news.tom_tat && news.tom_tat.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCategory = selectedCategory === 'all' || 
        (news.chuyen_muc && news.chuyen_muc.trim().toLowerCase() === selectedCategory.toLowerCase());
      
      return matchSearch && matchCategory;
    });
  }, [allNews, searchQuery, selectedCategory]);
 
  const categories = useMemo(() => {
    // Define common Vietnamese news categories
    const commonCategories = [
      'Kinh Tế',
      'Thời Sự', 
      'Quốc Tế',
      'Thể Thao',
      'Xã Hội',
      'Công Nghệ',
      'Giải Trí',
      'Pháp Luật',
      'Giáo Dục',
      'Sức Khỏe',
      'Văn Hóa',
      'Du Lịch',
      'Khoa Học',
      'Đời Sống'
    ];

    // Get actual categories from data
    const categoryMap = new Map();
    allNews.forEach(news => {
      if (news.chuyen_muc) {
        const normalized = normalizeCategory(news.chuyen_muc);
        const lowerKey = normalized.toLowerCase(); 
        if (!categoryMap.has(lowerKey)) {
          categoryMap.set(lowerKey, normalized);
        }
      }
    });
    
    const actualCategories = Array.from(categoryMap.values());
    
    // Merge: show common categories first, then any additional unique ones from data
    const mergedSet = new Set([...commonCategories]);
    actualCategories.forEach(cat => mergedSet.add(cat));
    
    const uniqueCategories = Array.from(mergedSet).sort();
    return ['all', ...uniqueCategories];
  }, [allNews, normalizeCategory]);
 
  const totalPages = useMemo(() => Math.ceil(filteredNews.length / itemsPerPage), [filteredNews.length]);
  const currentNews = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredNews.slice(startIndex, endIndex);
  }, [filteredNews, currentPage]);
 
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);
 
  useEffect(() => {
    setCurrentPage(1);
  }, [allNews.length]);

  const openModal = (news) => {
    setSelectedNews(news); 
    if (onNewsClick) {
      onNewsClick();
    } 
    setTimeout(() => {
      const modalContent = document.querySelector('.modal-content');
      if (modalContent) {
        modalContent.scrollTop = 0;
      }
    }, 0);
  };

  const closeModal = () => {
    setSelectedNews(null);
  };
 
  useEffect(() => {
    if (selectedNews) {
      const scrollContainer = document.querySelector('.main-content-area');
      if (scrollContainer) {
        scrollContainer.style.overflow = 'hidden';
      }
    } else {
      const scrollContainer = document.querySelector('.main-content-area');
      if (scrollContainer) {
        scrollContainer.style.overflow = 'auto';
      }
    }
  }, [selectedNews]);

  const goToPage = (page) => {
    setCurrentPage(page);

    // Scroll to top of main content area
    const mainContent = document.querySelector('.main-content-area');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  return (
    <>
      <div className="main-content-area fade-in-effect">
        <div className="section-header" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid var(--border-neon)',
          paddingBottom: '12px',
          marginBottom: '12px',
          gap: '12px'
        }}>
          <div style={{ flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h3 style={{ 
              margin: '0', 
              fontSize: '16px', 
              fontWeight: '700',
              color: 'var(--text-main)',
              lineHeight: '1.2'
            }}>
              Xem tin tức cùng Company
            </h3>
            <p style={{ 
              margin: '0', 
              fontSize: '12px', 
              color: 'var(--text-dim)',
              lineHeight: '1.3'
            }}>
              Cập nhật những tin tức hot nhất hiện tại!
            </p>
          </div>
          <button 
            onClick={fetchAllNews} 
            className="refresh-btn" 
            title={`Làm mới kho (${allNews.length})`}
            style={{
              flexShrink: '0',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <RefreshCw size={18} />
          </button>
        </div> 

        <div className="news-filters">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Tìm kiếm tin tức tại đây..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>✕</button>
            )}
            <button className="search-submit-btn">Tìm kiếm</button>
          </div>

          <div className="category-filters">
            <button
              className={`category-filter-btn ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              Tất cả
            </button>
            {categories.slice(1).map((category) => (
              <button
                key={category}
                className={`category-filter-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {isFetchNewsLoading ? (
          <div className="loading-state">
            <Spinner />
            <p className="loading-state-text">Company đang lùng sục tin tức khắp nơi cho bạn...</p>
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="empty-state">
            <p>
              {searchQuery || selectedCategory !== 'all' 
                ? `Company Không tìm thấy tin tức phù hợp với "${searchQuery || selectedCategory}"`
                : 'Kho tin tức trống'}
            </p>
          </div>
        ) : (
          <>
            <div className="news-grid">
              {currentNews.map((news) => (
                <div key={news.id} className="database-news-card"
                  onClick={() => openModal(news)}
                >
                  <button
                    className={`bookmark-heart-btn ${bookmarkedNews.has(news.id) ? 'bookmarked' : ''}`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleBookmark(news.id, e);
                    }}
                    title={bookmarkedNews.has(news.id) ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}
                  >
                    <Heart size={18} fill={bookmarkedNews.has(news.id) ? 'currentColor' : 'none'} />
                  </button>

                  {news.chuyen_muc && news.chuyen_muc !== 'Tin mới' && (
                    <div className="card-meta">
                      <span className="badge category">{normalizeCategory(news.chuyen_muc)}</span>
                    </div>
                  )}
                  <h3>{news.tieu_de}</h3>
                  <p>{news.tom_tat}</p>
                  <div className="card-footer">
                    <span className="read-more">Đọc thêm →</span>
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
      
      {selectedNews && createPortal(
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>✕</button>
            {selectedNews.chuyen_muc && selectedNews.chuyen_muc !== 'Tin mới' && (
              <div className="modal-header">
                <span className="badge category">{normalizeCategory(selectedNews.chuyen_muc)}</span>
              </div>
            )}
            <h2 className="modal-title">{selectedNews.tieu_de}</h2>
            <div className="modal-body">
              <p className="modal-summary">{selectedNews.tom_tat}</p>
              
              {/* Link to original article */}
              {selectedNews.url && (
                <div className="modal-original-link">
                  <a 
                    href={selectedNews.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="original-article-link"
                  >
                    📰 Đọc bài viết gốc
                  </a>
                </div>
              )}
              
              {/* Mobile bookmark button - rectangular with text */}
              <button
                className={`modal-bookmark-btn-mobile ${bookmarkedNews.has(selectedNews.id) ? 'bookmarked' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleBookmark(selectedNews.id, e);
                }}
              >
                <Heart size={18} fill={bookmarkedNews.has(selectedNews.id) ? 'currentColor' : 'none'} />
                <span>{bookmarkedNews.has(selectedNews.id) ? 'Đã yêu thích' : 'Thêm vào yêu thích'}</span>
              </button>

              {selectedNews.nha_dai && (
                <div className="modal-detail">
                  <h4>Nội dung chi tiết:</h4>
                  <p>{selectedNews.nha_dai}</p>
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

export default NewsStorageView;
