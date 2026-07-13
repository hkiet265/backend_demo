import { useState, useEffect } from 'react';
import { User, Upload, FileText, Save, Briefcase, Building2, MessageCircle, Sparkles, Wand2, Gauge } from 'lucide-react';
import Toast from './Toast';
import ChatThread from './ChatThread';

const CARD_STYLE = { background: 'var(--bg-panel)', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px', boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: '12.5px', color: 'var(--text-dim)', marginBottom: '6px', fontWeight: 600 };

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

const STATUS_LABEL = {
  Moi_nop: 'Mới nộp',
  Dang_xem_xet: 'Đang xem xét',
  Hen_phong_van: 'Hẹn phỏng vấn',
  Nhan_viec: 'Nhận việc',
  Tu_choi: 'Từ chối',
};

function CandidateProfileView({ currentUser }) {
  const [form, setForm] = useState({
    full_name: '', phone: '', headline: '', experience_summary: '',
    education_summary: '', skills: '', is_open_to_work: true,
  });
  const [cvFilePath, setCvFilePath] = useState(null);
  const [cvFile, setCvFile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [chatWith, setChatWith] = useState(null); // { jobId, title }
  const [suggestedJobs, setSuggestedJobs] = useState([]);
  const [suggestionMessage, setSuggestionMessage] = useState(null);
  const [parsedProfile, setParsedProfile] = useState(null);
  const [isSuggestingText, setIsSuggestingText] = useState(false);
  const [textSuggestion, setTextSuggestion] = useState(null);
  const [cvScore, setCvScore] = useState(null);
  const [isScoring, setIsScoring] = useState(false);

  const fetchSuggestedJobs = () => {
    fetch('/api/candidates/suggested-jobs', { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        setSuggestedJobs(data.data || []);
        setSuggestionMessage(data.message || null);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetch('/api/candidates/profile', { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        if (data.data) {
          setForm({
            full_name: data.data.full_name || '',
            phone: data.data.phone || '',
            headline: data.data.headline || '',
            experience_summary: data.data.experience_summary || '',
            education_summary: data.data.education_summary || '',
            skills: data.data.skills || '',
            is_open_to_work: data.data.is_open_to_work ?? true,
          });
          setCvFilePath(data.data.cv_file_path || null);
        }
      })
      .catch(() => {});

    fetch('/api/candidates/applications', { headers: authHeaders() })
      .then(r => r.json())
      .then(data => setApplications(data.data || []))
      .catch(() => {});

    fetchSuggestedJobs();
  }, []);

  const handleFieldChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/candidates/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        setToast({ message: 'Đã lưu hồ sơ', type: 'success' });
        fetchSuggestedJobs();
      } else {
        const err = await response.json();
        setToast({ message: err.detail || 'Lỗi khi lưu hồ sơ', type: 'error' });
      }
    } catch (error) {
      setToast({ message: `Lỗi kết nối: ${error.message}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadCv = async () => {
    if (!cvFile) return;
    const formData = new FormData();
    formData.append('file', cvFile);
    try {
      const response = await fetch('/api/candidates/profile/cv', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setCvFilePath(true);
        setToast({ message: 'Đã tải lên CV', type: 'success' });
        if (data.parsed_profile && Object.keys(data.parsed_profile).length > 0) {
          setParsedProfile(data.parsed_profile);
        }
      } else {
        setToast({ message: data.detail || 'Lỗi khi tải lên CV', type: 'error' });
      }
    } catch (error) {
      setToast({ message: `Lỗi kết nối: ${error.message}`, type: 'error' });
    }
  };

  const applyParsedProfile = () => {
    if (!parsedProfile) return;
    setForm(prev => ({
      ...prev,
      full_name: prev.full_name || parsedProfile.full_name || prev.full_name,
      phone: prev.phone || parsedProfile.phone || prev.phone,
      headline: prev.headline || parsedProfile.headline || prev.headline,
      skills: prev.skills || parsedProfile.skills || prev.skills,
      experience_summary: prev.experience_summary || parsedProfile.experience_summary || prev.experience_summary,
      education_summary: prev.education_summary || parsedProfile.education_summary || prev.education_summary,
    }));
    setParsedProfile(null);
    setToast({ message: 'Đã điền thông tin từ CV, kiểm tra lại và lưu hồ sơ nhé', type: 'success' });
  };

  const handleSuggestText = async (field) => {
    setIsSuggestingText(true);
    setTextSuggestion(null);
    try {
      const response = await fetch('/api/candidates/profile/suggest-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ field }),
      });
      const data = await response.json();
      if (response.ok) {
        setTextSuggestion(data.data.suggestion);
      } else {
        setToast({ message: data.detail || 'Không thể tạo gợi ý', type: 'error' });
      }
    } catch (error) {
      setToast({ message: `Lỗi kết nối: ${error.message}`, type: 'error' });
    } finally {
      setIsSuggestingText(false);
    }
  };

  const useSuggestion = () => {
    if (!textSuggestion) return;
    handleFieldChange('experience_summary', textSuggestion);
    setTextSuggestion(null);
  };

  const handleScoreCv = async () => {
    setIsScoring(true);
    try {
      const response = await fetch('/api/candidates/profile/cv-score', { headers: authHeaders() });
      const data = await response.json();
      if (response.ok) {
        setCvScore(data.data);
      } else {
        setToast({ message: data.detail || 'Không thể chấm điểm', type: 'error' });
      }
    } catch (error) {
      setToast({ message: `Lỗi kết nối: ${error.message}`, type: 'error' });
    } finally {
      setIsScoring(false);
    }
  };

  const handleViewCv = async () => {
    try {
      const response = await fetch('/api/candidates/profile/cv', { headers: authHeaders() });
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

  if (!currentUser) {
    return (
      <div className="main-content-area fade-in-effect" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
        <User size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
        <p>Vui lòng đăng nhập để quản lý hồ sơ ứng viên.</p>
      </div>
    );
  }

  return (
    <div className="main-content-area fade-in-effect" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
        <User size={22} /> Hồ Sơ Ứng Viên
      </h2>

      {parsedProfile && (
        <div style={{ ...CARD_STYLE, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', border: '2px solid var(--color-primary)' }}>
          <p style={{ margin: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wand2 size={16} color="var(--color-primary)" /> AI đã đọc CV và tìm thấy thông tin — điền vào các ô còn trống trong hồ sơ?
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={applyParsedProfile}
              style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '12.5px' }}
            >
              Áp dụng
            </button>
            <button
              onClick={() => setParsedProfile(null)}
              style={{ padding: '7px 14px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '12.5px' }}
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}

      <div style={{ ...CARD_STYLE, padding: '20px' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>CV của tôi</h3>
        <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--text-dim)' }}>
          Tải CV lên để AI tự động đọc và điền sẵn thông tin vào hồ sơ bên dưới — không cần gõ lại từ đầu.
        </p>
        {cvFilePath && (
          <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-dim)', marginBottom: '10px' }}>
            <FileText size={14} /> Đã có CV được tải lên
            <button
              onClick={handleViewCv}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)', marginLeft: '6px', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px' }}
            >
              Xem lại
            </button>
          </p>
        )}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setCvFile(e.target.files[0])} style={{ fontSize: '13px' }} />
          <button
            onClick={handleUploadCv}
            disabled={!cvFile}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', cursor: cvFile ? 'pointer' : 'not-allowed', opacity: cvFile ? 1 : 0.5 }}
          >
            <Upload size={14} /> Tải lên CV
          </button>
        </div>
      </div>

      <div style={{ ...CARD_STYLE, padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '15px' }}>Thông tin cơ bản</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.is_open_to_work}
              onChange={(e) => handleFieldChange('is_open_to_work', e.target.checked)}
            />
            Đang tìm việc
          </label>
        </div>

        <div className="form-grid-2col" style={{ marginBottom: '14px' }}>
          <div>
            <label style={labelStyle}>Họ và tên</label>
            <input style={inputStyle} value={form.full_name} onChange={(e) => handleFieldChange('full_name', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Số điện thoại</label>
            <input style={inputStyle} value={form.phone} onChange={(e) => handleFieldChange('phone', e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Vị trí mong muốn (headline)</label>
          <input style={inputStyle} value={form.headline} onChange={(e) => handleFieldChange('headline', e.target.value)} placeholder="VD: Backend Developer 2 năm kinh nghiệm" />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Kỹ năng (cách nhau bởi dấu phẩy)</label>
          <input style={inputStyle} value={form.skills} onChange={(e) => handleFieldChange('skills', e.target.value)} placeholder="Python, SQL, React..." />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Kinh nghiệm làm việc</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handleSuggestText('experience_summary')}
                disabled={isSuggestingText}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, cursor: isSuggestingText ? 'not-allowed' : 'pointer' }}
              >
                <Wand2 size={12} /> Gợi ý mô tả kinh nghiệm
              </button>
              <button
                onClick={() => handleSuggestText('objective')}
                disabled={isSuggestingText}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, cursor: isSuggestingText ? 'not-allowed' : 'pointer' }}
              >
                <Wand2 size={12} /> Gợi ý mục tiêu nghề nghiệp
              </button>
            </div>
          </div>
          <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} value={form.experience_summary} onChange={(e) => handleFieldChange('experience_summary', e.target.value)} />
          {isSuggestingText && <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>Đang tạo gợi ý...</p>}
          {textSuggestion && (
            <div style={{ marginTop: '8px', padding: '12px', borderRadius: '8px', border: '2px dashed var(--border-neon)', background: 'var(--bg-input)' }}>
              <p style={{ margin: '0 0 8px', fontSize: '12.5px', whiteSpace: 'pre-wrap' }}>{textSuggestion}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={useSuggestion}
                  style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: 'var(--color-primary)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '11.5px' }}
                >
                  Dùng gợi ý này
                </button>
                <button
                  onClick={() => setTextSuggestion(null)}
                  style={{ padding: '5px 12px', borderRadius: '6px', border: '2px solid var(--border-neon)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '11.5px' }}
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>Học vấn</label>
          <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={form.education_summary} onChange={(e) => handleFieldChange('education_summary', e.target.value)} />
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={isSaving}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'white', fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.6 : 1 }}
        >
          <Save size={15} /> {isSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
        </button>
      </div>

      <div style={{ ...CARD_STYLE, padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gauge size={16} color="var(--color-primary)" /> Chấm điểm hồ sơ bằng AI
          </h3>
          <button
            onClick={handleScoreCv}
            disabled={isScoring}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', cursor: isScoring ? 'not-allowed' : 'pointer', fontSize: '12.5px' }}
          >
            <Gauge size={13} /> {isScoring ? 'Đang chấm...' : 'Chấm điểm hồ sơ'}
          </button>
        </div>
        {cvScore && (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-primary)' }}>{cvScore.score}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>/ 100</span>
            </div>
            {cvScore.strengths?.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ fontSize: '13px' }}>Điểm mạnh</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {cvScore.strengths.map((s, i) => <li key={i} style={{ fontSize: '12.5px' }}>{s}</li>)}
                </ul>
              </div>
            )}
            {cvScore.weaknesses?.length > 0 && (
              <div>
                <strong style={{ fontSize: '13px', color: '#ef4444' }}>Cần cải thiện</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {cvScore.weaknesses.map((s, i) => <li key={i} style={{ fontSize: '12.5px' }}>{s}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ ...CARD_STYLE, padding: '20px' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="var(--color-primary)" /> Việc làm gợi ý cho bạn
        </h3>
        {suggestedJobs.length === 0 ? (
          <p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
            {suggestionMessage || 'Chưa có gợi ý nào.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {suggestedJobs.map(job => (
              <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', border: '2px solid var(--border-neon)' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {job.logo_url ? (
                    <img src={job.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <Briefcase size={18} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: '13.5px' }}>{job.tieu_de}</strong>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>
                    {job.ten_doanh_nghiep} {job.dia_diem ? `· ${job.dia_diem}` : ''}
                  </p>
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>
                  {Math.round((job.match_score || 0) * 100)}% phù hợp
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...CARD_STYLE, padding: '20px' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Briefcase size={16} /> Lịch sử ứng tuyển
        </h3>
        {applications.length === 0 ? (
          <p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Bạn chưa ứng tuyển vị trí nào.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {applications.map(app => (
              <div key={app.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', border: '2px solid var(--border-neon)', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <strong style={{ fontSize: '13.5px' }}>{app.tieu_de}</strong>
                  <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building2 size={12} /> {app.ten_doanh_nghiep}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => setChatWith({ jobId: app.job_id, title: app.ten_doanh_nghiep })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    <MessageCircle size={12} /> Nhắn tin
                  </button>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: 'var(--bg-input)', color: 'var(--color-primary)' }}>
                    {STATUS_LABEL[app.status] || app.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {chatWith && (
        <ChatThread
          jobId={chatWith.jobId}
          candidateUserId={currentUser.id}
          currentUserId={currentUser.id}
          title={chatWith.title}
          subtitle="Trò chuyện với nhà tuyển dụng"
          onClose={() => setChatWith(null)}
        />
      )}
    </div>
  );
}

export default CandidateProfileView;
