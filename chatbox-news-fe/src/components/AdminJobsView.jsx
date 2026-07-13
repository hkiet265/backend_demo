import { useState, useEffect } from 'react';
import { Briefcase, CheckCircle2, XCircle, Building2, MapPin } from 'lucide-react';
import Toast from './Toast';
import Spinner from './atoms/Spinner';

const CARD_STYLE = { background: 'var(--bg-panel)', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '18px 20px', color: 'var(--text-main)' };

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function AdminJobsView() {
  const [pendingJobs, setPendingJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/jobs/pending-review', { headers: authHeaders() });
      const data = await response.json();
      if (data.status === 'success') setPendingJobs(data.data);
    } catch (error) {
      setToast({ message: `Lỗi kết nối: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleModerate = async (jobId, approve) => {
    setProcessingId(jobId);
    try {
      const response = await fetch(`/api/jobs/${jobId}/moderate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ approve }),
      });
      if (response.ok) {
        setToast({ message: approve ? 'Đã duyệt tin' : 'Đã từ chối tin', type: 'success' });
        setPendingJobs(prev => prev.filter(j => j.id !== jobId));
      } else {
        const data = await response.json();
        setToast({ message: data.detail || 'Lỗi khi xử lý', type: 'error' });
      }
    } catch (error) {
      setToast({ message: `Lỗi kết nối: ${error.message}`, type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          <Briefcase size={22} /> Duyệt Tin Tuyển Dụng
        </h2>
        <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
          {pendingJobs.length} tin đang chờ duyệt
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spinner /></div>
      ) : pendingJobs.length === 0 ? (
        <div style={{ ...CARD_STYLE, textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
          <CheckCircle2 size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
          <p>Không có tin nào đang chờ duyệt.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pendingJobs.map(job => (
            <div key={job.id} style={CARD_STYLE}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '10px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '15px' }}>{job.tieu_de}</h4>
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Building2 size={12} /> {job.ten_doanh_nghiep}</span>
                    {job.dia_diem && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {job.dia_diem}</span>}
                    <span>Đăng bởi: {job.posted_by_email}</span>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleModerate(job.id, true)}
                    disabled={processingId === job.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <CheckCircle2 size={14} /> Duyệt
                  </button>
                  <button
                    onClick={() => handleModerate(job.id, false)}
                    disabled={processingId === job.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '2px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <XCircle size={14} /> Từ chối
                  </button>
                </div>
              </div>
              {job.mo_ta_cong_viec && <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-main)' }}>{job.mo_ta_cong_viec}</p>}
              {job.ky_nang && <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: 'var(--text-dim)' }}><strong>Yêu cầu:</strong> {job.ky_nang}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminJobsView;
