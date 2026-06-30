import { RefreshCw, ChevronLeft, ChevronRight, Search, Heart } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import LoadingSpinner from './LoadingSpinner';
import Toast from './Toast';

function NewsStorageView({ allNews, isFetchNewsLoading, fetchAllNews, newsSearchQuery, setNewsSearchQuery, onNewsClick }) {
  const [selectedNews, setSelectedNews] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [toast, setToast] = useState(null);
  const [bookmarkedNews, setBookmarkedNews] = useState(new Set());
  const itemsPerPage = 8;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const loadBookmarks = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      try {
        const response = await fetch('http://127.0.0.1:8000/api/bookmarks/news', {
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
    
    const token = localStorage.getItem('access_token');
    console.log('🔑 Token:', token ? 'Found' : 'Not found');
    
    if (!token) {
      showToast('Vui lòng đăng nhập để sử dụng tính năng yêu thích', 'error');
      return;
    }

    try {
      console.log('📍 Bookmark status:', bookmarkedNews.has(newsId) ? 'Already bookmarked' : 'Not bookmarked');
      
      if (bookmarkedNews.has(newsId)) {
        console.log('🗑️ Removing bookmark...');
        const response = await fetch(`http://127.0.0.1:8000/api/bookmarks/news/${newsId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('📡 Delete response:', response.status);
        
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
        const response = await fetch('http://127.0.0.1:8000/api/bookmarks/news', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ news_id: newsId })
        });

        console.log('📡 Add response:', response.status);

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
    
    const uniqueCategories = Array.from(categoryMap.values()).sort();
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

    const newsGrid = document.querySelector('.news-grid');
    if (newsGrid) {
      newsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        <div className="section-header">
          <div className="header-title-block">
            <h3 className="news-view-title">Xem tin tức cùng Em Tư </h3>
            <p className="sub-header-text">Cập nhật những tin tức hot nhất hiện tại!</p>
          </div>
          <div className="header-actions">
            <div className="news-count">
              <span className="count-number">{filteredNews.length}</span>
              <span className="count-label">tin tức</span>
            </div>
            <button onClick={fetchAllNews} className="refresh-btn" title={`Làm mới kho (${allNews.length})`}>
              <RefreshCw size={18} />
            </button>
          </div>
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
          <LoadingSpinner message="Em Tư đang lùng sục tin tức khắp nơi cho bạn..." />
        ) : filteredNews.length === 0 ? (
          <div className="empty-state">
            <p>
              {searchQuery || selectedCategory !== 'all' 
                ? `em Tư Không tìm thấy tin tức phù hợp với "${searchQuery || selectedCategory}"`
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
                  Trước
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
                  Sau
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
