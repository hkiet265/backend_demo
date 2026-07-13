import { useState, useEffect } from 'react';
import { Flag, EyeOff, CheckCircle2, Building2 } from 'lucide-react';
import Toast from './Toast';
import Spinner from './atoms/Spinner';

const CARD_STYLE = { background: 'var(--bg-panel)', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '18px 20px', color: 'var(--text-main)' };

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function AdminJobReportsView() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/jobs/reports', { headers: authHeaders() });
      const data = await response.json();
      if (data.status === 'success') setReports(data.data);
    } catch (error) {
      setToast({ message: `Lỗi kết nối: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const handleResolve = async (reportId, hideJob) => {
    setProcessingId(reportId);
    try {
      const response = await fetch(`/api/jobs/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ hide_job: hideJob }),
      });
      if (response.ok) {
        setToast({ message: hideJob ? 'Đã ẩn tin và xử lý báo cáo' : 'Đã xử lý báo cáo', type: 'success' });
        setReports(prev => prev.filter(r => r.id !== reportId));
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
          <Flag size={22} /> Báo Cáo Tin Tuyển Dụng
        </h2>
        <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
          {reports.length} báo cáo đang chờ xử lý
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spinner /></div>
      ) : reports.length === 0 ? (
        <div style={{ ...CARD_STYLE, textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
          <CheckCircle2 size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
          <p>Không có báo cáo nào đang chờ xử lý.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {reports.map(report => (
            <div key={report.id} style={CARD_STYLE}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '10px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '15px' }}>{report.tieu_de}</h4>
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Building2 size={12} /> {report.ten_doanh_nghiep}</span>
                    <span>Báo cáo bởi: {report.reporter_email}</span>
                    {report.report_count > 1 && (
                      <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 700 }}>
                        {report.report_count} báo cáo
                      </span>
                    )}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleResolve(report.id, true)}
                    disabled={processingId === report.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <EyeOff size={14} /> Ẩn tin
                  </button>
                  <button
                    onClick={() => handleResolve(report.id, false)}
                    disabled={processingId === report.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <CheckCircle2 size={14} /> Bỏ qua
                  </button>
                </div>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '13px' }}>
                <strong>Lý do:</strong> {report.reason_label}
              </p>
              {report.details && <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: 'var(--text-dim)' }}>{report.details}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminJobReportsView;
