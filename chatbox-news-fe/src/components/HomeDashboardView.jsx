import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Newspaper, Building2, Search, ArrowRight, Heart,
  CheckCircle2, ShieldCheck, Briefcase, Plus, X, RotateCcw, Bell,
  Cpu, Landmark, Factory, Truck, GraduationCap, HeartPulse, Sparkles, SlidersHorizontal,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import Toast from './Toast';

function trustPill(score) {
  if (score >= 80) return { label: 'Cao', bg: '#DCFCE7', color: '#16A34A' };
  if (score >= 50) return { label: 'Trung bình', bg: '#FEF3C7', color: '#D97706' };
  return { label: 'Thấp', bg: '#FEE2E2', color: '#DC2626' };
}

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

function normalizeText(text) {
  if (!text) return '';
  return text.toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function formatRegionDisplay(region) {
  if (!region) return '';
  const r = region.toLowerCase();
  if (r.includes('bac') || r.includes('bắc')) return 'Bắc';
  if (r.includes('nam')) return 'Nam';
  if (r.includes('trung')) return 'Trung';
  if (r.includes('toan')) return 'Toàn quốc';
  return region;
}

const CATEGORY_ICONS = [Cpu, Landmark, Factory, Truck, GraduationCap, HeartPulse, Building2, Briefcase];
const NEWS_TAG_PALETTE = [
  { bg: '#FEE2E2', color: '#DC2626' }, { bg: '#DBEAFE', color: '#2563EB' },
  { bg: '#DCFCE7', color: '#16A34A' }, { bg: '#FEF3C7', color: '#D97706' },
  { bg: '#EDE9FE', color: '#7C3AED' },
];
function newsTagStyle(category) {
  if (!category) return NEWS_TAG_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  return NEWS_TAG_PALETTE[hash % NEWS_TAG_PALETTE.length];
}

const CARD_STYLE = {
  background: 'white', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)',
  cursor: 'pointer', transition: 'all 0.15s ease', textAlign: 'left', position: 'relative',
};

const PINNED_TOPICS_KEY = 'home_pinned_topics';

// Real trust_score is a completeness score (đủ thông tin cơ bản + website =
// 60/100 today, since no business has address/social filled in yet — see
// calculate_trust_score in ai_enrichment_service.py). Threshold is set
// relative to that current baseline so the filter isn't an impossible bar;
// as businesses add address/social data their scores will rise past it.
const VERIFIED_THRESHOLD = 60;

function HomeDashboardView({ currentUser, allBusinesses, allNews, isFetchBusinessLoading, isFetchNewsLoading, onOpenChatWithPrompt, onGoToBusiness, onGoToNews, onOpenBusinessDetail }) {
  const [localSearch, setLocalSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState(null);
  const [scaleFilter, setScaleFilter] = useState(null);
  const [trustVerified, setTrustVerified] = useState(false);
  const [favoriteBusinessesOnly, setFavoriteBusinessesOnly] = useState(false);
  const [favoriteNewsOnly, setFavoriteNewsOnly] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [bookmarkedNewsIds, setBookmarkedNewsIds] = useState(new Set());
  const [pinnedTopics, setPinnedTopics] = useState(null);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [selectedNewsIndex, setSelectedNewsIndex] = useState(null);
  const [relatedNews, setRelatedNews] = useState([]);
  const [showAllRelated, setShowAllRelated] = useState(false);
  const [toast, setToast] = useState(null);
  // overflow-x:auto only responds to real touch panning; testing by
  // click-dragging with a mouse (e.g. a resized desktop browser window)
  // doesn't scroll it at all, so we add manual drag-to-scroll on top.
  const carouselRef = useRef(null);
  const categoryScrollRef = useRef(null);
  const trendingScrollRef = useRef(null);
  const dragState = useRef({ isDown: false, startX: 0, startScrollLeft: 0, moved: false, el: null });

  useEffect(() => {
    const state = dragState.current;
    const els = [carouselRef.current, categoryScrollRef.current, trendingScrollRef.current].filter(Boolean);
    if (els.length === 0) return;

    const onDown = (el) => (e) => {
      state.isDown = true;
      state.moved = false;
      state.startX = e.pageX;
      state.startScrollLeft = el.scrollLeft;
      state.el = el;
    };
    const onMove = (e) => {
      if (!state.isDown || !state.el) return;
      const dx = e.pageX - state.startX;
      if (Math.abs(dx) > 5) state.moved = true;
      state.el.scrollLeft = state.startScrollLeft - dx;
    };
    const onUp = () => { state.isDown = false; };

    const downHandlers = els.map(el => {
      const handler = onDown(el);
      el.addEventListener('mousedown', handler);
      return { el, handler };
    });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      downHandlers.forEach(({ el, handler }) => el.removeEventListener('mousedown', handler));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isMobile]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setBookmarkedIds(new Set()); return; }
    fetch('/api/bookmarks/businesses', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : []))
      .then(list => setBookmarkedIds(new Set((list || []).map(b => b.id))))
      .catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setBookmarkedNewsIds(new Set()); return; }
    fetch('/api/bookmarks/news', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : []))
      .then(list => setBookmarkedNewsIds(new Set((list || []).map(n => n.id))))
      .catch(() => {});
  }, [currentUser]);

  const toggleBookmark = async (bizId, e) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    if (!token) { alert('Vui lòng đăng nhập để lưu doanh nghiệp yêu thích'); return; }
    const isBookmarked = bookmarkedIds.has(bizId);
    try {
      if (isBookmarked) {
        await fetch(`/api/bookmarks/businesses/${bizId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        setBookmarkedIds(prev => { const n = new Set(prev); n.delete(bizId); return n; });
      } else {
        await fetch('/api/bookmarks/businesses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ business_id: bizId })
        });
        setBookmarkedIds(prev => new Set([...prev, bizId]));
      }
    } catch (err) { console.error(err); }
  };

  const toggleNewsBookmark = async (newsId, e) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    if (!token) { alert('Vui lòng đăng nhập để lưu tin tức yêu thích'); return; }
    const isBookmarked = bookmarkedNewsIds.has(newsId);
    try {
      if (isBookmarked) {
        await fetch(`/api/bookmarks/news/${newsId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        setBookmarkedNewsIds(prev => { const n = new Set(prev); n.delete(newsId); return n; });
      } else {
        await fetch('/api/bookmarks/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ news_id: newsId })
        });
        setBookmarkedNewsIds(prev => new Set([...prev, newsId]));
      }
    } catch (err) { console.error(err); }
  };

  const industryCounts = useMemo(() => {
    const map = new Map();
    allBusinesses.forEach(b => {
      const key = (b.industry || '').trim() || 'Khác';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [allBusinesses]);

  const scaleOptions = useMemo(() => {
    const options = [...new Set(allBusinesses.map(b => b.scale).filter(Boolean))];
    // Sort by the first number in each label (e.g. "50-100 nhân viên" -> 50)
    // so the dropdown reads smallest-to-largest instead of insertion order.
    return options.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    });
  }, [allBusinesses]);

  // "Chủ đề quan tâm" — pinned industries, kept in localStorage only (no
  // backend table for this yet); default to the 4 biggest industries.
  useEffect(() => {
    if (pinnedTopics !== null || industryCounts.length === 0) return;
    try {
      const saved = JSON.parse(localStorage.getItem(PINNED_TOPICS_KEY) || 'null');
      setPinnedTopics(Array.isArray(saved) ? saved : industryCounts.slice(0, 4).map(([ind]) => ind));
    } catch (e) {
      setPinnedTopics(industryCounts.slice(0, 4).map(([ind]) => ind));
    }
  }, [industryCounts, pinnedTopics]);

  const updatePinnedTopics = (next) => {
    setPinnedTopics(next);
    localStorage.setItem(PINNED_TOPICS_KEY, JSON.stringify(next));
  };

  const countFor = (industry) => industryCounts.find(([ind]) => ind === industry)?.[1] || 0;
  const unpinnedIndustries = industryCounts.map(([ind]) => ind).filter(ind => !(pinnedTopics || []).includes(ind));

  const hasActiveFilters = regionFilter !== 'all' || industryFilter || scaleFilter || trustVerified || favoriteBusinessesOnly || favoriteNewsOnly || localSearch.trim();

  const clearAllFilters = () => {
    setLocalSearch(''); setRegionFilter('all'); setIndustryFilter(null); setScaleFilter(null);
    setTrustVerified(false); setFavoriteBusinessesOnly(false); setFavoriteNewsOnly(false);
  };

  const filteredBusinesses = useMemo(() => {
    const q = normalizeText(localSearch);
    return allBusinesses.filter(b => {
      if (regionFilter !== 'all' && !normalizeText(b.region).includes(normalizeText(regionFilter))) return false;
      if (industryFilter && (b.industry || 'Khác') !== industryFilter) return false;
      if (scaleFilter && b.scale !== scaleFilter) return false;
      if (trustVerified && !((b.trust_score ?? 0) >= VERIFIED_THRESHOLD)) return false;
      if (favoriteBusinessesOnly && !bookmarkedIds.has(b.id)) return false;
      if (q) {
        const haystack = `${normalizeText(b.name)} ${normalizeText(b.industry)} ${normalizeText(b.location)} ${normalizeText(b.description)}`;
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allBusinesses, regionFilter, industryFilter, scaleFilter, trustVerified, favoriteBusinessesOnly, bookmarkedIds, localSearch]);

  const suggestedBusinesses = useMemo(
    () => [...filteredBusinesses].sort((a, b) => (b.trust_score ?? 0) - (a.trust_score ?? 0)).slice(0, 5),
    [filteredBusinesses]
  );

  const topNews = useMemo(() => {
    const pool = favoriteNewsOnly ? allNews.filter(n => bookmarkedNewsIds.has(n.id)) : allNews;
    const featured = pool.filter(n => n.featured);
    const rest = pool.filter(n => !n.featured);
    return [...featured, ...rest].slice(0, 5);
  }, [allNews, favoriteNewsOnly, bookmarkedNewsIds]);
  const hiringSum = useMemo(() => allBusinesses.reduce((s, b) => s + (b.dang_tuyen || 0), 0), [allBusinesses]);

  const visibleCategories = showAllCategories ? industryCounts : industryCounts.slice(0, 7);

  const selectedNewsDetail = selectedNewsIndex !== null ? topNews[selectedNewsIndex] : null;

  const goToPrevNews = () => {
    setShowAllRelated(false);
    setSelectedNewsIndex(i => (i > 0 ? i - 1 : topNews.length - 1));
  };
  const goToNextNews = () => {
    setShowAllRelated(false);
    setSelectedNewsIndex(i => (i < topNews.length - 1 ? i + 1 : 0));
  };

  useEffect(() => {
    if (!selectedNewsDetail) { setRelatedNews([]); return; }
    const token = localStorage.getItem('token');
    if (!token) { setRelatedNews([]); return; }
    fetch(`/api/enrichment/find-similar-news/${selectedNewsDetail.id}?limit=6`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => setRelatedNews(data?.similar_news || []))
      .catch(() => setRelatedNews([]));
  }, [selectedNewsDetail?.id]);

  return (
    <>
    <div className="main-content-area fade-in-effect" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px', alignItems: isMobile ? 'stretch' : 'flex-start' }}>
      {isMobile && (
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={17} style={{ position: 'absolute', left: '13px', color: 'var(--text-dim)' }} />
            <input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onGoToBusiness(localSearch); }}
              placeholder="Tìm doanh nghiệp, tin tức, ngành nghề..."
              style={{ width: '100%', padding: '11px 12px 11px 38px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13.5px', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={() => setShowMobileFilters(v => !v)}
            style={{
              width: '42px', flexShrink: 0, borderRadius: '10px', border: `2px solid ${showMobileFilters || hasActiveFilters ? 'var(--color-primary)' : 'var(--border-neon)'}`,
              background: showMobileFilters || hasActiveFilters ? '#FEF2F2' : 'white', color: showMobileFilters || hasActiveFilters ? 'var(--color-primary)' : 'var(--text-main)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}
          >
            <SlidersHorizontal size={17} />
          </button>
        </div>
      )}

      {(!isMobile || showMobileFilters) && (
      <aside style={{ ...(isMobile ? CARD_STYLE : {}), width: isMobile ? '100%' : '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>Bộ lọc nhanh</h3>

        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', ...(isMobile ? { paddingBottom: '14px', borderBottom: '1px solid var(--border-neon)' } : {}) }}>
          <span style={{ fontSize: '13.5px', fontWeight: 600 }}>Doanh nghiệp uy tín</span>
          <span
            onClick={() => setTrustVerified(v => !v)}
            style={{
              width: '38px', height: '20px', borderRadius: '20px', position: 'relative', flexShrink: 0,
              background: trustVerified ? 'var(--color-primary)' : '#E5E7EB', transition: 'background 0.2s ease'
            }}
          >
            <span style={{
              position: 'absolute', top: '2px', left: trustVerified ? '20px' : '2px', width: '16px', height: '16px',
              borderRadius: '50%', background: 'white', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }} />
          </span>
        </label>

        <div style={isMobile ? { paddingBottom: '14px', borderBottom: '1px solid var(--border-neon)' } : {}}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', margin: '0 0 8px' }}>KHU VỰC / MIỀN</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {['all', 'Bac', 'Trung', 'Nam'].map(r => (
              <button
                key={r}
                onClick={() => setRegionFilter(r)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px',
                  border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: 600,
                  background: regionFilter === r ? '#FEF2F2' : 'transparent',
                  color: regionFilter === r ? 'var(--color-primary)' : 'var(--text-main)'
                }}
              >
                {regionFilter === r && <CheckCircle2 size={14} />}
                {r === 'all' ? 'Tất cả' : r === 'Bac' ? 'Miền Bắc' : r === 'Trung' ? 'Miền Trung' : 'Miền Nam'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', margin: '0 0 8px' }}>NGÀNH NGHỀ</p>
          <select
            value={industryFilter || ''}
            onChange={(e) => setIndustryFilter(e.target.value || null)}
            style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '2px solid var(--border-neon)', fontSize: '13px', fontWeight: 600, background: 'white' }}
          >
            <option value="">Tất cả ngành nghề</option>
            {industryCounts.map(([ind, count]) => (
              <option key={ind} value={ind}>{ind} ({count})</option>
            ))}
          </select>
        </div>

        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', margin: '0 0 8px' }}>QUY MÔ DOANH NGHIỆP</p>
          <select
            value={scaleFilter || ''}
            onChange={(e) => setScaleFilter(e.target.value || null)}
            style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '2px solid var(--border-neon)', fontSize: '13px', fontWeight: 600, background: 'white' }}
          >
            <option value="">Tất cả quy mô</option>
            {scaleOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', margin: '0 0 8px' }}>MỨC ĐỘ TIN CẬY</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={trustVerified} onChange={(e) => setTrustVerified(e.target.checked)} style={{ accentColor: '#16A34A' }} />
            Đã xác minh
          </label>
        </div>

        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', margin: '0 0 8px' }}>YÊU THÍCH</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginBottom: '6px' }}>
            <input type="checkbox" checked={favoriteBusinessesOnly} onChange={(e) => setFavoriteBusinessesOnly(e.target.checked)} />
            Doanh nghiệp được yêu thích
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={favoriteNewsOnly} onChange={(e) => setFavoriteNewsOnly(e.target.checked)} />
            Tin tức yêu thích
          </label>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', margin: 0 }}>CHỦ ĐỀ QUAN TÂM</p>
            <button onClick={() => setShowAddTopic(v => !v)} title="Thêm chủ đề" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', display: 'flex' }}>
              <Plus size={16} />
            </button>
          </div>
          {showAddTopic && (
            <select
              autoFocus
              value=""
              onChange={(e) => { if (e.target.value) updatePinnedTopics([...(pinnedTopics || []), e.target.value]); setShowAddTopic(false); }}
              style={{ width: '100%', padding: '7px 8px', borderRadius: '8px', border: '2px solid var(--border-neon)', fontSize: '12.5px', marginBottom: '8px' }}
            >
              <option value="">Chọn ngành để ghim...</option>
              {unpinnedIndustries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
            </select>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {(pinnedTopics || []).map(topic => (
              <div
                key={topic}
                onClick={() => setIndustryFilter(industryFilter === topic ? null : topic)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px',
                  borderRadius: '8px', cursor: 'pointer',
                  background: industryFilter === topic ? '#FEF2F2' : 'transparent',
                  color: industryFilter === topic ? 'var(--color-primary)' : 'var(--text-main)'
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{countFor(topic)}</span>
                  <X size={13} onClick={(e) => { e.stopPropagation(); updatePinnedTopics((pinnedTopics || []).filter(t => t !== topic)); }} />
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={clearAllFilters}
          disabled={!hasActiveFilters}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px',
            borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'white',
            color: hasActiveFilters ? 'var(--color-primary)' : 'var(--text-dim)', fontSize: '13px', fontWeight: 700,
            cursor: hasActiveFilters ? 'pointer' : 'not-allowed'
          }}
        >
          <RotateCcw size={14} /> Xóa tất cả bộ lọc
        </button>
      </aside>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {!isMobile && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', color: 'var(--text-dim)' }} />
            <input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Tìm doanh nghiệp, tin tức, ngành nghề, địa điểm..."
              style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={() => onGoToBusiness(localSearch)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3B0199, #2A0177)', color: 'white', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}
          >
            <Search size={16} /> Tìm kiếm
          </button>
        </div>
        )}

        {(() => {
          const ctaCards = [
            {
              key: 'business', onClick: () => onGoToBusiness(), gradient: 'linear-gradient(135deg, #F97316, #DC2626)',
              eyebrow: 'Khám phá', title: 'Doanh nghiệp nổi bật', desc: 'Kết nối với những doanh nghiệp uy tín trong mọi lĩnh vực',
              cta: 'Khám phá ngay', ctaColor: '#DC2626'
            },
            {
              key: 'news', onClick: () => onGoToNews(), gradient: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
              eyebrow: 'Tin tức mới', title: `${allNews.length} bài viết`, desc: 'Cập nhật xu hướng thị trường & kinh tế',
              cta: 'Xem tin tức', ctaColor: '#1D4ED8'
            },
            {
              key: 'hiring', onClick: () => onGoToBusiness(), gradient: 'linear-gradient(135deg, #22C55E, #15803D)',
              eyebrow: 'Tuyển dụng hấp dẫn', title: `${hiringSum} vị trí`, desc: 'đang chờ bạn ứng tuyển',
              cta: 'Tìm việc ngay', ctaColor: '#15803D'
            },
          ];

          if (!isMobile) {
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                {ctaCards.map(c => (
                  <button key={c.key} onClick={c.onClick} style={{ ...CARD_STYLE, border: 'none', padding: '22px', background: c.gradient, color: 'white' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, opacity: 0.9 }}>{c.eyebrow}</p>
                    <h4 style={{ margin: '0 0 6px', fontSize: '19px', fontWeight: 800 }}>{c.title}</h4>
                    <p style={{ margin: '0 0 16px', fontSize: '12.5px', opacity: 0.9 }}>{c.desc}</p>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'white', color: c.ctaColor, padding: '8px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '13px' }}>
                      {c.cta} <ArrowRight size={14} />
                    </span>
                  </button>
                ))}
              </div>
            );
          }

          return (
            <div style={{ marginBottom: '20px' }}>
              <div
                ref={carouselRef}
                onScroll={(e) => {
                  const idx = Math.round(e.target.scrollLeft / e.target.clientWidth);
                  setBannerIndex(idx);
                }}
                style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', gap: '0', WebkitOverflowScrolling: 'touch', cursor: 'grab', userSelect: 'none' }}
              >
                {ctaCards.map(c => (
                  <button
                    key={c.key}
                    onClick={() => { if (!dragState.current.moved) c.onClick(); }}
                    style={{ ...CARD_STYLE, flex: '0 0 100%', scrollSnapAlign: 'center', border: 'none', padding: '22px', background: c.gradient, color: 'white', boxSizing: 'border-box' }}
                  >
                    <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, opacity: 0.9 }}>{c.eyebrow}</p>
                    <h4 style={{ margin: '0 0 6px', fontSize: '19px', fontWeight: 800 }}>{c.title}</h4>
                    <p style={{ margin: '0 0 16px', fontSize: '12.5px', opacity: 0.9 }}>{c.desc}</p>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'white', color: c.ctaColor, padding: '8px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '13px' }}>
                      {c.cta} <ArrowRight size={14} />
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '10px' }}>
                {ctaCards.map((c, i) => (
                  <span key={c.key} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i === bannerIndex ? 'var(--color-primary)' : '#E5E7EB' }} />
                ))}
              </div>
            </div>
          );
        })()}

        <div ref={categoryScrollRef} style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', cursor: isMobile ? 'grab' : 'default' }}>
          <button
            onClick={() => setIndustryFilter(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px',
              border: `2px solid ${!industryFilter ? 'var(--color-primary)' : 'var(--border-neon)'}`,
              background: !industryFilter ? '#FEF2F2' : 'white', color: !industryFilter ? 'var(--color-primary)' : 'var(--text-main)',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer'
            }}
          >
            <Sparkles size={14} /> Tất cả
          </button>
          {visibleCategories.map(([ind], idx) => {
            const Icon = CATEGORY_ICONS[idx % CATEGORY_ICONS.length];
            const active = industryFilter === ind;
            return (
              <button
                key={ind}
                onClick={() => setIndustryFilter(active ? null : ind)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px',
                  border: `2px solid ${active ? 'var(--color-primary)' : 'var(--border-neon)'}`,
                  background: active ? '#FEF2F2' : 'white', color: active ? 'var(--color-primary)' : 'var(--text-main)',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                <Icon size={14} /> {ind}
              </button>
            );
          })}
          {!showAllCategories && industryCounts.length > 7 && (
            <button
              onClick={() => setShowAllCategories(true)}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'white', color: 'var(--text-dim)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              ... Xem thêm
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Gợi ý cho bạn</h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: '2px 0 0' }}>Những doanh nghiệp uy tín phù hợp với mối quan tâm của bạn</p>
          </div>
          <button onClick={() => onGoToBusiness()} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Xem tất cả <ArrowRight size={14} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '28px' }}>
          {suggestedBusinesses.map((biz) => (
            <div key={biz.id} onClick={() => onOpenBusinessDetail(biz.id)} style={{ ...CARD_STYLE, padding: '16px' }}>
              <button
                onClick={(e) => toggleBookmark(biz.id, e)}
                style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: bookmarkedIds.has(biz.id) ? 'var(--color-primary)' : 'var(--text-dim)' }}
              >
                <Heart size={17} fill={bookmarkedIds.has(biz.id) ? 'currentColor' : 'none'} />
              </button>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', overflow: 'hidden' }}>
                {biz.logo_url ? (
                  <img src={biz.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  <Building2 size={20} color="var(--color-primary)" />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '13.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{biz.name}</p>
                {(biz.trust_score ?? 0) >= VERIFIED_THRESHOLD && <CheckCircle2 size={14} color="#2563EB" style={{ flexShrink: 0 }} />}
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-dim)' }}>{biz.location || 'Việt Nam'}</p>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {biz.industry && <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: '#DBEAFE', color: '#2563EB' }}>{biz.industry}</span>}
              </div>
              {(biz.trust_score ?? 0) >= VERIFIED_THRESHOLD && (
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#16A34A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={13} /> Đã xác minh
                </span>
              )}
            </div>
          ))}
          {!isFetchBusinessLoading && suggestedBusinesses.length === 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Không có doanh nghiệp khớp bộ lọc hiện tại.</p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Tin tức nổi bật</h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: '2px 0 0' }}>Cập nhật những thông tin quan trọng trong ngày</p>
          </div>
          <button onClick={() => onGoToNews()} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Xem tất cả <ArrowRight size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {topNews.map((news, idx) => {
            const tag = newsTagStyle(news.chuyen_muc);
            return (
              <div key={news.id} onClick={() => { setShowAllRelated(false); setSelectedNewsIndex(idx); }} style={{ ...CARD_STYLE, display: 'flex', gap: '12px', padding: '10px', alignItems: 'flex-start' }}>
                <div style={{ position: 'relative', width: '96px', height: '72px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {news.anh_dai_dien ? (
                    <img src={news.anh_dai_dien} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Newspaper size={22} color="var(--text-dim)" />
                  )}
                  {news.chuyen_muc && (
                    <span style={{ position: 'absolute', top: '6px', left: '6px', fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: tag.bg, color: tag.color }}>
                      {news.chuyen_muc}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '13.5px', lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {news.tieu_de}
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: 'var(--text-dim)' }}>
                    {news.nha_dai || 'Company'} · {timeAgo(news.created_at)}
                  </p>
                </div>
                <button
                  onClick={(e) => toggleNewsBookmark(news.id, e)}
                  title={bookmarkedNewsIds.has(news.id) ? 'Bỏ lưu' : 'Lưu tin'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: bookmarkedNewsIds.has(news.id) ? 'var(--color-primary)' : 'var(--text-dim)', flexShrink: 0, padding: '2px' }}
                >
                  <Heart size={17} fill={bookmarkedNewsIds.has(news.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => onOpenChatWithPrompt('Hãy giúp em theo dõi các doanh nghiệp và tin tức trong lĩnh vực em quan tâm nhé')}
          style={{ ...CARD_STYLE, width: '100%', boxSizing: 'border-box', border: 'none', background: 'linear-gradient(135deg, #FEE2E2, #FECACA)', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}
        >
          <Bell size={22} color="var(--color-primary)" style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: 'var(--text-main)', flex: 1, textAlign: 'left' }}>Nhận thông tin theo dõi lĩnh vực bạn quan tâm</p>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', background: 'var(--color-primary)', padding: '7px 12px', borderRadius: '8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            Thiết lập ngay
          </span>
        </button>

        <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 2px' }}>Xu hướng theo danh mục</h3>
        <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: '0 0 12px' }}>Khám phá các chủ đề, ngành nghề được quan tâm nhiều nhất</p>
        <div
          ref={trendingScrollRef}
          style={isMobile
            ? { display: 'flex', gap: '12px', overflowX: 'auto', cursor: 'grab', paddingBottom: '4px' }
            : { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}
        >
          {industryCounts.slice(0, 6).map(([ind, count], idx) => {
            const Icon = CATEGORY_ICONS[idx % CATEGORY_ICONS.length];
            return (
              <button
                key={ind}
                onClick={() => { if (!dragState.current.moved) setIndustryFilter(ind); }}
                style={{
                  ...CARD_STYLE, padding: '14px', display: 'flex', alignItems: 'center', gap: '10px',
                  ...(isMobile ? { flex: '0 0 220px' } : {})
                }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color="var(--color-primary)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ind}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)' }}>{count} doanh nghiệp</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>

    {selectedNewsDetail && createPortal(
      <div className="modal-overlay" onClick={() => setSelectedNewsIndex(null)}>
        <div className="modal-content" style={{ maxWidth: '980px' }} onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setSelectedNewsIndex(null)}>✕</button>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 2fr) minmax(0, 1fr)', gap: '28px', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              {selectedNewsDetail.chuyen_muc && (
                <span className="badge category" style={{ marginBottom: '10px', display: 'inline-block' }}>{selectedNewsDetail.chuyen_muc}</span>
              )}
              <h2 className="modal-title" style={{ marginTop: 0 }}>{selectedNewsDetail.tieu_de}</h2>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-dim)' }}>
                  <strong style={{ color: 'var(--text-main)' }}>{selectedNewsDetail.nha_dai}</strong>
                  <span>· {timeAgo(selectedNewsDetail.created_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={(e) => toggleNewsBookmark(selectedNewsDetail.id, e)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px',
                      border: '2px solid var(--border-neon)', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                      color: bookmarkedNewsIds.has(selectedNewsDetail.id) ? 'var(--color-primary)' : 'var(--text-main)'
                    }}
                  >
                    <Heart size={15} fill={bookmarkedNewsIds.has(selectedNewsDetail.id) ? 'currentColor' : 'none'} />
                    {bookmarkedNewsIds.has(selectedNewsDetail.id) ? 'Đã lưu' : 'Lưu'}
                  </button>
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: selectedNewsDetail.tieu_de, url: selectedNewsDetail.url }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(selectedNewsDetail.url || window.location.href);
                        setToast({ message: 'Đã sao chép liên kết', type: 'success' });
                      }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                  >
                    Chia sẻ
                  </button>
                </div>
              </div>

              {selectedNewsDetail.tom_tat && (
                <div style={{ background: '#FEF2F2', borderLeft: '4px solid var(--color-primary)', borderRadius: '8px', padding: '14px 16px', marginBottom: '18px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>Tóm tắt</p>
                  <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.6, color: 'var(--text-main)' }}>{selectedNewsDetail.tom_tat}</p>
                </div>
              )}

              <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '18px', background: '#F1F5F9', minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedNewsDetail.anh_dai_dien ? (
                  <img src={selectedNewsDetail.anh_dai_dien} alt="" style={{ width: '100%', maxHeight: '360px', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <Newspaper size={40} style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
                )}
              </div>

              {selectedNewsDetail.url && (
                <a
                  href={selectedNewsDetail.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 700, fontSize: '14px' }}
                >
                  📰 Đọc bài viết gốc trên {selectedNewsDetail.nha_dai}
                </a>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
              <div style={{ border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800 }}>Thông tin bài viết</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Nguồn</span>
                    <strong>{selectedNewsDetail.nha_dai || '—'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Chuyên mục</span>
                    <strong>{selectedNewsDetail.chuyen_muc || '—'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Thời gian đăng</span>
                    <strong>{selectedNewsDetail.created_at ? new Date(selectedNewsDetail.created_at).toLocaleString('vi-VN') : '—'}</strong>
                  </div>
                  {selectedNewsDetail.do_tin_cay != null && (() => {
                    const pill = trustPill(selectedNewsDetail.do_tin_cay);
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-dim)' }}>Độ tin cậy</span>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: pill.bg, color: pill.color }}>{pill.label}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {selectedNewsDetail.tu_khoa && selectedNewsDetail.tu_khoa.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 800 }}>Chủ đề liên quan</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedNewsDetail.tu_khoa.map(tag => (
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

          {topNews.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-neon)' }}>
              <button onClick={goToPrevNews} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-main)', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>
                <ChevronLeft size={16} /> Bài trước
              </button>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{selectedNewsIndex + 1} / {topNews.length}</span>
              <button onClick={goToNextNews} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-main)', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>
                Bài tiếp theo <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>,
      document.body
    )}

    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}

export default HomeDashboardView;
