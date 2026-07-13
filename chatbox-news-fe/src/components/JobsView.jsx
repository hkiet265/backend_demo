import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Briefcase, MapPin, ExternalLink, RefreshCw, ChevronLeft, ChevronRight, Building2, Heart, Send, Flag, Info, Clock, Calendar, GraduationCap } from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import Toast from './Toast';

const PAGE_SIZE = 12;

const REPORT_REASONS = [
  { value: 'Lua_dao', label: 'Lừa đảo' },
  { value: 'Da_cap', label: 'Đa cấp' },
  { value: 'Sai_su_that', label: 'Sai sự thật' },
  { value: 'Quay_roi', label: 'Quấy rối' },
  { value: 'Khac', label: 'Khác' },
];

const EMPLOYMENT_TYPE_LABELS = {
  FULL_TIME: 'Toàn thời gian',
  PART_TIME: 'Bán thời gian',
  CONTRACTOR: 'Hợp đồng',
  TEMPORARY: 'Tạm thời',
  INTERN: 'Thực tập',
  VOLUNTEER: 'Tình nguyện',
  PER_DIEM: 'Theo ngày',
  OTHER: 'Khác',
};

function formatExperience(months) {
  if (!months && months !== 0) return null;
  if (months < 12) return `${months} tháng kinh nghiệm`;
  const years = Math.round(months / 12);
  return `${years}+ năm kinh nghiệm`;
}

function formatDate(isoDate) {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleDateString('vi-VN');
}

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function JobCardSkeleton() {
  return (
    <div className="biz-card skeleton-card">
      <div className="skeleton-line" style={{ width: '48px', height: '48px', borderRadius: '8px' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="skeleton-line" style={{ width: '70%', height: '16px' }} />
        <div className="skeleton-line" style={{ width: '40%', height: '13px' }} />
      </div>
    </div>
  );
}

function JobsView({ onOpenBusinessDetail, currentUser, onShowAuth, pendingJobDetail, onConsumePendingJobDetail }) {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedJob, setSelectedJob] = useState(null);
  const [savedJobIds, setSavedJobIds] = useState(new Set());
  const [appliedJobIds, setAppliedJobIds] = useState(new Set());
  const [coverLetter, setCoverLetter] = useState('');
  const [applyCvFile, setApplyCvFile] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [toast, setToast] = useState(null);
  const [reportingJob, setReportingJob] = useState(null);
  const [reportReason, setReportReason] = useState('Lua_dao');
  const [reportDetails, setReportDetails] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  const fetchJobs = useCallback(async (targetPage, searchTerm) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: targetPage, page_size: PAGE_SIZE });
      if (searchTerm) params.set('search', searchTerm);
      const response = await fetch(`/api/jobs?${params.toString()}`);
      const data = await response.json();
      setJobs(data.data || []);
      setTotalPages(data.total_pages || 0);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Fetch jobs failed:', error);
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs(page, search);
  }, [page, search, fetchJobs]);

  // One-shot handoff from BusinessDetailView — opening a job from that
  // modal switches to this tab and hands the job object here so it opens
  // in the same detail modal a click from this view's own list would.
  useEffect(() => {
    if (pendingJobDetail) {
      setSelectedJob(pendingJobDetail);
      onConsumePendingJobDetail?.();
    }
  }, [pendingJobDetail, onConsumePendingJobDetail]);

  // Lock background scroll while either modal is open — the modal itself
  // is portalled to document.body (see render below) precisely so it can
  // escape .dynamic-workspace-layout's stacking context and sit above the
  // fixed navbar, but that alone doesn't stop wheel/touch scroll from
  // still reaching the page underneath.
  useEffect(() => {
    if (selectedJob || reportingJob) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = previousOverflow; };
    }
  }, [selectedJob, reportingJob]);

  useEffect(() => {
    if (!currentUser) { setSavedJobIds(new Set()); setAppliedJobIds(new Set()); return; }
    fetch('/api/candidates/saved-jobs', { headers: authHeaders() })
      .then(r => r.json())
      .then(data => setSavedJobIds(new Set((data.data || []).map(j => j.id))))
      .catch(() => {});
    fetch('/api/candidates/applications', { headers: authHeaders() })
      .then(r => r.json())
      .then(data => setAppliedJobIds(new Set((data.data || []).map(a => a.job_id))))
      .catch(() => {});
  }, [currentUser]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const requireAuth = () => {
    if (!currentUser) {
      onShowAuth?.('login');
      return false;
    }
    return true;
  };

  const toggleSaveJob = async (job, e) => {
    e.stopPropagation();
    if (!requireAuth()) return;
    const isSaved = savedJobIds.has(job.id);
    try {
      const response = await fetch(`/api/candidates/jobs/${job.id}/save`, {
        method: isSaved ? 'DELETE' : 'POST',
        headers: authHeaders(),
      });
      if (response.ok) {
        setSavedJobIds(prev => {
          const next = new Set(prev);
          isSaved ? next.delete(job.id) : next.add(job.id);
          return next;
        });
      }
    } catch (error) {
      setToast({ message: `Lỗi kết nối: ${error.message}`, type: 'error' });
    }
  };

  const openApplyFlow = (job) => {
    if (!requireAuth()) return;
    setCoverLetter('');
    setApplyCvFile(null);
    setSelectedJob({ ...job, __applying: true });
  };

  const submitApplication = async () => {
    if (!selectedJob) return;
    setIsApplying(true);
    try {
      const formData = new FormData();
      if (coverLetter) formData.append('cover_letter', coverLetter);
      if (applyCvFile) formData.append('cv', applyCvFile);
      const response = await fetch(`/api/candidates/jobs/${selectedJob.id}/apply`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setAppliedJobIds(prev => new Set(prev).add(selectedJob.id));
        setToast({ message: 'Đã nộp đơn ứng tuyển!', type: 'success' });
        setSelectedJob(null);
      } else {
        setToast({ message: data.detail || 'Không thể nộp đơn', type: 'error' });
      }
    } catch (error) {
      setToast({ message: `Lỗi kết nối: ${error.message}`, type: 'error' });
    } finally {
      setIsApplying(false);
    }
  };

  const openReportFlow = (job) => {
    if (!requireAuth()) return;
    setReportReason('Lua_dao');
    setReportDetails('');
    setReportingJob(job);
  };

  const submitReport = async () => {
    if (!reportingJob) return;
    setIsReporting(true);
    try {
      const response = await fetch(`/api/jobs/${reportingJob.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reason: reportReason, details: reportDetails || null }),
      });
      const data = await response.json();
      if (response.ok) {
        setToast({ message: data.message || 'Đã gửi báo cáo', type: 'success' });
        setReportingJob(null);
      } else {
        setToast({ message: data.detail || 'Không thể gửi báo cáo', type: 'error' });
      }
    } catch (error) {
      setToast({ message: `Lỗi kết nối: ${error.message}`, type: 'error' });
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <div className="main-content-area fade-in-effect" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Briefcase size={22} /> Việc Làm
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-dim)', fontSize: '13.5px' }}>
            {total > 0 ? `${total} vị trí đang tuyển thật, cập nhật từ ITviec` : 'Danh sách vị trí đang tuyển'}
          </p>
        </div>
        <button
          className="refresh-btn-text"
          onClick={() => fetchJobs(page, search)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-panel)', color: 'var(--text-main)', cursor: 'pointer' }}
        >
          <RefreshCw size={15} className="refresh-btn-text-icon" /> Làm mới
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} className="search-box" style={{ position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Tìm theo tên vị trí hoặc tên công ty..."
          style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '14px', boxSizing: 'border-box', background: 'var(--bg-panel)', color: 'var(--text-main)' }}
        />
      </form>

      {isLoading ? (
        <div className="biz-card-grid">
          {Array.from({ length: 6 }, (_, i) => <JobCardSkeleton key={i} />)}
        </div>
      ) : jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
          <Briefcase size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
          <p>{search ? 'Không tìm thấy vị trí phù hợp.' : 'Chưa có tin tuyển dụng nào.'}</p>
        </div>
      ) : (
        <div className="biz-card-grid">
          {jobs.map((job, idx) => (
            <ScrollReveal key={job.id} delay={(idx % 10) * 40}>
              <div className="biz-card" onClick={() => setSelectedJob(job)} style={{ position: 'relative' }}>
                <button
                  className={`bookmark-heart-btn ${savedJobIds.has(job.id) ? 'bookmarked' : ''}`}
                  onClick={(e) => toggleSaveJob(job, e)}
                  title={savedJobIds.has(job.id) ? 'Bỏ lưu' : 'Lưu việc làm'}
                >
                  <Heart size={16} fill={savedJobIds.has(job.id) ? 'currentColor' : 'none'} />
                </button>
                <div className="biz-card-icon">
                  {job.logo_url ? (
                    <img src={job.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <Briefcase size={22} />
                  )}
                </div>
                <div className="biz-card-body">
                  <h4 className="biz-card-name">{job.title}</h4>
                  <p className="biz-card-location">
                    <Building2 size={13} style={{ verticalAlign: '-2px' }} /> {job.company_name}
                  </p>
                  <div className="biz-card-tags">
                    {job.industry && <span className="biz-tag biz-tag-scale">{job.industry}</span>}
                    {job.location && (
                      <span className="biz-tag">
                        <MapPin size={11} style={{ verticalAlign: '-1px' }} /> {job.location}
                      </span>
                    )}
                    {appliedJobIds.has(job.id) && <span className="biz-tag biz-tag-trusted">✓ Đã ứng tuyển</span>}
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '8px' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 14px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-panel)', color: 'var(--text-main)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}
          >
            <ChevronLeft size={15} /> Trước
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Trang {page}/{totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 14px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-panel)', color: 'var(--text-main)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}
          >
            Sau <ChevronRight size={15} />
          </button>
        </div>
      )}

      {selectedJob && createPortal(
        <div className="modal-overlay" style={{ zIndex: 10050 }} onClick={() => setSelectedJob(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '560px', width: '92%', maxHeight: '85vh', overflowY: 'auto', background: 'var(--bg-panel)', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 4px' }}>{selectedJob.title}</h3>
            <p
              style={{ margin: '0 0 16px', color: 'var(--color-primary)', fontWeight: 600, cursor: selectedJob.business_id ? 'pointer' : 'default' }}
              onClick={() => selectedJob.business_id && onOpenBusinessDetail?.(selectedJob.business_id)}
            >
              <Building2 size={14} style={{ verticalAlign: '-2px' }} /> {selectedJob.company_name}
            </p>

            {selectedJob.__applying ? (
              <>
                {selectedJob.source !== 'Đăng trực tiếp' && (
                  <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', marginBottom: '16px', fontSize: '12.5px', color: 'var(--text-dim)' }}>
                    <Info size={14} style={{ flexShrink: 0, marginTop: '1px', color: '#eab308' }} />
                    <span>
                      Tin này được tổng hợp từ {selectedJob.source || 'nguồn bên ngoài'}, nhà tuyển dụng chưa đăng ký
                      tài khoản trên Company. Đơn của bạn sẽ được lưu lại trong hệ thống và chuyển giao ngay khi họ
                      tham gia — nếu cần phản hồi sớm, hãy ứng tuyển trực tiếp qua "Xem bài đăng gốc".
                    </span>
                  </div>
                )}

                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Thư xin việc (không bắt buộc)</label>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Vài dòng giới thiệu bản thân với nhà tuyển dụng..."
                  style={{ width: '100%', minHeight: '120px', padding: '10px 12px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px', boxSizing: 'border-box', resize: 'vertical', marginBottom: '16px' }}
                />

                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                  Đính kèm CV cho đơn này (không bắt buộc nếu hồ sơ đã có CV)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setApplyCvFile(e.target.files[0] || null)}
                    style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}
                  />
                  {applyCvFile && <span style={{ fontSize: '12px', color: 'var(--color-primary)' }}>{applyCvFile.name}</span>}
                </div>

                <button
                  onClick={submitApplication}
                  disabled={isApplying}
                  className="landing-cta-btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Send size={15} /> {isApplying ? 'Đang gửi...' : 'Gửi đơn ứng tuyển'}
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                  {selectedJob.location && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-dim)' }}>
                      <MapPin size={13} /> {selectedJob.location}
                    </span>
                  )}
                  {selectedJob.employment_type && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-dim)' }}>
                      <Clock size={13} /> {EMPLOYMENT_TYPE_LABELS[selectedJob.employment_type] || selectedJob.employment_type}
                    </span>
                  )}
                  {formatExperience(selectedJob.months_of_experience) && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-dim)' }}>
                      <GraduationCap size={13} /> {formatExperience(selectedJob.months_of_experience)}
                    </span>
                  )}
                  {selectedJob.deadline && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-dim)' }}>
                      <Calendar size={13} /> Hạn nộp: {formatDate(selectedJob.deadline)}
                    </span>
                  )}
                </div>

                {selectedJob.description && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '14px' }}>Mô tả công việc</h4>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-main)' }}>
                      {selectedJob.description}
                    </p>
                  </div>
                )}

                {selectedJob.skills && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '14px' }}>Yêu cầu công việc</h4>
                    <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedJob.skills.split(';').map(s => s.trim()).filter(Boolean).map((s, i) => (
                        <li key={i} style={{ fontSize: '13px', lineHeight: 1.5 }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedJob.benefits && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '14px' }}>Phúc lợi</h4>
                    <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedJob.benefits.split(';').map(s => s.trim()).filter(Boolean).map((s, i) => (
                        <li key={i} style={{ fontSize: '13px', lineHeight: 1.5 }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {appliedJobIds.has(selectedJob.id) ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-dim)', fontWeight: 600 }}>
                      ✓ Bạn đã ứng tuyển vị trí này
                    </span>
                  ) : (
                    <button
                      onClick={() => openApplyFlow(selectedJob)}
                      className="landing-cta-btn-primary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Send size={15} /> Ứng tuyển ngay
                    </button>
                  )}
                  <a
                    href={selectedJob.url}
                    target="_blank"
                    rel="noreferrer"
                    className="landing-cta-btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                  >
                    Xem bài đăng gốc <ExternalLink size={15} />
                  </a>
                  <button
                    onClick={() => openReportFlow(selectedJob)}
                    title="Báo cáo tin tuyển dụng này"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '13px' }}
                  >
                    <Flag size={14} /> Báo cáo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {reportingJob && createPortal(
        <div className="modal-overlay" style={{ zIndex: 10050 }} onClick={() => setReportingJob(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '440px', width: '92%', background: 'var(--bg-panel)', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flag size={17} /> Báo cáo tin tuyển dụng
            </h3>
            <p style={{ margin: '0 0 16px', color: 'var(--text-dim)', fontSize: '13px' }}>{reportingJob.title} — {reportingJob.company_name}</p>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Lý do</label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px', marginBottom: '14px', boxSizing: 'border-box' }}
            >
              {REPORT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Chi tiết (không bắt buộc)</label>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Mô tả thêm về vấn đề bạn gặp phải..."
              style={{ width: '100%', minHeight: '90px', padding: '10px 12px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px', boxSizing: 'border-box', resize: 'vertical', marginBottom: '18px' }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={submitReport}
                disabled={isReporting}
                className="landing-cta-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Flag size={15} /> {isReporting ? 'Đang gửi...' : 'Gửi báo cáo'}
              </button>
              <button
                onClick={() => setReportingJob(null)}
                className="landing-cta-btn-secondary"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default JobsView;
