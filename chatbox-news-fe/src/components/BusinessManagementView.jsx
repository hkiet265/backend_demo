import { Search, Sparkles, BarChart3, X, RefreshCw, ChevronLeft, ChevronRight, Upload, Heart, Plus, Users, Briefcase, Newspaper, LayoutGrid, List, AlertTriangle, Star, Building2, SlidersHorizontal } from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast';

const PAGE_SIZE = 10;

// Real trust_score tops out at 60 today (no business has address/social
// filled in yet — see calculate_trust_score in ai_enrichment_service.py).
// Threshold is set to that baseline so "Tin cậy" isn't an impossible bar.
const TRUSTED_THRESHOLD = 60;

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

const EMPTY_CREATE_FORM = {
  ten_doanh_nghiep: '', nganh_nghe: '', vung_mien: '', tinh_thanh: '', dia_chi: '',
  so_dien_thoai: '', email: '', website: '', quy_mo: '', nhan_su: '', dang_tuyen: '', mo_ta: ''
};

function BusinessManagementView({
  searchQuery,
  setSearchQuery,
  regionFilter,
  setRegionFilter,
  handleClearSearch,
  allBusinesses,
  allNews,
  isLoading,
  isEnriching,
  handleSimulateRawInput,
  onRefresh,
  currentUser
}) {
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isEnrichingAll, setIsEnrichingAll] = useState(false);
  const [toast, setToast] = useState(null);
  const [bookmarkedBusinesses, setBookmarkedBusinesses] = useState(new Set());

  // New "Doanh nghiệp" dashboard controls
  const [activeTab, setActiveTab] = useState('all'); // all | following | news
  const [industryFilter, setIndustryFilter] = useState(null);
  const [quickFilter, setQuickFilter] = useState(null); // null | notable | hiring | risk
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createLogoFile, setCreateLogoFile] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Detect mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const pageSize = isMobile ? 6 : PAGE_SIZE;
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

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

  // Real (not fabricated) count of news whose title/summary mentions the
  // business name — powers the "Tin tức liên quan" figure per card & stat.
  const relatedNewsCountMap = useMemo(() => {
    const map = new Map();
    (allBusinesses || []).forEach((biz) => {
      const name = normalizeText(biz.name);
      if (!name) { map.set(biz.id, 0); return; }
      let count = 0;
      for (const news of (allNews || [])) {
        const haystack = normalizeText(news.tieu_de) + ' ' + normalizeText(news.tom_tat);
        if (haystack.includes(name)) count++;
      }
      map.set(biz.id, count);
    });
    return map;
  }, [allBusinesses, allNews]);

  const industryCounts = useMemo(() => {
    const map = new Map();
    (allBusinesses || []).forEach((biz) => {
      const key = (biz.industry || '').trim() || 'Khác';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [allBusinesses]);

  const stats = useMemo(() => {
    const total = allBusinesses.length;
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const nowTs = Date.now();
    const newCount = allBusinesses.filter(b => b.created_at && (nowTs - new Date(b.created_at).getTime()) <= THIRTY_DAYS_MS).length;
    const hiringSum = allBusinesses.reduce((sum, b) => sum + (b.dang_tuyen || 0), 0);
    const newsSum = allBusinesses.reduce((sum, b) => sum + (relatedNewsCountMap.get(b.id) || 0), 0);
    const riskCount = allBusinesses.filter(b => (b.trust_score ?? 100) < 50).length;
    return { total, newCount, hiringSum, newsSum, riskCount };
  }, [allBusinesses, relatedNewsCountMap]);

  const bookmarkedCount = bookmarkedBusinesses.size;

  // Tabs / sidebar quick filters / industry category all narrow the same
  // region+search filtered list — each stage is real data, no fabricated sorting.
  const filteredSorted = useMemo(() => {
    let list = businesses;

    if (activeTab === 'following') {
      list = list.filter(b => bookmarkedBusinesses.has(b.id));
    }

    if (industryFilter) {
      list = list.filter(b => (b.industry || 'Khác') === industryFilter);
    }

    if (quickFilter === 'notable') {
      list = list.filter(b => (b.trust_score ?? 0) >= TRUSTED_THRESHOLD);
    } else if (quickFilter === 'hiring') {
      list = list.filter(b => (b.dang_tuyen || 0) > 0).slice().sort((a, b) => (b.dang_tuyen || 0) - (a.dang_tuyen || 0));
    } else if (quickFilter === 'risk') {
      list = list.filter(b => (b.trust_score ?? 100) < 50);
    }

    return list;
  }, [businesses, activeTab, industryFilter, quickFilter, bookmarkedBusinesses, relatedNewsCountMap]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));

  const pagedBusinesses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, regionFilter, allBusinesses, activeTab, industryFilter, quickFilter]);

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

  const handleCreateFieldChange = (field, value) => {
    setCreateForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Vui lòng đăng nhập để thêm doanh nghiệp', 'error');
      return;
    }
    if (!createForm.ten_doanh_nghiep.trim()) {
      showToast('Vui lòng nhập tên doanh nghiệp', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const payload = {
        ...createForm,
        nhan_su: createForm.nhan_su === '' ? null : Number(createForm.nhan_su),
        dang_tuyen: createForm.dang_tuyen === '' ? null : Number(createForm.dang_tuyen),
      };

      const response = await fetch('/api/businesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Tạo doanh nghiệp thất bại');
      }

      const data = await response.json();

      if (createLogoFile && data.id) {
        try {
          const logoFormData = new FormData();
          logoFormData.append('file', createLogoFile);
          const logoRes = await fetch(`/api/businesses/${data.id}/upload-logo`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: logoFormData
          });
          if (!logoRes.ok) {
            const logoErr = await logoRes.json().catch(() => ({}));
            showToast(`⚠️ Đã tạo doanh nghiệp nhưng tải logo thất bại: ${logoErr.detail || ''}`, 'warning');
          }
        } catch (logoError) {
          showToast('⚠️ Đã tạo doanh nghiệp nhưng tải logo thất bại', 'warning');
        }
      }

      showToast('✅ Đã thêm doanh nghiệp mới', 'success');
      setShowCreateModal(false);
      setCreateForm(EMPTY_CREATE_FORM);
      setCreateLogoFile(null);
      setCurrentPage(1);
      onRefresh();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    } finally {
      setIsCreating(false);
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
              Tìm việc làm cùng Company
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

            <button
              onClick={() => setShowReportModal(true)}
              title="Báo cáo tổng quan"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: isMobile ? '0' : '10px 20px', width: isMobile ? '42px' : 'auto', height: '42px', background: '#F8FAFC',
                border: '2px solid var(--border-neon)', borderRadius: '10px',
                color: 'var(--color-secondary)', fontSize: '14px', fontWeight: '600',
                cursor: 'pointer', flexShrink: 0
              }}
            >
              <BarChart3 size={18} />
              {!isMobile && <span>Báo cáo tổng quan</span>}
            </button>

            {currentUser && (
              <button
                onClick={() => setShowCreateModal(true)}
                title="Thêm doanh nghiệp"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: isMobile ? '0' : '10px 20px', width: isMobile ? '42px' : 'auto', height: '42px',
                  background: 'linear-gradient(135deg, #3B0199, #2A0177)',
                  border: 'none', borderRadius: '10px', color: '#fff',
                  fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(215, 30, 40, 0.3)', flexShrink: 0
                }}
              >
                <Plus size={18} />
                {!isMobile && <span>Thêm doanh nghiệp</span>}
              </button>
            )}

            {currentUser && (
              <>
                <button
                  title="Xuất CSV"
                  onClick={handleExportCSV}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: isMobile ? '0' : '10px 20px',
                    width: isMobile ? '42px' : 'auto',
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
                    e.currentTarget.style.background = 'linear-gradient(135deg, #3B0199, #2A0177)';
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
                  {!isMobile && <span>Xuất</span>}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Real (computed from allBusinesses/allNews) overview stats — no % vs last month since there's no history to compute it from. Hidden on mobile to keep the page compact. */}
        {!isMobile && (
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}
        >
          {[
            { icon: <Building2 size={20} />, color: '#3B0199', bg: 'rgba(215,30,40,0.1)', label: 'Tổng doanh nghiệp', value: stats.total },
            { icon: <Users size={20} />, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', label: 'Doanh nghiệp mới (30 ngày)', value: stats.newCount },
            { icon: <Briefcase size={20} />, color: '#22C55E', bg: 'rgba(34,197,94,0.1)', label: 'Đang tuyển dụng', value: stats.hiringSum },
            { icon: <Newspaper size={20} />, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', label: 'Tin tức liên quan', value: stats.newsSum },
            { icon: <AlertTriangle size={20} />, color: '#CA8A04', bg: 'rgba(234,179,8,0.12)', label: 'Cảnh báo (độ tin cậy thấp)', value: stats.riskCount },
          ].map((card) => (
            <div key={card.label} style={{ background: 'white', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '16px 18px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                {card.icon}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800 }}>{card.value}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>{card.label}</div>
            </div>
          ))}
        </div>
        )}

        {isMobile && (
          <button
            onClick={() => setShowMobileSidebar(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%',
              padding: '10px', marginBottom: '14px', borderRadius: '10px',
              border: `2px solid ${showMobileSidebar ? 'var(--color-primary)' : 'var(--border-neon)'}`,
              background: showMobileSidebar ? '#FEF2F2' : 'white', color: showMobileSidebar ? 'var(--color-primary)' : 'var(--text-main)',
              fontSize: '13.5px', fontWeight: 700, cursor: 'pointer'
            }}
          >
            <SlidersHorizontal size={16} /> {showMobileSidebar ? 'Ẩn danh mục & bộ lọc' : 'Danh mục & bộ lọc'}
          </button>
        )}

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px', alignItems: isMobile ? 'stretch' : 'flex-start' }}>
          {(!isMobile || showMobileSidebar) && (
          <aside style={{
            width: isMobile ? '100%' : '220px', flexShrink: 0, boxSizing: 'border-box',
            ...(isMobile ? { background: 'white', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '16px' } : {})
          }}>
            <button
              onClick={() => { setActiveTab('all'); setIndustryFilter(null); setQuickFilter(null); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left',
                padding: '10px 14px', marginBottom: '16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: (!industryFilter && !quickFilter && activeTab === 'all') ? '#FEF2F2' : 'transparent',
                color: (!industryFilter && !quickFilter && activeTab === 'all') ? 'var(--color-primary)' : 'var(--text-main)',
                fontWeight: 700, fontSize: '14px'
              }}
            >
              <LayoutGrid size={16} /> Tổng quan
            </button>

            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.5px', margin: '0 0 8px 4px' }}>DANH MỤC</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '20px' }}>
              {industryCounts.slice(0, 8).map(([industry, count]) => (
                <button
                  key={industry}
                  onClick={() => setIndustryFilter(industryFilter === industry ? null : industry)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: industryFilter === industry ? '#FEF2F2' : 'transparent',
                    color: industryFilter === industry ? 'var(--color-primary)' : 'var(--text-main)',
                    fontSize: '13px', fontWeight: 600, textAlign: 'left'
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{industry}</span>
                  <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>{count}</span>
                </button>
              ))}
            </div>

            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.5px', margin: '0 0 8px 4px' }}>BỘ LỌC NHANH</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {[
                { key: 'notable', icon: <Star size={15} />, label: 'Doanh nghiệp nổi bật' },
                { key: 'hiring', icon: <Briefcase size={15} />, label: 'Tuyển dụng nhiều' },
                { key: 'risk', icon: <AlertTriangle size={15} />, label: 'Rủi ro cao' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setQuickFilter(quickFilter === f.key ? null : f.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                    borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: quickFilter === f.key ? '#FEF2F2' : 'transparent',
                    color: quickFilter === f.key ? 'var(--color-primary)' : 'var(--text-main)',
                    fontSize: '13px', fontWeight: 600
                  }}
                >
                  {f.icon} {f.label}
                </button>
              ))}
            </div>
          </aside>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: `Tất cả (${allBusinesses.length})` },
                { key: 'following', label: `Tôi theo dõi (${bookmarkedCount})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  className={`category-filter-btn ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="news-filters">
              <div className="search-box">
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên, ngành nghề, địa chỉ, mô tả..."
                    className="search-input"
                    style={{ width: '100%' }}
                  />
                  {searchQuery && (
                    <button className="clear-search" onClick={handleClearSearch} style={{ position: 'absolute', right: '12px' }}>✕</button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div className="category-filters" style={{ margin: 0 }}>
                  {['all', 'Bac', 'Trung', 'Nam'].map(r => (
                    <button
                      key={r}
                      className={`category-filter-btn ${regionFilter === r ? 'active' : ''}`}
                      onClick={() => setRegionFilter(r)}
                    >
                      {r === 'all' ? 'Tất cả' : r === 'Bac' ? ' Miền Bắc' : r === 'Trung' ? ' Miền Trung' : 'Miền Nam'}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button
                    onClick={() => setViewMode('grid')}
                    title="Dạng lưới"
                    style={{
                      width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid var(--border-neon)', borderRadius: '8px', cursor: 'pointer',
                      background: viewMode === 'grid' ? 'var(--color-primary)' : 'white',
                      color: viewMode === 'grid' ? 'white' : 'var(--text-dim)'
                    }}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    title="Dạng danh sách"
                    style={{
                      width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid var(--border-neon)', borderRadius: '8px', cursor: 'pointer',
                      background: viewMode === 'list' ? 'var(--color-primary)' : 'white',
                      color: viewMode === 'list' ? 'white' : 'var(--text-dim)'
                    }}
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>
            </div>

        {isLoading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Company đang tìm kiếm doanh nghiệp cho bạn...</p>
          </div>
        ) : filteredSorted.length === 0 ? (
          <div className="empty-state">
            <p>{searchQuery ? `Không tìm thấy doanh nghiệp nào khớp với "${searchQuery}"` : 'Company không tìm thấy doanh nghiêp nào cả'}</p>
          </div>
        ) : (
          <>
            <div className="biz-card-grid" style={viewMode === 'list' ? { gridTemplateColumns: '1fr' } : undefined}>
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
                    {biz.logo_url ? (
                      <img src={biz.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                      getBizIcon(biz.name, biz.description)
                    )}
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
                      {biz.trust_score >= TRUSTED_THRESHOLD && (
                        <span className="biz-tag biz-tag-trusted">✓ Tin cậy</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '14px', marginTop: '8px', fontSize: '11.5px', color: 'var(--text-dim)' }}>
                      <span title="Nhân sự" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={13} /> {biz.nhan_su ?? '—'}
                      </span>
                      <span title="Đang tuyển dụng" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Briefcase size={13} /> {biz.dang_tuyen ?? 0}
                      </span>
                      <span title="Tin tức liên quan" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Newspaper size={13} /> {relatedNewsCountMap.get(biz.id) || 0}
                      </span>
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
        </div>
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
                <span className={`biz-tag ${selectedBusiness.trust_score >= TRUSTED_THRESHOLD ? 'biz-tag-trusted' : 'biz-tag-muted'}`}>
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

      {showCreateModal && createPortal(
        <div className="modal-overlay" onClick={() => { setShowCreateModal(false); setCreateLogoFile(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setShowCreateModal(false); setCreateLogoFile(null); }}><X size={20} /></button>
            <h2 className="modal-title">Thêm doanh nghiệp</h2>

            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label>Tên doanh nghiệp *</label>
                <input className="form-input" value={createForm.ten_doanh_nghiep}
                  onChange={(e) => handleCreateFieldChange('ten_doanh_nghiep', e.target.value)} required />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '12px', background: '#F8FAFC',
                  border: '2px solid var(--border-neon)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                }}>
                  {createLogoFile ? (
                    <img src={URL.createObjectURL(createLogoFile)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <Building2 size={24} color="var(--text-dim)" />
                  )}
                </div>
                <div>
                  <label>Logo doanh nghiệp (tùy chọn)</label>
                  <div style={{ marginTop: '6px' }}>
                    <label className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', padding: '8px 16px' }}>
                      {createLogoFile ? 'Đổi ảnh khác' : 'Chọn ảnh'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={(e) => setCreateLogoFile(e.target.files?.[0] || null)}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: 'var(--text-dim)' }}>PNG, JPG, WEBP hoặc SVG, tối đa 5MB</p>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ngành nghề</label>
                  <input className="form-input" value={createForm.nganh_nghe}
                    onChange={(e) => handleCreateFieldChange('nganh_nghe', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Quy mô</label>
                  <input className="form-input" value={createForm.quy_mo}
                    onChange={(e) => handleCreateFieldChange('quy_mo', e.target.value)} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Vùng miền</label>
                  <input className="form-input" value={createForm.vung_mien} placeholder="Bắc / Trung / Nam"
                    onChange={(e) => handleCreateFieldChange('vung_mien', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Tỉnh/Thành</label>
                  <input className="form-input" value={createForm.tinh_thanh}
                    onChange={(e) => handleCreateFieldChange('tinh_thanh', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>Địa chỉ</label>
                <input className="form-input" value={createForm.dia_chi}
                  onChange={(e) => handleCreateFieldChange('dia_chi', e.target.value)} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Số điện thoại</label>
                  <input className="form-input" value={createForm.so_dien_thoai}
                    onChange={(e) => handleCreateFieldChange('so_dien_thoai', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input className="form-input" type="email" value={createForm.email}
                    onChange={(e) => handleCreateFieldChange('email', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>Website</label>
                <input className="form-input" value={createForm.website}
                  onChange={(e) => handleCreateFieldChange('website', e.target.value)} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Nhân sự</label>
                  <input className="form-input" type="number" min="0" value={createForm.nhan_su}
                    onChange={(e) => handleCreateFieldChange('nhan_su', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Đang tuyển dụng</label>
                  <input className="form-input" type="number" min="0" value={createForm.dang_tuyen}
                    onChange={(e) => handleCreateFieldChange('dang_tuyen', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>Mô tả</label>
                <textarea className="form-textarea" value={createForm.mo_ta}
                  onChange={(e) => handleCreateFieldChange('mo_ta', e.target.value)} />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowCreateModal(false); setCreateLogoFile(null); }}>Hủy</button>
                <button type="submit" className="btn-primary" disabled={isCreating}>
                  {isCreating ? 'Đang lưu...' : 'Thêm doanh nghiệp'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showReportModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowReportModal(false)}><X size={20} /></button>
            <h2 className="modal-title">Báo cáo tổng quan doanh nghiệp</h2>
            <div className="business-info-grid">
              <div className="business-info-item"><strong>🏢 Tổng doanh nghiệp:</strong><span>{stats.total}</span></div>
              <div className="business-info-item"><strong>🆕 Doanh nghiệp mới (30 ngày):</strong><span>{stats.newCount}</span></div>
              <div className="business-info-item"><strong>💼 Tổng vị trí đang tuyển:</strong><span>{stats.hiringSum}</span></div>
              <div className="business-info-item"><strong>📰 Tổng tin tức liên quan:</strong><span>{stats.newsSum}</span></div>
              <div className="business-info-item"><strong>⚠️ Doanh nghiệp cảnh báo (độ tin cậy &lt; 50):</strong><span>{stats.riskCount}</span></div>
            </div>
            <div className="modal-detail">
              <h4>📊 Top ngành nghề theo số lượng</h4>
              <p>
                {industryCounts.slice(0, 5).map(([industry, count]) => `${industry} (${count})`).join(' · ') || 'Chưa có dữ liệu'}
              </p>
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
