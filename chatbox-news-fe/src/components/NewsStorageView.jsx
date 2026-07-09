import { RefreshCw, ChevronLeft, ChevronRight, Search, Heart, Filter, ChevronDown, Newspaper } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Spinner from './atoms/Spinner';
import Toast from './Toast';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

const HERO_SIZE = 4;

function trustPill(score) {
  if (score >= 80) return { label: 'Cao', bg: '#DCFCE7', color: '#16A34A' };
  if (score >= 50) return { label: 'Trung bình', bg: '#FEF3C7', color: '#D97706' };
  return { label: 'Thấp', bg: '#FEE2E2', color: '#DC2626' };
}

function NewsStorageView({ allNews, isFetchNewsLoading, fetchAllNews, newsSearchQuery, setNewsSearchQuery, openNewsId, onOpenNewsIdHandled, onNewsClick }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [relatedNews, setRelatedNews] = useState([]);
  const [showAllRelated, setShowAllRelated] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
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

  // Clicking a news card elsewhere in the app (e.g. the homepage's "Tin tức
  // nổi bật") should open the detail view directly instead of dumping the
  // user on a filtered search results list they then have to click again.
  // Clear any active filters so filteredNews matches allNews 1:1, keeping
  // the index lookup below valid.
  useEffect(() => {
    if (openNewsId == null) return;
    setSearchQuery('');
    setSelectedCategory('all');
    setSourceFilter('all');
    setShowAllRelated(false);
    const idx = allNews.findIndex(n => n.id === openNewsId);
    if (idx >= 0) setSelectedIndex(idx);
    if (onOpenNewsIdHandled) onOpenNewsIdHandled();
  }, [openNewsId, allNews, onOpenNewsIdHandled]);
 
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

      const matchSource = sourceFilter === 'all' || news.nha_dai === sourceFilter;

      return matchSearch && matchCategory && matchSource;
    });
  }, [allNews, searchQuery, selectedCategory, sourceFilter]);

  const sourceOptions = useMemo(
    () => [...new Set(allNews.map(n => n.nha_dai).filter(Boolean))].sort(),
    [allNews]
  );

  const selectedNews = selectedIndex !== null ? filteredNews[selectedIndex] : null;

  const goToPrevNews = () => {
    setShowAllRelated(false);
    setSelectedIndex(i => (i > 0 ? i - 1 : filteredNews.length - 1));
  };

  const goToNextNews = () => {
    setShowAllRelated(false);
    setSelectedIndex(i => (i < filteredNews.length - 1 ? i + 1 : 0));
  };

  // Real related-articles lookup (category + 7-day window + text similarity),
  // not fabricated — reuses the existing clustering endpoint.
  useEffect(() => {
    if (!selectedNews) { setRelatedNews([]); return; }
    const token = localStorage.getItem('token');
    if (!token) { setRelatedNews([]); return; }

    fetch(`/api/enrichment/find-similar-news/${selectedNews.id}?limit=6`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => setRelatedNews(data?.similar_news || []))
      .catch(() => setRelatedNews([]));
  }, [selectedNews?.id]);

  // Featured spotlight: admin-marked "featured" items lead the list, then
  // newest items fill any remaining slots (allNews is pre-sorted by date).
  // restNews uses the same ordering so no item is duplicated or skipped.
  const orderedNews = useMemo(() => {
    const featured = filteredNews.filter(n => n.featured);
    const rest = filteredNews.filter(n => !n.featured);
    return [...featured, ...rest];
  }, [filteredNews]);
  const heroItems = useMemo(() => orderedNews.slice(0, HERO_SIZE), [orderedNews]);
  const restNews = useMemo(() => orderedNews.slice(HERO_SIZE), [orderedNews]);

  useEffect(() => { setHeroIndex(0); }, [filteredNews]);

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
 
  const totalPages = useMemo(() => Math.max(1, Math.ceil(restNews.length / itemsPerPage)), [restNews.length]);
  const currentNews = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return restNews.slice(startIndex, endIndex);
  }, [restNews, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, sourceFilter]);
 
  useEffect(() => {
    setCurrentPage(1);
  }, [allNews.length]);

  const openModal = (news) => {
    const index = filteredNews.findIndex(n => n.id === news.id);
    setSelectedIndex(index >= 0 ? index : null);
    setShowAllRelated(false);
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
    setSelectedIndex(null);
    setRelatedNews([]);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div style={{ width: '4px', height: '30px', borderRadius: '4px', background: 'var(--color-primary)', flexShrink: 0 }} />
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-main)' }}>Tin tức</h2>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-dim)' }}>
              Cập nhật nhanh chóng những thông tin mới nhất từ nhiều nguồn uy tín
            </p>
          </div>
        </div>

        <div className="news-filters">
          <div className="search-box" style={{ flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: isMobile ? '1 1 100%' : 1, minWidth: 0 }}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Tìm kiếm tin tức, chủ đề, nguồn tin..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                style={{ width: '100%' }}
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '12px' }}>✕</button>
              )}
            </div>

            <div style={{ position: 'relative', flex: isMobile ? 1 : 'initial' }}>
              <button
                type="button"
                onClick={() => setShowSourceMenu(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0 16px', height: '48px', width: isMobile ? '100%' : 'auto',
                  borderRadius: 'var(--radius-md)', border: '2px solid var(--border-neon)', background: 'white',
                  fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', whiteSpace: 'nowrap', boxSizing: 'border-box'
                }}
              >
                <Filter size={16} /> {sourceFilter === 'all' ? 'Bộ lọc' : sourceFilter} <ChevronDown size={14} />
              </button>
              {showSourceMenu && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setShowSourceMenu(false)} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'white',
                    border: '2px solid var(--border-neon)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 20, minWidth: '180px', maxHeight: '260px', overflowY: 'auto'
                  }}>
                    <p style={{ margin: 0, padding: '8px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)' }}>NGUỒN TIN</p>
                    {['all', ...sourceOptions].map(src => (
                      <button
                        key={src}
                        onClick={() => { setSourceFilter(src); setShowSourceMenu(false); }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
                          background: sourceFilter === src ? '#FEF2F2' : 'white', border: 'none',
                          color: sourceFilter === src ? 'var(--color-primary)' : 'var(--text-main)',
                          fontSize: '13.5px', fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        {src === 'all' ? 'Tất cả nguồn' : src}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={fetchAllNews}
              title={`Làm mới kho (${allNews.length})`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0 16px', height: '48px', flex: isMobile ? 1 : 'initial',
                borderRadius: 'var(--radius-md)', border: '2px solid var(--border-neon)', background: 'white',
                fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', whiteSpace: 'nowrap', boxSizing: 'border-box'
              }}
            >
              <RefreshCw size={16} /> Làm mới
            </button>
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

        {!isFetchNewsLoading && currentPage === 1 && heroItems.length > 0 && (() => {
          const featured = heroItems[heroIndex] || heroItems[0];
          const asideItems = heroItems.filter((_, i) => i !== heroIndex).slice(0, 3);
          return (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '16px', marginBottom: '28px' }}>
              <div
                onClick={() => openModal(featured)}
                style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', cursor: 'pointer', minHeight: '320px', display: 'flex', alignItems: 'flex-end', background: '#F1F5F9' }}
              >
                {featured.anh_dai_dien ? (
                  <img src={featured.anh_dai_dien} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Newspaper size={40} style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--text-dim)', opacity: 0.4 }} />
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.05) 60%)' }} />
                <span style={{ position: 'absolute', top: '14px', left: '14px', background: 'var(--color-primary)', color: 'white', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px' }}>NỔI BẬT</span>
                {heroItems.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setHeroIndex(i => (i - 1 + heroItems.length) % heroItems.length); }}
                      style={{ position: 'absolute', left: '10px', top: isMobile ? '70px' : '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setHeroIndex(i => (i + 1) % heroItems.length); }}
                      style={{ position: 'absolute', right: '10px', top: isMobile ? '70px' : '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <ChevronRight size={18} />
                    </button>
                    <div style={{ position: 'absolute', bottom: '14px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
                      {heroItems.map((_, i) => (
                        <span key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: i === heroIndex ? 'var(--color-primary)' : 'rgba(255,255,255,0.7)' }} />
                      ))}
                    </div>
                  </>
                )}
                <div style={{ position: 'relative', padding: '20px', color: 'white', maxWidth: '85%' }}>
                  {featured.chuyen_muc && (
                    <span style={{ display: 'inline-block', marginBottom: '8px', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: 'rgba(255,255,255,0.9)', color: 'var(--color-primary)' }}>
                      {normalizeCategory(featured.chuyen_muc)}
                    </span>
                  )}
                  <h3 style={{ margin: '0 0 8px', fontSize: isMobile ? '17px' : '20px', fontWeight: 800, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{featured.tieu_de}</h3>
                  {!isMobile && featured.tom_tat && <p style={{ margin: '0 0 8px', fontSize: '13px', opacity: 0.9, lineHeight: 1.5 }}>{featured.tom_tat.slice(0, 140)}{featured.tom_tat.length > 140 ? '…' : ''}</p>}
                  <span style={{ fontSize: '12px', opacity: 0.85 }}>{featured.nha_dai} · {timeAgo(featured.created_at)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {asideItems.map(news => (
                  <div
                    key={news.id}
                    onClick={() => openModal(news)}
                    style={{ display: 'flex', gap: '10px', cursor: 'pointer', flex: 1 }}
                  >
                    <div style={{ position: 'relative', width: '96px', height: '72px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {news.anh_dai_dien ? (
                        <img src={news.anh_dai_dien} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Newspaper size={20} style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      {news.chuyen_muc && (
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-secondary)' }}>{normalizeCategory(news.chuyen_muc)}</span>
                      )}
                      <p style={{ margin: '2px 0', fontSize: '13px', fontWeight: 700, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {news.tieu_de}
                      </p>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{news.nha_dai} · {timeAgo(news.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

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
              {currentNews.map((news) => {
                const isRecent = news.created_at && (Date.now() - new Date(news.created_at).getTime()) < 24 * 60 * 60 * 1000;
                return (
                  <div key={news.id} className="database-news-card" style={{ padding: 0 }}
                    onClick={() => openModal(news)}
                  >
                    <div style={{ position: 'relative', height: '160px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {news.anh_dai_dien ? (
                        <img src={news.anh_dai_dien} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <Newspaper size={32} style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
                      )}
                      {isRecent && (
                        <span style={{ position: 'absolute', top: '10px', left: '10px', background: 'var(--color-primary)', color: 'white', fontSize: '10.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '6px' }}>
                          Mới
                        </span>
                      )}
                      <button
                        className={`bookmark-heart-btn ${bookmarkedNews.has(news.id) ? 'bookmarked' : ''}`}
                        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleBookmark(news.id, e); }}
                        title={bookmarkedNews.has(news.id) ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}
                        style={{ position: 'absolute', top: '8px', right: '8px' }}
                      >
                        <Heart size={18} fill={bookmarkedNews.has(news.id) ? 'currentColor' : 'none'} />
                      </button>
                    </div>

                    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                      {news.chuyen_muc && news.chuyen_muc !== 'Tin mới' && (
                        <div className="card-meta">
                          <span className="badge category">{normalizeCategory(news.chuyen_muc)}</span>
                        </div>
                      )}
                      <h3>{news.tieu_de}</h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{news.nha_dai} · {timeAgo(news.created_at)}</span>
                      <p>{news.tom_tat}</p>
                      <div className="card-footer">
                        <span className="read-more">Đọc thêm →</span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
          <div className="modal-content" style={{ maxWidth: '980px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>✕</button>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 2fr) minmax(0, 1fr)', gap: '28px', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                {selectedNews.chuyen_muc && selectedNews.chuyen_muc !== 'Tin mới' && (
                  <span className="badge category" style={{ marginBottom: '10px', display: 'inline-block' }}>{normalizeCategory(selectedNews.chuyen_muc)}</span>
                )}
                <h2 className="modal-title" style={{ marginTop: 0 }}>{selectedNews.tieu_de}</h2>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-dim)' }}>
                    <strong style={{ color: 'var(--text-main)' }}>{selectedNews.nha_dai}</strong>
                    <span>· {timeAgo(selectedNews.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={(e) => handleBookmark(selectedNews.id, e)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px',
                        border: '2px solid var(--border-neon)', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                        color: bookmarkedNews.has(selectedNews.id) ? 'var(--color-primary)' : 'var(--text-main)'
                      }}
                    >
                      <Heart size={15} fill={bookmarkedNews.has(selectedNews.id) ? 'currentColor' : 'none'} />
                      {bookmarkedNews.has(selectedNews.id) ? 'Đã lưu' : 'Lưu'}
                    </button>
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({ title: selectedNews.tieu_de, url: selectedNews.url }).catch(() => {});
                        } else {
                          navigator.clipboard.writeText(selectedNews.url || window.location.href);
                          showToast('Đã sao chép liên kết', 'success');
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                    >
                      Chia sẻ
                    </button>
                  </div>
                </div>

                {selectedNews.tom_tat && (
                  <div style={{ background: '#FEF2F2', borderLeft: '4px solid var(--color-primary)', borderRadius: '8px', padding: '14px 16px', marginBottom: '18px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>Tóm tắt</p>
                    <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.6, color: 'var(--text-main)' }}>{selectedNews.tom_tat}</p>
                  </div>
                )}

                <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '18px', background: '#F1F5F9', minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selectedNews.anh_dai_dien ? (
                    <img src={selectedNews.anh_dai_dien} alt="" style={{ width: '100%', maxHeight: '360px', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <Newspaper size={40} style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
                  )}
                </div>

                {selectedNews.url && (
                  <a
                    href={selectedNews.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 700, fontSize: '14px' }}
                  >
                    📰 Đọc bài viết gốc trên {selectedNews.nha_dai}
                  </a>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
                <div style={{ border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800 }}>Thông tin bài viết</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Nguồn</span>
                      <strong>{selectedNews.nha_dai || '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Chuyên mục</span>
                      <strong>{selectedNews.chuyen_muc ? normalizeCategory(selectedNews.chuyen_muc) : '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Thời gian đăng</span>
                      <strong>{selectedNews.created_at ? new Date(selectedNews.created_at).toLocaleString('vi-VN') : '—'}</strong>
                    </div>
                    {selectedNews.do_tin_cay != null && (() => {
                      const pill = trustPill(selectedNews.do_tin_cay);
                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-dim)' }}>Độ tin cậy</span>
                          <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: pill.bg, color: pill.color }}>{pill.label}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {selectedNews.tu_khoa && selectedNews.tu_khoa.length > 0 && (
                  <div>
                    <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 800 }}>Chủ đề liên quan</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {selectedNews.tu_khoa.map(tag => (
                        <span key={tag} style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', background: '#F1F5F9', color: 'var(--text-main)' }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {relatedNews.length > 0 && (
                  <div>
                    <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 800 }}>Tin tức liên quan</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {(showAllRelated ? relatedNews : relatedNews.slice(0, 3)).map(rn => (
                        <a
                          key={rn.id}
                          href={rn.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'flex', gap: '10px', textDecoration: 'none', color: 'inherit' }}
                        >
                          <div style={{ width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {rn.anh_dai_dien ? (
                              <img src={rn.anh_dai_dien} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <Newspaper size={18} style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {rn.tieu_de}
                            </p>
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{rn.nha_dai} · {timeAgo(rn.thoi_gian_dang || rn.created_at)}</span>
                          </div>
                        </a>
                      ))}
                    </div>
                    {relatedNews.length > 3 && !showAllRelated && (
                      <button
                        onClick={() => setShowAllRelated(true)}
                        style={{ marginTop: '10px', background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                      >
                        Xem thêm tin tức liên quan →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {filteredNews.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-neon)' }}>
                <button onClick={goToPrevNews} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-main)', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>
                  <ChevronLeft size={16} /> Bài trước
                </button>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{selectedIndex + 1} / {filteredNews.length}</span>
                <button onClick={goToNextNews} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-main)', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>
                  Bài tiếp theo <ChevronRight size={16} />
                </button>
              </div>
            )}
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
