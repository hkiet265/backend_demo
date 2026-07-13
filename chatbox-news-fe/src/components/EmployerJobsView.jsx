import { useState, useEffect } from 'react';
import { Briefcase, Plus, Users, Trash2, X, Save, MessageCircle } from 'lucide-react';
import Toast from './Toast';
import ChatThread from './ChatThread';

const CARD_STYLE = { background: 'var(--bg-panel)', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px', boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: '12.5px', color: 'var(--text-dim)', marginBottom: '6px', fontWeight: 600 };

const JOB_STATUS_BADGE = {
  Cho_duyet: { label: 'Chờ duyệt', color: '#f59e0b' },
  Da_duyet: { label: 'Đã duyệt', color: '#22c55e' },
  Tu_choi: { label: 'Bị từ chối', color: '#ef4444' },
  An: { label: 'Đã ẩn', color: '#94a3b8' },
};

const STATUS_OPTIONS = [
  { value: 'Moi_nop', label: 'Mới nộp' },
  { value: 'Dang_xem_xet', label: 'Đang xem xét' },
  { value: 'Hen_phong_van', label: 'Hẹn phỏng vấn' },
  { value: 'Nhan_viec', label: 'Nhận việc' },
  { value: 'Tu_choi', label: 'Từ chối' },
];

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

const EMPTY_JOB_FORM = { business_id: '', tieu_de: '', mo_ta_cong_viec: '', dia_diem: '', ky_nang: '', phuc_loi: '' };

function EmployerJobsView({ currentUser }) {
  const [myBusinesses, setMyBusinesses] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [jobForm, setJobForm] = useState(EMPTY_JOB_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [applicantsPanelJob, setApplicantsPanelJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [toast, setToast] = useState(null);
  const [chatWith, setChatWith] = useState(null); // { jobId, candidateUserId, name }

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [bizRes, jobsRes] = await Promise.all([
        fetch('/api/businesses/my-businesses?page=1&page_size=100', { headers: authHeaders() }),
        fetch('/api/jobs/mine', { headers: authHeaders() }),
      ]);
      const bizData = await bizRes.json();
      const jobsData = await jobsRes.json();
      setMyBusinesses(bizData.data || []);
      setMyJobs(jobsData.data || []);
    } catch (error) {
      console.error('Load employer data failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { if (currentUser) loadData(); }, [currentUser]);

  const handleCreateJob = async () => {
    if (!jobForm.business_id || !jobForm.tieu_de) {
      setToast({ message: 'Vui lòng chọn doanh nghiệp và nhập tiêu đề', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ...jobForm, business_id: Number(jobForm.business_id) }),
      });
      const data = await response.json();
      if (response.ok) {
        setToast({ message: data.message || 'Đã đăng tin, đang chờ admin duyệt', type: 'success' });
        setShowCreateForm(false);
        setJobForm(EMPTY_JOB_FORM);
        loadData();
      } else {
        setToast({ message: data.detail || 'Lỗi khi đăng tin', type: 'error' });
      }
    } catch (error) {
      setToast({ message: `Lỗi kết nối: ${error.message}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Xóa tin tuyển dụng này?')) return;
    try {
      const response = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE', headers: authHeaders() });
      if (response.ok) {
        setToast({ message: 'Đã xóa tin tuyển dụng', type: 'success' });
        loadData();
      }
    } catch (error) {
      setToast({ message: `Lỗi kết nối: ${error.message}`, type: 'error' });
    }
  };

  const openApplicantsPanel = async (job) => {
    setApplicantsPanelJob(job);
    try {
      const response = await fetch(`/api/jobs/${job.id}/applications`, { headers: authHeaders() });
      const data = await response.json();
      setApplicants(data.data || []);
    } catch (error) {
      setToast({ message: `Lỗi kết nối: ${error.message}`, type: 'error' });
    }
  };

  const handleViewApplicantCv = async (applicationId) => {
    try {
      const response = await fetch(`/api/jobs/${applicantsPanelJob.id}/applications/${applicationId}/cv`, { headers: authHeaders() });
      if (!response.ok) {
        setToast({ message: 'Không thể mở CV', type: 'error' });
        return;
      }
      const blob = await response.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (error) {
      setToast({ message: `Lỗi kết nối: ${error.message}`, type: 'error' });
    }
  };

  const updateApplicationStatus = async (applicationId, status) => {
    try {
      const response = await fetch(`/api/jobs/${applicantsPanelJob.id}/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        setApplicants(prev => prev.map(a => a.id === applicationId ? { ...a, status } : a));
      }
    } catch (error) {
      setToast({ message: `Lỗi kết nối: ${error.message}`, type: 'error' });
    }
  };

  if (!currentUser) {
    return (
      <div className="main-content-area fade-in-effect" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
        <Briefcase size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
        <p>Vui lòng đăng nhập để quản lý tin tuyển dụng.</p>
      </div>
    );
  }

  return (
    <div className="main-content-area fade-in-effect" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          <Briefcase size={22} /> Tin Tuyển Dụng Của Tôi
        </h2>
        <button
          onClick={() => setShowCreateForm(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'white', fontWeight: 700, cursor: 'pointer' }}
        >
          <Plus size={16} /> Đăng tin mới
        </button>
      </div>

      {myBusinesses.length === 0 && !isLoading && (
        <div style={{ ...CARD_STYLE, padding: '20px', color: 'var(--text-dim)', fontSize: '13.5px' }}>
          Bạn cần có ít nhất 1 doanh nghiệp (mục "DN Của Tôi") trước khi đăng tin tuyển dụng.
        </div>
      )}

      {isLoading ? (
        <p style={{ color: 'var(--text-dim)' }}>Đang tải...</p>
      ) : myJobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
          <Briefcase size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
          <p>Bạn chưa đăng tin tuyển dụng nào.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {myJobs.map(job => (
            <div key={job.id} style={{ ...CARD_STYLE, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px' }}>{job.tieu_de}</h4>
                  {JOB_STATUS_BADGE[job.trang_thai] && (
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                      color: JOB_STATUS_BADGE[job.trang_thai].color,
                      background: `${JOB_STATUS_BADGE[job.trang_thai].color}1a`,
                      border: `1px solid ${JOB_STATUS_BADGE[job.trang_thai].color}4d`,
                    }}>
                      {JOB_STATUS_BADGE[job.trang_thai].label}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-dim)' }}>{job.ten_doanh_nghiep} {job.dia_diem ? `· ${job.dia_diem}` : ''}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => openApplicantsPanel(job)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  <Users size={14} /> Ứng viên ({job.application_count})
                </button>
                <button
                  onClick={() => handleDeleteJob(job.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '8px', border: '2px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="modal-content" style={{ maxWidth: '520px', width: '92%', maxHeight: '85vh', overflowY: 'auto', background: 'var(--bg-panel)', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Đăng tin tuyển dụng mới</h3>
              <button onClick={() => setShowCreateForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}><X size={20} /></button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Doanh nghiệp</label>
              <select
                style={inputStyle}
                value={jobForm.business_id}
                onChange={(e) => setJobForm(prev => ({ ...prev, business_id: e.target.value }))}
              >
                <option value="">-- Chọn doanh nghiệp --</option>
                {myBusinesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Tiêu đề vị trí</label>
              <input style={inputStyle} value={jobForm.tieu_de} onChange={(e) => setJobForm(prev => ({ ...prev, tieu_de: e.target.value }))} placeholder="VD: Backend Developer" />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Địa điểm</label>
              <input style={inputStyle} value={jobForm.dia_diem} onChange={(e) => setJobForm(prev => ({ ...prev, dia_diem: e.target.value }))} placeholder="VD: Hà Nội" />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Mô tả công việc</label>
              <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={jobForm.mo_ta_cong_viec} onChange={(e) => setJobForm(prev => ({ ...prev, mo_ta_cong_viec: e.target.value }))} />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Yêu cầu công việc (cách nhau bởi dấu ;)</label>
              <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={jobForm.ky_nang} onChange={(e) => setJobForm(prev => ({ ...prev, ky_nang: e.target.value }))} placeholder="2 năm kinh nghiệm React; Biết SQL; ..." />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Phúc lợi (cách nhau bởi dấu ;)</label>
              <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={jobForm.phuc_loi} onChange={(e) => setJobForm(prev => ({ ...prev, phuc_loi: e.target.value }))} placeholder="Lương tháng 13; Bảo hiểm sức khỏe; ..." />
            </div>

            <button
              onClick={handleCreateJob}
              disabled={isSaving}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'white', fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.6 : 1 }}
            >
              <Save size={15} /> {isSaving ? 'Đang đăng...' : 'Đăng tin'}
            </button>
          </div>
        </div>
      )}

      {applicantsPanelJob && (
        <div className="modal-overlay" onClick={() => setApplicantsPanelJob(null)}>
          <div className="modal-content" style={{ maxWidth: '620px', width: '94%', maxHeight: '85vh', overflowY: 'auto', background: 'var(--bg-panel)', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Ứng viên — {applicantsPanelJob.tieu_de}</h3>
              <button onClick={() => setApplicantsPanelJob(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}><X size={20} /></button>
            </div>

            {applicants.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '13.5px' }}>Chưa có ứng viên nào nộp đơn.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {applicants.map(app => (
                  <div key={app.id} style={{ padding: '14px', borderRadius: '8px', border: '2px solid var(--border-neon)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <strong>{app.full_name || app.email}</strong>
                        {app.headline && <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-dim)' }}>{app.headline}</p>}
                      </div>
                      <select
                        value={app.status}
                        onChange={(e) => updateApplicationStatus(app.id, e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '12.5px' }}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: '12.5px' }}>📧 {app.email} {app.phone || app.user_phone ? `· 📞 ${app.phone || app.user_phone}` : ''}</p>
                    {app.skills && <p style={{ margin: '4px 0', fontSize: '12.5px', color: 'var(--text-dim)' }}>Kỹ năng: {app.skills}</p>}
                    {app.cover_letter && (
                      <p style={{ margin: '8px 0 0', fontSize: '13px', fontStyle: 'italic', color: 'var(--text-main)' }}>"{app.cover_letter}"</p>
                    )}
                    {app.cv_file_path && (
                      <button
                        onClick={() => handleViewApplicantCv(app.id)}
                        style={{ display: 'inline-block', marginTop: '8px', marginRight: '14px', fontSize: '12.5px', color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Xem CV
                      </button>
                    )}
                    <button
                      onClick={() => setChatWith({ jobId: applicantsPanelJob.id, candidateUserId: app.candidate_id, name: app.full_name || app.email })}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '12.5px', color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      <MessageCircle size={12} /> Nhắn tin
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {chatWith && (
        <ChatThread
          jobId={chatWith.jobId}
          candidateUserId={chatWith.candidateUserId}
          currentUserId={currentUser.id}
          title={chatWith.name}
          subtitle={applicantsPanelJob?.tieu_de}
          onClose={() => setChatWith(null)}
        />
      )}
    </div>
  );
}

export default EmployerJobsView;
