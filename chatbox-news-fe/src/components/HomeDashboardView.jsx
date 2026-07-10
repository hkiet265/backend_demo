import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Newspaper, Building2, Search, ArrowRight, Heart,
  CheckCircle2, ShieldCheck, Briefcase,
  Cpu, Landmark, Factory, Truck, GraduationCap, HeartPulse, Sparkles,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import Toast from './Toast';
import ScrollReveal from './ScrollReveal';

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
  background: 'rgba(24, 24, 27, 0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
  border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)',
  cursor: 'pointer', transition: 'all 0.15s ease', textAlign: 'left', position: 'relative',
};

// Fixed (not random-per-render) sparkle positions for the hero banner, so
// they don't jump around on every re-render.
const HERO_PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37 + 5) % 100,
  top: (i * 53 + 11) % 100,
  size: 2 + (i % 3),
  delay: (i % 7) * 0.6,
}));

// Real trust_score is a completeness score (đủ thông tin cơ bản + website =
// 60/100 today, since no business has address/social filled in yet — see
// calculate_trust_score in ai_enrichment_service.py). Threshold is set
// relative to that current baseline so the filter isn't an impossible bar;
// as businesses add address/social data their scores will rise past it.
const VERIFIED_THRESHOLD = 60;

// Past this many px of scroll, the navbar switches to its compact style
// and the hero subtitle/CTA hide.
const HEADER_COMPACT_THRESHOLD = 80;

function HomeDashboardView({ currentUser, allBusinesses, allNews, isFetchBusinessLoading, isFetchNewsLoading, onOpenChatWithPrompt, onGoToBusiness, onGoToNews, onOpenBusinessDetail, onHeaderCompactChange }) {
  const [localSearch, setLocalSearch] = useState('');
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const contentAreaRef = useRef(null);
  const [industryFilter, setIndustryFilter] = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [bookmarkedNewsIds, setBookmarkedNewsIds] = useState(new Set());
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const [selectedNewsIndex, setSelectedNewsIndex] = useState(null);
  const [relatedNews, setRelatedNews] = useState([]);
  const [showAllRelated, setShowAllRelated] = useState(false);
  const [toast, setToast] = useState(null);
  // overflow-x:auto only responds to real touch panning; testing by
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // This view's own root div is the actual scroll container (overflow-y:
  // auto), not window — so the scroll listener goes on it, not on window.
  useEffect(() => {
    const el = contentAreaRef.current;
    if (!el) return;

    let isCompact = false;
    const handleScroll = () => {
      const next = el.scrollTop > HEADER_COMPACT_THRESHOLD;
      if (next === isCompact) return;
      isCompact = next;
      setIsHeaderCompact(next);
      onHeaderCompactChange?.(next);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      onHeaderCompactChange?.(false);
    };
  }, [onHeaderCompactChange]);


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

  const filteredBusinesses = useMemo(() => {
    const q = normalizeText(localSearch);
    return allBusinesses.filter(b => {
      if (industryFilter && (b.industry || 'Khác') !== industryFilter) return false;
      if (q) {
        const haystack = `${normalizeText(b.name)} ${normalizeText(b.industry)} ${normalizeText(b.location)} ${normalizeText(b.description)}`;
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allBusinesses, industryFilter, localSearch]);

  const suggestedBusinesses = useMemo(
    () => [...filteredBusinesses].sort((a, b) => (b.trust_score ?? 0) - (a.trust_score ?? 0)).slice(0, 5),
    [filteredBusinesses]
  );

  const topNews = useMemo(() => {
    const featured = allNews.filter(n => n.featured);
    const rest = allNews.filter(n => !n.featured);
    return [...featured, ...rest].slice(0, 5);
  }, [allNews]);
  const visibleCategories = industryCounts;

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
    <div ref={contentAreaRef} className="main-content-area fade-in-effect" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className={`home-hero${isHeaderCompact ? ' is-compact' : ''}`}>
        <div className="home-hero-particles">
          {HERO_PARTICLES.map((p, i) => (
            <span
              key={i}
              className="home-hero-particle"
              style={{ left: `${p.left}%`, top: `${p.top}%`, width: `${p.size}px`, height: `${p.size}px`, animationDelay: `${p.delay}s` }}
            />
          ))}
        </div>
        <div className="home-hero-content">
          <h1 className="home-hero-title">Kết nối doanh nghiệp,<br />nắm bắt tin tức thị trường</h1>
          <div className="home-hero-fade">
            <p className="home-hero-subtitle">
              Tra cứu doanh nghiệp uy tín, cập nhật tin tức &amp; cơ hội tuyển dụng mới nhất — tất cả trong một nền tảng.
            </p>
            <div className="home-hero-actions">
              <button className="home-hero-cta" onClick={() => onGoToBusiness()}>
                Khám phá ngay <ArrowRight size={16} />
              </button>
              <div className="home-hero-search">
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0 }}>
                  <Search size={18} style={{ position: 'absolute', left: '14px', color: 'var(--text-dim)' }} />
                  <input
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onGoToBusiness(localSearch); }}
                    placeholder="Tìm doanh nghiệp, tin tức, ngành nghề, địa điểm..."
                    style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  onClick={() => onGoToBusiness(localSearch)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', color: 'white', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', flexShrink: 0 }}
                >
                  <Search size={16} /> Tìm kiếm
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <button
            onClick={() => setIndustryFilter(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px',
              border: `2px solid ${!industryFilter ? 'var(--color-primary)' : 'var(--border-neon)'}`,
              background: !industryFilter ? 'var(--bg-input)' : 'var(--bg-panel)', color: !industryFilter ? 'var(--color-primary)' : 'var(--text-main)',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
            }}
          >
            <Sparkles size={14} /> Tất cả
          </button>

          <div className="category-marquee" style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <div className="category-marquee-track" style={{ display: 'flex', gap: '8px', width: 'max-content' }}>
              {[0, 1].map((copy) => (
                <div key={copy} style={{ display: 'flex', gap: '8px', flexShrink: 0, paddingRight: '8px' }}>
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
                          background: active ? 'var(--bg-input)' : 'var(--bg-panel)', color: active ? 'var(--color-primary)' : 'var(--text-main)',
                          fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
                        }}
                      >
                        <Icon size={14} /> {ind}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

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
          {isFetchBusinessLoading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ ...CARD_STYLE, padding: '16px', pointerEvents: 'none', opacity: 0.7 }}>
              <div className="skeleton-line" style={{ width: '40px', height: '40px', marginBottom: '10px' }} />
              <div className="skeleton-line" style={{ width: '80%', height: '15px', marginBottom: '8px' }} />
              <div className="skeleton-line" style={{ width: '50%', height: '12px' }} />
            </div>
          ))}
          {!isFetchBusinessLoading && suggestedBusinesses.map((biz, idx) => (
            <ScrollReveal key={biz.id} delay={(idx % 10) * 40}>
            <div onClick={() => onOpenBusinessDetail(biz.id)} style={{ ...CARD_STYLE, padding: '16px' }}>
              <button
                onClick={(e) => toggleBookmark(biz.id, e)}
                style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: bookmarkedIds.has(biz.id) ? '#EC4899' : 'var(--text-dim)' }}
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
            </ScrollReveal>
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
          {isFetchNewsLoading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ ...CARD_STYLE, display: 'flex', gap: '12px', padding: '10px', pointerEvents: 'none', opacity: 0.7 }}>
              <div className="skeleton-line" style={{ width: '96px', height: '72px', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
                <div className="skeleton-line" style={{ width: '85%', height: '14px' }} />
                <div className="skeleton-line" style={{ width: '40%', height: '12px' }} />
              </div>
            </div>
          ))}
          {!isFetchNewsLoading && topNews.map((news, idx) => {
            const tag = newsTagStyle(news.chuyen_muc);
            return (
              <ScrollReveal key={news.id} delay={(idx % 10) * 40}>
              <div onClick={() => { setShowAllRelated(false); setSelectedNewsIndex(idx); }} style={{ ...CARD_STYLE, display: 'flex', gap: '12px', padding: '10px', alignItems: 'flex-start' }}>
                <div style={{ position: 'relative', width: '96px', height: '72px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: bookmarkedNewsIds.has(news.id) ? '#EC4899' : 'var(--text-dim)', flexShrink: 0, padding: '2px' }}
                >
                  <Heart size={17} fill={bookmarkedNewsIds.has(news.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
              </ScrollReveal>
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
                      border: '2px solid var(--border-neon)', background: 'var(--bg-panel)', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                      color: bookmarkedNewsIds.has(selectedNewsDetail.id) ? '#EC4899' : 'var(--text-main)'
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
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-panel)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                  >
                    Chia sẻ
                  </button>
                </div>
              </div>

              {selectedNewsDetail.tom_tat && (
                <div style={{ background: 'var(--bg-input)', borderLeft: '4px solid var(--color-primary)', borderRadius: '8px', padding: '14px 16px', marginBottom: '18px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>Tóm tắt</p>
                  <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.6, color: 'var(--text-main)' }}>{selectedNewsDetail.tom_tat}</p>
                </div>
              )}

              <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '18px', background: 'var(--bg-input)', minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                      <span key={tag} style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', background: 'var(--bg-input)', color: 'var(--text-dim)' }}>{tag}</span>
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
                        <div style={{ width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
