import React, { useState, useEffect, useMemo } from 'react';
import { Flame, Zap, Clock, AlertCircle, Database, ShieldCheck, RefreshCw, Search, Download, Server, Bot, Cpu } from 'lucide-react';
import Spinner from './atoms/Spinner';

const CARD_STYLE = { background: 'white', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '18px 20px' };

function StatCard({ icon, color, bg, value, label, badge }) {
  return (
    <div style={CARD_STYLE}>
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>{icon}</div>
      <div style={{ fontSize: '22px', fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: badge ? '6px' : 0 }}>{label}</div>
      {badge && <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#16A34A' }}>{badge}</span>}
    </div>
  );
}

function ChartCard({ title, icon, children, action }) {
  return (
    <div style={{ ...CARD_STYLE, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>{icon} {title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

const DONUT_COLORS = ['#2563EB', '#06B6D4', '#7C3AED', '#F59E0B', '#EC4899', '#16A34A'];
function DonutChart({ data, centerLabel }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  let cum = 0;
  const segs = data.map((d, i) => {
    const pct = total ? (d.count / total) * 100 : 0;
    const seg = { ...d, pct, start: cum, end: cum + pct, color: DONUT_COLORS[i % DONUT_COLORS.length] };
    cum += pct;
    return seg;
  });
  const gradient = total ? `conic-gradient(${segs.map(s => `${s.color} ${s.start}% ${s.end}%`).join(', ')})` : 'conic-gradient(#F1F5F9 0% 100%)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
      <div style={{ width: '140px', height: '140px', borderRadius: '50%', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '16px', fontWeight: 800 }}>{total.toLocaleString()}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{centerLabel}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '160px' }}>
        {segs.map((s, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{s.label}</span>
            <span style={{ fontWeight: 700 }}>{s.count.toLocaleString()} ({s.pct.toFixed(1)}%)</span>
          </div>
        ))}
        {total === 0 && <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Chưa có dữ liệu trong khoảng thời gian này.</span>}
      </div>
    </div>
  );
}

function parseEndpoint(path) {
  const match = /^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/.exec(path || '');
  return match ? { method: match[1], route: match[2] } : { method: null, route: path || 'unknown' };
}

function parseSizeToBytes(sizeStr) {
  const match = /^([\d.]+)\s*(\w*)/.exec((sizeStr || '').trim());
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = (match[2] || '').toLowerCase();
  const mult = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[unit] || 1;
  return num * mult;
}

const WINDOW_OPTIONS = [
  { label: '24 giờ qua', hours: 24 },
  { label: '7 ngày qua', hours: 24 * 7 },
  { label: '30 ngày qua', hours: 24 * 30 },
];
const ROWS_PER_PAGE = 5;

const LogfireView = () => {
  const [monitoring, setMonitoring] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchMonitoring = async (h = hours) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/monitoring?hours=${h}`);
      const data = await response.json();
      if (data.status === 'success') setMonitoring(data.data);
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoring(hours);
    const interval = setInterval(() => fetchMonitoring(hours), 60000);
    return () => clearInterval(interval);
  }, [hours]);

  useEffect(() => { setPage(1); }, [search]);

  const exportData = () => {
    if (!monitoring) return;
    const lines = [
      ['Metric', 'Value'],
      ['Total Requests', monitoring.api_metrics.total_requests_today],
      ['Avg Response Time (ms)', monitoring.api_metrics.avg_response_time_ms],
      ['Error Rate (%)', (monitoring.api_metrics.error_rate * 100).toFixed(2)],
      ['Database Size', monitoring.database.size],
      [],
      ['Endpoint', 'Requests', 'Avg Time (ms)'],
      ...monitoring.api_metrics.endpoints.map(e => [e.path, e.count, e.avg_time]),
    ];
    const csv = lines.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `logfire_monitoring_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !monitoring) {
    return (
      <div style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
        <p style={{ marginTop: '16px', color: 'var(--text-dim)' }}>Đang tải monitoring data...</p>
      </div>
    );
  }
  if (!monitoring) {
    return <div style={{ padding: '24px', color: 'var(--text-dim)' }}>Không thể tải monitoring data</div>;
  }

  const { api_metrics, recent_errors, error_summary, system_health, database, logfire_enabled } = monitoring;

  const filteredEndpoints = api_metrics.endpoints.filter(e => !search.trim() || e.path.toLowerCase().includes(search.trim().toLowerCase()));
  const filteredErrors = recent_errors.filter(e => !search.trim() || e.message.toLowerCase().includes(search.trim().toLowerCase()) || e.endpoint.toLowerCase().includes(search.trim().toLowerCase()));

  const totalPages = Math.max(1, Math.ceil(filteredEndpoints.length / ROWS_PER_PAGE));
  const pageEndpoints = filteredEndpoints.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const withBytes = database.tables.map(t => ({ ...t, bytesReal: t.bytes ?? parseSizeToBytes(t.size) }));
  const totalDbBytes = database.bytes || withBytes.reduce((s, t) => s + t.bytesReal, 0) || 1;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={20} color="#EA580C" /> Logfire Monitoring
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: logfire_enabled ? '#DCFCE7' : '#FEF3C7', color: logfire_enabled ? '#16A34A' : '#D97706' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: logfire_enabled ? '#16A34A' : '#D97706' }} /> {logfire_enabled ? 'Connected' : 'Not Connected'}
            </span>
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-dim)' }}>Real-time system monitoring &amp; performance analytics</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search endpoints, logs..." style={{ padding: '9px 12px 9px 32px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px', minWidth: '200px' }} />
          </div>
          <select value={hours} onChange={e => setHours(Number(e.target.value))} style={{ padding: '9px 12px', borderRadius: '10px', border: '2px solid var(--border-neon)', fontSize: '13px' }}>
            {WINDOW_OPTIONS.map(o => <option key={o.hours} value={o.hours}>{o.label}</option>)}
          </select>
          <button onClick={() => fetchMonitoring(hours)} title="Làm mới" style={{ width: '42px', height: '42px', borderRadius: '10px', border: '2px solid var(--border-neon)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          </button>
          <button onClick={exportData} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', border: '2px solid var(--border-neon)', background: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {!logfire_enabled && (
        <div style={{ ...CARD_STYLE, background: '#FFFBEB', borderColor: '#FDE68A', fontSize: '12.5px', color: '#92400E' }}>
          ⚠️ Chưa cấu hình <code>LOGFIRE_READ_TOKEN</code> — toàn bộ số liệu bên dưới đang là 0/rỗng vì chưa lấy được dữ liệu thật, không phải hệ thống không có traffic.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <StatCard icon={<Zap size={20} />} color="#2563EB" bg="rgba(37,99,235,0.1)" value={api_metrics.total_requests_today.toLocaleString()} label="Total Requests" />
        <StatCard icon={<Clock size={20} />} color="#EA580C" bg="rgba(234,88,12,0.1)" value={`${api_metrics.avg_response_time_ms}ms`} label="Avg Response Time" />
        <StatCard icon={<AlertCircle size={20} />} color="#DC2626" bg="rgba(220,38,38,0.1)" value={`${(api_metrics.error_rate * 100).toFixed(2)}%`} label="Error Rate" />
        <StatCard icon={<Database size={20} />} color="#7C3AED" bg="rgba(124,58,237,0.1)" value={database.size} label="Database Size" />
        <StatCard icon={<ShieldCheck size={20} />} color="#16A34A" bg="rgba(22,163,74,0.1)" value={system_health.uptime} label="Uptime" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
        <ChartCard title="Top API Endpoints" icon={<Zap size={16} color="var(--color-primary)" />}>
          <DonutChart data={api_metrics.endpoints.map(e => ({ label: parseEndpoint(e.path).route, count: e.count }))} centerLabel="Total" />
        </ChartCard>

        <ChartCard title="Recent Logs & Errors" icon={<AlertCircle size={16} color="var(--color-primary)" />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
            {filteredErrors.map((err, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '10px', paddingBottom: '10px', borderBottom: idx < filteredErrors.length - 1 ? '1px solid var(--border-neon)' : 'none' }}>
                <span style={{
                  fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', height: 'fit-content', flexShrink: 0,
                  background: err.level === 'ERROR' ? '#FEE2E2' : err.level === 'WARNING' ? '#FEF3C7' : '#DBEAFE',
                  color: err.level === 'ERROR' ? '#DC2626' : err.level === 'WARNING' ? '#D97706' : '#2563EB'
                }}>{err.level}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 600 }}>{err.message}</p>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{err.endpoint} · {new Date(err.timestamp).toLocaleString('vi-VN')}</span>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Database Tables" icon={<Database size={16} color="var(--color-primary)" />}>
          {withBytes.map((table, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <span style={{ color: 'var(--text-dim)' }}>{table.table_name}</span>
                <strong>{table.size} · {((table.bytesReal / totalDbBytes) * 100).toFixed(0)}%</strong>
              </div>
              <div style={{ height: '6px', borderRadius: '3px', background: '#F1F5F9', overflow: 'hidden' }}>
                <div style={{ width: `${(table.bytesReal / totalDbBytes) * 100}%`, height: '100%', background: '#7C3AED', borderRadius: '3px' }} />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', paddingTop: '6px', borderTop: '1px solid var(--border-neon)' }}>
            <span style={{ color: 'var(--text-dim)' }}>Tổng dung lượng</span><strong>{database.size}</strong>
          </div>
        </ChartCard>

        <ChartCard title="System Health" icon={<ShieldCheck size={16} color="var(--color-primary)" />}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              [Server, 'Database', system_health.database],
              [Bot, 'Groq API', system_health.groq],
              [Cpu, 'Auto Crawler', system_health.crawler],
              [ShieldCheck, 'Uptime', system_health.uptime],
            ].map(([Icon, label, value]) => {
              const healthy = ['healthy', 'active', 'running'].includes(String(value).toLowerCase());
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: healthy ? '#16A34A' : '#D97706', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{label}</div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700 }}>{value}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: '14px' }}>
        <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '2px solid var(--border-neon)' }}>
            <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800 }}>Endpoint Performance Details</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '520px', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                  <th style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>Endpoint</th>
                  <th style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>Method</th>
                  <th style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>Requests</th>
                  <th style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {pageEndpoints.map((e, idx) => {
                  const { method, route } = parseEndpoint(e.path);
                  return (
                    <tr key={idx} style={{ borderTop: '1px solid var(--border-neon)' }}>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{route}</td>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                        {method ? <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#EFF6FF', color: '#2563EB' }}>{method}</span> : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{e.count.toLocaleString()}</td>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{e.avg_time}ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pageEndpoints.length === 0 && (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12.5px' }}>Chưa có dữ liệu endpoint trong khoảng thời gian này.</div>
            )}
          </div>
          {filteredEndpoints.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '2px solid var(--border-neon)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Showing {(page - 1) * ROWS_PER_PAGE + 1} to {Math.min(page * ROWS_PER_PAGE, filteredEndpoints.length)} of {filteredEndpoints.length} endpoints</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border-neon)', background: 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>‹</button>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>{page}/{totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border-neon)', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}>›</button>
              </div>
            </div>
          )}
        </div>

        <ChartCard title="Log Level Distribution" icon={<AlertCircle size={16} color="var(--color-primary)" />}>
          <DonutChart data={error_summary.map(e => ({ label: e.level, count: e.count }))} centerLabel="Logs" />
          {logfire_enabled && error_summary.length === 0 && (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)' }}>Không có lỗi/cảnh báo nào được ghi nhận trong khoảng thời gian này.</p>
          )}
        </ChartCard>
      </div>
    </div>
  );
};

export default LogfireView;
