import { useState, useEffect, useRef } from 'react';
import {
  Building2, Briefcase, Newspaper, Search, ArrowRight, Bot,
  ShieldCheck, Users, MousePointerClick, MessageCircleHeart, Sparkles
} from 'lucide-react';
import ScrollReveal from './ScrollReveal';

// One row of a vertical "lights up as you scroll" timeline — only the item
// currently in view is lit (red); scroll past it and it dims again. Keeps
// observing continuously (unlike a one-shot reveal) so `active` tracks
// `isIntersecting` live instead of latching true forever.
function LitTimelineItem({ icon: Icon, onClick, children }) {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setActive(true); return; }

    // Each item spans much more than half the viewport (icon + heading +
    // desc + bullets + button), so a plain `threshold: 0.5` let 2-3 tall
    // neighboring items all read "≥50% visible" at once. Shrinking the
    // observed area to a thin band at vertical center (via rootMargin)
    // means only the item actually centered on screen counts as active —
    // a standard scrollspy trick.
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0, rootMargin: '-45% 0px -45% 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`landing-timeline-item${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <div className="landing-timeline-icon">
        <Icon size={24} />
      </div>
      <div className="landing-timeline-content">
        {children}
      </div>
    </div>
  );
}

// Fixed (not random-per-render) sparkle positions for the hero banner, so
// they don't jump around on every re-render.
const HERO_PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37 + 5) % 100,
  top: (i * 53 + 11) % 100,
  size: 2 + (i % 3),
  delay: (i % 7) * 0.6,
}));

// Past this many px of scroll, the navbar switches to its compact style
// and the hero subtitle/CTA hide.
const HEADER_COMPACT_THRESHOLD = 80;

// Kept within the site's own red/warm palette (var(--color-primary) and
// friends) instead of arbitrary blue/purple/pink — those clashed hard
// against a brand that's red end-to-end everywhere else on the site.
const FEATURES = [
  {
    icon: Briefcase,
    eyebrow: 'TUYỂN DỤNG', title: 'Tìm việc phù hợp, ứng tuyển ngay.',
    desc: 'Hàng trăm vị trí đang tuyển thật, cập nhật từ ITviec và nhà tuyển dụng tự đăng — lọc theo ngành nghề & khu vực chỉ trong vài giây.',
    bullets: ['Ứng tuyển trực tiếp kèm CV', 'Lưu việc làm để xem lại sau', 'Gợi ý việc làm bằng AI theo hồ sơ'],
    cta: 'Khám phá việc làm', action: 'jobs',
  },
  {
    icon: Sparkles,
    eyebrow: 'HỒ SƠ & CV AI', title: 'Chuẩn hóa CV, xây hồ sơ chuyên nghiệp.',
    desc: 'Tải CV lên là AI tự động điền hồ sơ, viết hộ mô tả kinh nghiệm và chấm điểm CV để tăng tỷ lệ đỗ.',
    bullets: ['Tự động bóc tách thông tin từ CV', 'AI viết mô tả kinh nghiệm & mục tiêu nghề nghiệp', 'Chấm điểm hồ sơ, chỉ rõ điểm cần sửa'],
    cta: 'Hoàn thiện hồ sơ', action: 'candidate-profile',
  },
  {
    icon: Newspaper,
    eyebrow: 'TIN TỨC NGHỀ NGHIỆP', title: 'Tin tức việc làm, cập nhật mỗi ngày.',
    desc: 'Cập nhật xu hướng tuyển dụng, mức lương, kỹ năng nghề nghiệp mỗi ngày, tổng hợp tự động từ các nguồn uy tín.',
    bullets: ['Tổng hợp tự động từ nhiều nguồn', 'Phân loại theo chuyên mục', 'Gợi ý tin liên quan thông minh'],
    cta: 'Xem tin tức', action: 'news',
  },
  {
    icon: Bot,
    eyebrow: 'TRỢ LÝ AI', title: 'Trợ lý AI Company, đồng hành tìm việc.',
    desc: 'Hỏi bất cứ điều gì về công ty, vị trí tuyển dụng hay tin tức nghề nghiệp — Company tìm giúp bạn ngay lập tức.',
    bullets: ['Trả lời tự nhiên, đúng ngữ cảnh', 'Ghi nhớ cuộc trò chuyện', 'Hướng dẫn thao tác trên web'],
    cta: 'Trò chuyện với Company', action: 'chat',
  },
];

const HOW_IT_WORKS = [
  { icon: Search, title: 'Tìm kiếm', desc: 'Nhập tên, ngành nghề hoặc khu vực bạn quan tâm.' },
  { icon: MousePointerClick, title: 'Xem chi tiết', desc: 'Xem thông tin đầy đủ, độ tin cậy và tin tức liên quan.' },
  { icon: MessageCircleHeart, title: 'Kết nối', desc: 'Lưu lại, liên hệ, hoặc hỏi thêm Company bất cứ lúc nào.' },
];

function HomeDashboardView({ currentUser, onOpenChatWithPrompt, onGoToBusiness, onGoToJobs, onGoToProfile, onGoToNews, onOpenBusinessDetail, onOpenJob, onShowAuth }) {
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const contentAreaRef = useRef(null);

  // NOT sliced from `allBusinesses` — that's the full crawled directory
  // (~997 rows), and only ~18 of those actually have a real job posting
  // linked (business_id). Featuring random directory entries sent users
  // into a business detail page with an empty "Vị trí đang tuyển (0)",
  // reading as fake/broken data. This fetch is restricted server-side to
  // businesses backing at least one real, approved job listing.
  const [featuredBusinesses, setFeaturedBusinesses] = useState([]);
  useEffect(() => {
    fetch('/api/businesses?only_with_jobs=true&page=1&page_size=5')
      .then(r => (r.ok ? r.json() : null))
      .then(data => setFeaturedBusinesses(data?.data || []))
      .catch(() => setFeaturedBusinesses([]));
  }, []);

  // "Tuyển gấp" = closing soonest, not just newest — sorted by han_nop
  // (deadline) ascending server-side, already excludes expired postings.
  const [urgentJobs, setUrgentJobs] = useState([]);
  useEffect(() => {
    fetch('/api/jobs?urgent=true&page=1&page_size=5')
      .then(r => (r.ok ? r.json() : null))
      .then(data => setUrgentJobs(data?.data || []))
      .catch(() => setUrgentJobs([]));
  }, []);

  const daysUntil = (isoDate) => {
    if (!isoDate) return null;
    const diffMs = new Date(isoDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
    return Math.max(0, Math.round(diffMs / 86400000));
  };

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
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handleFeatureClick = (action) => {
    if (action === 'jobs') onGoToJobs?.();
    else if (action === 'candidate-profile') {
      if (!currentUser) onShowAuth?.('login');
      else onGoToProfile?.();
    }
    else if (action === 'business') onGoToBusiness();
    else if (action === 'news') onGoToNews();
    else if (action === 'chat') onOpenChatWithPrompt('Xin chào, bạn có thể giúp gì cho tôi?');
  };

  return (
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
          <h1 className="home-hero-title">Tìm việc đúng hướng,<br />nắm bắt tin tức nghề nghiệp</h1>
          <div className="home-hero-fade">
            <p className="home-hero-subtitle">
              Khám phá nhà tuyển dụng uy tín, cập nhật tin tức &amp; cơ hội việc làm mới nhất — tất cả trong một nền tảng.
            </p>
            <div className="home-hero-actions">
              <button className="home-hero-cta" onClick={() => onGoToJobs?.()}>
                Khám phá việc làm <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feature showcase — vertical timeline, lights up as you scroll */}
      <div>
        <p className="landing-eyebrow">TÍNH NĂNG NỔI BẬT</p>
        <h2 style={{ textAlign: 'center', fontSize: '22px', fontWeight: 800, margin: '4px 0 4px' }}>Vì sao chọn Company?</h2>
        <p style={{ textAlign: 'center', fontSize: '13.5px', color: 'var(--text-dim)', margin: '0 0 32px' }}>
          Mọi thứ bạn cần để nắm bắt thông tin doanh nghiệp & thị trường, gói gọn trong một nền tảng.
        </p>
        <div className="landing-timeline landing-timeline-features">
          {FEATURES.map(f => (
            <LitTimelineItem key={f.title} icon={f.icon} onClick={() => handleFeatureClick(f.action)}>
              <p className="landing-feature-eyebrow">{f.eyebrow}</p>
              <h3 className="landing-feature-heading">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
              <ul className="landing-feature-bullets">
                {f.bullets.map(b => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <button
                onClick={(e) => { e.stopPropagation(); handleFeatureClick(f.action); }}
                className="landing-feature-btn"
              >
                {f.cta} <ArrowRight size={16} />
              </button>
            </LitTimelineItem>
          ))}
        </div>
      </div>

      {/* Featured showcase — one tab switches between newest businesses and
          top news; a big featured card on the left + a small-card grid on
          the right, bridging the feature timeline and the "how it works"
          section with real content instead of empty space. */}
      {/* Việc tuyển gấp — closing soonest first (han_nop ascending), not
          just newest, so it's a genuine urgency signal instead of another
          "recent" list duplicating the jobs tab. */}
      {urgentJobs.length > 0 && (
        <div style={{ margin: '8px 0' }}>
          <p className="landing-eyebrow">VIỆC LÀM HOT</p>
          <h2 style={{ textAlign: 'center', fontSize: '22px', fontWeight: 800, margin: '4px 0 20px' }}>Việc tuyển gấp</h2>
          <div className="landing-urgent-jobs-grid">
            {urgentJobs.map(job => {
              const days = daysUntil(job.deadline);
              return (
                <button key={job.id} className="landing-urgent-job-card" onClick={() => onOpenJob?.(job)}>
                  <div className="landing-business-card-logo">
                    {job.logo_url ? (
                      <img src={job.logo_url} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                      <Briefcase size={20} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="landing-showcase-small-title">{job.title}</p>
                    <p className="landing-news-meta">{job.company_name}{job.location ? ` · ${job.location}` : ''}</p>
                  </div>
                  {days !== null && (
                    <span className="landing-urgent-job-badge">
                      {days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Công ty nổi bật — only businesses backing a real approved job
          (see featuredBusinesses fetch above), never an empty directory
          entry with nothing to show once clicked into. */}
      {featuredBusinesses.length > 0 && (
        <div style={{ margin: '8px 0' }}>
          <p className="landing-eyebrow">NHÀ TUYỂN DỤNG</p>
          <h2 style={{ textAlign: 'center', fontSize: '22px', fontWeight: 800, margin: '4px 0 20px' }}>Công ty nổi bật</h2>
          <div className="landing-showcase-grid">
            {featuredBusinesses[0] && (
              <button className="landing-showcase-featured landing-business-card" onClick={() => onOpenBusinessDetail?.(featuredBusinesses[0].id)}>
                <div className="landing-business-card-logo">
                  {featuredBusinesses[0].logo_url ? (
                    <img src={featuredBusinesses[0].logo_url} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <Building2 size={30} />
                  )}
                </div>
                <h3>{featuredBusinesses[0].name}</h3>
                <p>{featuredBusinesses[0].industry || 'Doanh nghiệp'} · {featuredBusinesses[0].location || 'Việt Nam'}</p>
              </button>
            )}

            <div className="landing-showcase-side">
              {featuredBusinesses.slice(1).map(b => (
                <button key={b.id} className="landing-showcase-small landing-business-card-small" onClick={() => onOpenBusinessDetail?.(b.id)}>
                  <div className="landing-business-card-logo">
                    {b.logo_url ? (
                      <img src={b.logo_url} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                      <Building2 size={18} />
                    )}
                  </div>
                  <p className="landing-showcase-small-title">{b.name}</p>
                  <p className="landing-news-meta">{b.industry || 'Doanh nghiệp'} · {b.location || 'Việt Nam'}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* How it works — 3 simple horizontal step cards. Replaced the
          spinning hub-and-spoke orbit diagram (kept in git history if
          ever wanted back) — flat cards read faster and don't rely on
          the SVG/animation setup the orbit needed. */}
      <div className="landing-process-section" style={{ marginTop: '16px' }}>
        <p className="landing-eyebrow">QUY TRÌNH</p>
        <h2 style={{ textAlign: 'center', fontSize: '22px', fontWeight: 800, margin: '4px 0 4px' }}>Chỉ 3 bước đơn giản</h2>
        <p style={{ textAlign: 'center', fontSize: '13.5px', color: 'var(--text-dim)', margin: '0 0 28px' }}>
          Đã biết Company có gì hay rồi — giờ xem cách bắt đầu chỉ trong vài phút, không cần hướng dẫn phức tạp.
        </p>

        <div className="landing-steps-grid">
          {HOW_IT_WORKS.map((step, i) => (
            <ScrollReveal key={step.title} delay={i * 100}>
              <div className="landing-step-card">
                <div className="landing-step-icon">
                  <step.icon size={22} />
                  <span className="landing-step-badge">{i + 1}</span>
                </div>
                <h3 className="landing-step-title">{step.title}</h3>
                <p className="landing-step-desc">{step.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>

      {/* Closing CTA banner */}
      <div className="landing-cta-banner">
        <Users size={30} color="var(--color-primary)" className="landing-cta-icon" style={{ zIndex: 3 }} />
        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, position: 'relative', zIndex: 3 }}>Sẵn sàng tìm việc chưa?</h3>
        <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-dim)', maxWidth: '480px', position: 'relative', zIndex: 3 }}>
          Bắt đầu tìm việc, hoàn thiện hồ sơ với AI, hoặc để Company giúp bạn tìm đúng công việc cần tìm.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 3 }}>
          <button
            onClick={() => onGoToJobs?.()}
            className="landing-cta-btn-primary"
          >
            <Briefcase size={16} /> Khám phá việc làm
          </button>
          <button
            onClick={() => onOpenChatWithPrompt('Xin chào, bạn có thể giúp gì cho tôi?')}
            className="landing-cta-btn-secondary"
          >
            <ShieldCheck size={16} /> Hỏi Company ngay
          </button>
        </div>
      </div>
    </div>
  );
}

export default HomeDashboardView;
