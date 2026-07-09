import React, { useState, useEffect, useMemo } from 'react';
import { Heart, Trash2, ExternalLink, ChevronLeft, ChevronRight, Bookmark, Share2, Clock, Newspaper, X, Search, LayoutGrid, List, Building2, ArrowUpDown, ArrowRight } from 'lucide-react';
import Toast from './Toast';
import ConfirmDialog from './molecules/ConfirmDialog/ConfirmDialog';

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

function trustPill(score) {
  if (score >= 80) return { label: 'Cao', bg: '#DCFCE7', color: '#16A34A' };
  if (score >= 50) return { label: 'Trung bình', bg: '#FEF3C7', color: '#D97706' };
  return { label: 'Thấp', bg: '#FEE2E2', color: '#DC2626' };
}

const ITEMS_PER_PAGE = 5;

const FavoritesView = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState('all'); // all | news | business
  const [newsBookmarks, setNewsBookmarks] = useState([]);
  const [businessBookmarks, setBusinessBookmarks] = useState([]);
  const [stats, setStats] = useState({ news_count: 0, business_count: 0, total: 0 });
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selectedNewsIndex, setSelectedNewsIndex] = useState(null);
  const [relatedNews, setRelatedNews] = useState([]);
  const [showAllRelated, setShowAllRelated] = useState(false);
  const [newsPage, setNewsPage] = useState(1);
  const [businessPage, setBusinessPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [sortOrder, setSortOrder] = useState('newest'); // newest | oldest

  // Real category breakdown of saved news (no fabricated topics)
  const newsCategories = useMemo(() => {
    const map = new Map();
    newsBookmarks.forEach(n => {
      const key = (n.chuyen_muc || '').trim() || 'Khác';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [newsBookmarks]);

  const filteredNewsBookmarks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = newsBookmarks.filter(n => {
      const matchSearch = !q || n.tieu_de.toLowerCase().includes(q) || (n.tom_tat || '').toLowerCase().includes(q);
      const matchCategory = !categoryFilter || (n.chuyen_muc || 'Khác').trim() === categoryFilter;
      return matchSearch && matchCategory;
    });
    list = [...list].sort((a, b) => {
      const da = new Date(a.bookmarked_at).getTime();
      const db = new Date(b.bookmarked_at).getTime();
      return sortOrder === 'newest' ? db - da : da - db;
    });
    return list;
  }, [newsBookmarks, searchQuery, categoryFilter, sortOrder]);

  const filteredBusinessBookmarks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return businessBookmarks;
    return businessBookmarks.filter(b => b.ten_doanh_nghiep.toLowerCase().includes(q));
  }, [businessBookmarks, searchQuery]);

  const selectedNews = selectedNewsIndex !== null ? filteredNewsBookmarks[selectedNewsIndex] : null;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Paginated news
  const paginatedNews = useMemo(() => {
    const start = (newsPage - 1) * ITEMS_PER_PAGE;
    return filteredNewsBookmarks.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredNewsBookmarks, newsPage]);

  const newsTotalPages = Math.max(1, Math.ceil(filteredNewsBookmarks.length / ITEMS_PER_PAGE));

  // Paginated businesses
  const paginatedBusinesses = useMemo(() => {
    const start = (businessPage - 1) * ITEMS_PER_PAGE;
    return filteredBusinessBookmarks.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBusinessBookmarks, businessPage]);

  const businessTotalPages = Math.max(1, Math.ceil(filteredBusinessBookmarks.length / ITEMS_PER_PAGE));

  // Reset page when switching tabs
  useEffect(() => {
    setNewsPage(1);
    setBusinessPage(1);
  }, [searchQuery, categoryFilter, sortOrder]);

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
        if (type === 'news' && selectedNews?.id === id) {
          closeNewsDetail();
        }
        fetchBookmarks();
      } else {
        showToast('Lỗi khi xóa', 'error');
      }
    } catch (error) {
      console.error('Error removing bookmark:', error);
      showToast('Lỗi khi xóa', 'error');
    }
  };

  const openNewsDetail = (index) => {
    setSelectedNewsIndex(index);
    setShowAllRelated(false);
    document.body.style.overflow = 'hidden';
  };

  const closeNewsDetail = () => {
    setSelectedNewsIndex(null);
    setRelatedNews([]);
    document.body.style.overflow = 'auto';
  };

  const goToPrevNews = () => {
    setShowAllRelated(false);
    setSelectedNewsIndex(i => (i > 0 ? i - 1 : filteredNewsBookmarks.length - 1));
  };

  const goToNextNews = () => {
    setShowAllRelated(false);
    setSelectedNewsIndex(i => (i < filteredNewsBookmarks.length - 1 ? i + 1 : 0));
  };

  // Real related-articles lookup (category + 7-day window + text similarity),
  // not fabricated — reuses the existing clustering endpoint.
  useEffect(() => {
    if (!selectedNews) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`/api/enrichment/find-similar-news/${selectedNews.id}?limit=6`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => setRelatedNews(data?.similar_news || []))
      .catch(() => setRelatedNews([]));
  }, [selectedNews?.id]);

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
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px', alignItems: isMobile ? 'stretch' : 'flex-start' }}>
          <aside style={{ width: isMobile ? '100%' : '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => { setActiveTab('all'); setCategoryFilter(null); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px',
                borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', marginBottom: '10px',
                background: activeTab === 'all' ? '#FEF2F2' : 'transparent',
                color: activeTab === 'all' ? 'var(--color-primary)' : 'var(--text-main)', fontWeight: 700, fontSize: '14px'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Heart size={16} fill={activeTab === 'all' ? 'currentColor' : 'none'} /> Tất cả yêu thích</span>
              <span>{stats.total}</span>
            </button>

            {[
              { key: 'news', label: 'Tin tức', count: stats.news_count },
              { key: 'business', label: 'Doanh nghiệp', count: stats.business_count },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setCategoryFilter(null); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px',
                  borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '13.5px', fontWeight: 600,
                  background: activeTab === tab.key ? '#FEF2F2' : 'transparent',
                  color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--text-main)'
                }}
              >
                <span>{tab.label}</span>
                <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>{tab.count}</span>
              </button>
            ))}

            {newsCategories.length > 0 && (
              <>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.5px', margin: '18px 0 8px 4px' }}>DANH MỤC</p>
                {newsCategories.map(([cat, count]) => (
                  <button
                    key={cat}
                    onClick={() => { setActiveTab('news'); setCategoryFilter(categoryFilter === cat ? null : cat); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px',
                      borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: 600,
                      background: categoryFilter === cat ? '#FEF2F2' : 'transparent',
                      color: categoryFilter === cat ? 'var(--color-primary)' : 'var(--text-main)'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                    <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>{count}</span>
                  </button>
                ))}
              </>
            )}
          </aside>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <Heart size={22} color="var(--color-primary)" fill="var(--color-primary)" />
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Danh sách yêu thích</h2>
            </div>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: 'var(--text-dim)' }}>Quản lý tin tức và doanh nghiệp bạn quan tâm</p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-dim)' }} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm trong yêu thích..."
                  style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13.5px', boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={() => setSortOrder(o => (o === 'newest' ? 'oldest' : 'newest'))}
                title="Đổi thứ tự sắp xếp"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', borderRadius: '10px', border: '2px solid var(--border-neon)', background: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                <ArrowUpDown size={15} /> {sortOrder === 'newest' ? 'Mới nhất' : 'Cũ nhất'}
              </button>
              <div style={{ display: 'flex', gap: '4px' }}>
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

            {(activeTab === 'all' || activeTab === 'news') && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Tin tức đã lưu ({filteredNewsBookmarks.length})</h3>
                  {activeTab === 'all' && filteredNewsBookmarks.length > 4 && (
                    <button onClick={() => setActiveTab('news')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Xem tất cả <ArrowRight size={14} />
                    </button>
                  )}
                </div>

                {filteredNewsBookmarks.length === 0 ? (
                  <div className="empty-state">
                    <Heart size={48} />
                    <p>Chưa có tin tức yêu thích</p>
                    <p className="hint">Nhấn vào icon ❤️ ở tin tức để lưu vào danh sách này</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'list' ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                    {(activeTab === 'all' ? filteredNewsBookmarks.slice(0, 4) : paginatedNews).map((item) => {
                      const realIndex = filteredNewsBookmarks.findIndex(n => n.id === item.id);
                      return (
                        <div key={item.id} style={{ background: 'white', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer', display: viewMode === 'list' ? 'flex' : 'block' }} onClick={() => openNewsDetail(realIndex)}>
                          <div style={{ width: viewMode === 'list' ? '160px' : '100%', height: viewMode === 'list' ? '110px' : '130px', flexShrink: 0, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.anh_dai_dien ? (
                              <img src={item.anh_dai_dien} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <Newspaper size={28} style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
                            )}
                          </div>
                          <div style={{ padding: '12px 14px', minWidth: 0, flex: 1 }}>
                            {item.chuyen_muc && (
                              <span className="badge category" style={{ marginBottom: '8px', display: 'inline-block' }}>{item.chuyen_muc}</span>
                            )}
                            <p style={{ margin: '0 0 8px', fontSize: '13.5px', fontWeight: 700, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {item.tieu_de}
                            </p>
                            <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: 'var(--text-dim)' }}>{item.nha_dai} · {timeAgo(item.bookmarked_at)}</p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              {item.url ? (
                                <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-primary)' }}>
                                  Đọc lại →
                                </a>
                              ) : <span />}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveNews(item.id); }}
                                title="Xóa khỏi yêu thích"
                                style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-primary)', flexShrink: 0 }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'news' && newsTotalPages > 1 && (
                  <div className="pagination">
                    <button className="pagination-btn" onClick={() => setNewsPage(p => Math.max(1, p - 1))} disabled={newsPage === 1}>
                      <ChevronLeft size={18} /> <span>Trước</span>
                    </button>
                    <div className="pagination-numbers">
                      {Array.from({ length: newsTotalPages }, (_, i) => i + 1).map(page => (
                        <button key={page} className={`pagination-number ${page === newsPage ? 'active' : ''}`} onClick={() => setNewsPage(page)}>
                          {page}
                        </button>
                      ))}
                    </div>
                    <button className="pagination-btn" onClick={() => setNewsPage(p => Math.min(newsTotalPages, p + 1))} disabled={newsPage === newsTotalPages}>
                      <span>Sau</span> <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'business') && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Doanh nghiệp đã theo dõi ({filteredBusinessBookmarks.length})</h3>
                  {activeTab === 'all' && filteredBusinessBookmarks.length > 6 && (
                    <button onClick={() => setActiveTab('business')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Xem tất cả <ArrowRight size={14} />
                    </button>
                  )}
                </div>

                {filteredBusinessBookmarks.length === 0 ? (
                  <div className="empty-state">
                    <Heart size={48} />
                    <p>Chưa có doanh nghiệp yêu thích</p>
                    <p className="hint">Nhấn vào icon ❤️ ở doanh nghiệp để lưu vào danh sách này</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'list' ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                    {(activeTab === 'all' ? filteredBusinessBookmarks.slice(0, 6) : paginatedBusinesses).map(item => (
                      <div key={item.id} style={{ background: 'white', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '14px', position: 'relative', display: viewMode === 'list' ? 'flex' : 'block', alignItems: 'center', gap: '12px' }}>
                        <button
                          onClick={() => handleRemoveBusiness(item.id)}
                          title="Xóa khỏi yêu thích"
                          style={{ position: viewMode === 'list' ? 'static' : 'absolute', top: '10px', right: '10px', marginLeft: viewMode === 'list' ? 'auto' : 0, width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-primary)', order: viewMode === 'list' ? 3 : 0 }}
                        >
                          <Trash2 size={13} />
                        </button>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: viewMode === 'list' ? 0 : '10px', flexShrink: 0 }}>
                          <Building2 size={20} color="var(--color-primary)" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: '0 0 2px', fontSize: '13.5px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.ten_doanh_nghiep}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)' }}>{item.nganh_nghe || 'Chưa rõ ngành'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'business' && businessTotalPages > 1 && (
                  <div className="pagination">
                    <button className="pagination-btn" onClick={() => setBusinessPage(p => Math.max(1, p - 1))} disabled={businessPage === 1}>
                      <ChevronLeft size={18} /> <span>Trước</span>
                    </button>
                    <div className="pagination-numbers">
                      {Array.from({ length: businessTotalPages }, (_, i) => i + 1).map(page => (
                        <button key={page} className={`pagination-number ${page === businessPage ? 'active' : ''}`} onClick={() => setBusinessPage(page)}>
                          {page}
                        </button>
                      ))}
                    </div>
                    <button className="pagination-btn" onClick={() => setBusinessPage(p => Math.min(businessTotalPages, p + 1))} disabled={businessPage === businessTotalPages}>
                      <span>Sau</span> <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      {selectedNews && (
        <div className="modal-overlay" onClick={closeNewsDetail}>
          <div className="modal-content" style={{ maxWidth: '980px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeNewsDetail}><X size={20} /></button>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 2fr) minmax(0, 1fr)', gap: '28px', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                {selectedNews.chuyen_muc && (
                  <span className="badge category" style={{ marginBottom: '10px', display: 'inline-block' }}>{selectedNews.chuyen_muc}</span>
                )}
                <h2 className="modal-title" style={{ marginTop: 0 }}>{selectedNews.tieu_de}</h2>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-dim)' }}>
                    <Newspaper size={16} /> <strong style={{ color: 'var(--text-main)' }}>{selectedNews.nha_dai}</strong>
                    <span>· {timeAgo(selectedNews.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleRemoveNews(selectedNews.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)' }}
                    >
                      <Bookmark size={15} fill="currentColor" /> Đã lưu
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
                      <Share2 size={15} /> Chia sẻ
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
                    📰 Đọc bài viết gốc trên {selectedNews.nha_dai} <ExternalLink size={14} />
                  </a>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800 }}>Thông tin bài viết</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Nguồn</span>
                      <strong>{selectedNews.nha_dai || '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Chuyên mục</span>
                      <strong>{selectedNews.chuyen_muc || '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> Thời gian đăng</span>
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

            {filteredNewsBookmarks.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-neon)' }}>
                <button onClick={goToPrevNews} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-main)', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>
                  <ChevronLeft size={16} /> Bài trước
                </button>
                {filteredNewsBookmarks.length <= 10 ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {filteredNewsBookmarks.map((_, i) => (
                      <span key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: i === selectedNewsIndex ? 'var(--color-primary)' : '#E5E7EB' }} />
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{selectedNewsIndex + 1} / {filteredNewsBookmarks.length}</span>
                )}
                <button onClick={goToNextNews} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-main)', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>
                  Bài tiếp theo <ChevronRight size={16} />
                </button>
              </div>
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
