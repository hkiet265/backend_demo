import React, { useState, useEffect } from 'react';
import { BarChart, Activity, Database, Users, TrendingUp, RefreshCw, AlertCircle, Clock, Zap, Server, Newspaper } from 'lucide-react';
import Spinner from './atoms/Spinner';
import CountUp from './CountUp';

const CARD_STYLE = {
  background: 'var(--bg-panel)', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)', padding: '18px 20px', color: 'var(--text-main)'
};

function StatCard({ icon, color, bg, value, label, badge }) {
  return (
    <div style={CARD_STYLE}>
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
        {icon}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 800 }}>{typeof value === 'number' ? <CountUp value={value} /> : value}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: badge ? '6px' : 0 }}>{label}</div>
      {badge && <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#16A34A' }}>{badge}</span>}
    </div>
  );
}

function ChartCard({ title, icon, children }) {
  return (
    <div style={{ ...CARD_STYLE, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function BarRow({ label, count, max, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px' }}>
      <span style={{ width: '90px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{label}</span>
      <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'var(--bg-input)', overflow: 'hidden' }}>
        <div style={{ width: `${max ? (count / max) * 100 : 0}%`, height: '100%', background: color, borderRadius: '4px' }} />
      </div>
      <span style={{ width: '50px', textAlign: 'right', flexShrink: 0, fontWeight: 700 }}>{count.toLocaleString()}</span>
    </div>
  );
}

const DONUT_COLORS = ['#2563EB', '#06B6D4', '#7C3AED', '#F59E0B', '#EC4899', '#16A34A'];

function DonutChart({ data }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  let cumulative = 0;
  const segments = data.map((d, idx) => {
    const pct = total ? (d.count / total) * 100 : 0;
    const start = cumulative;
    cumulative += pct;
    return { ...d, pct, start, end: cumulative, color: DONUT_COLORS[idx % DONUT_COLORS.length] };
  });
  const gradient = total
    ? `conic-gradient(${segments.map(s => `${s.color} ${s.start}% ${s.end}%`).join(', ')})`
    : 'conic-gradient(var(--bg-input) 0% 100%)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
      <div style={{
        width: '140px', height: '140px', borderRadius: '50%', background: gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '16px', fontWeight: 800 }}>{total.toLocaleString()}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>requests</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '160px' }}>
        {segments.map((s, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{s.label}</span>
            <span style={{ fontWeight: 700 }}>{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseSizeToBytes(sizeStr) {
  const match = /^([\d.]+)\s*(\w*)/.exec((sizeStr || '').trim());
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = (match[2] || '').toLowerCase();
  const mult = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[unit] || 1;
  return num * mult;
}

const AdminDashboardView = () => {
  const [stats, setStats] = useState(null);
  const [monitoring, setMonitoring] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem('token');
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
      const [statsRes, monitoringRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: authHeaders }),
        fetch('/api/admin/monitoring', { headers: authHeaders })
      ]);

      const statsData = await statsRes.json();
      const monitoringData = await monitoringRes.json();

      if (statsData.status === 'success') setStats(statsData.data);
      if (monitoringData.status === 'success') setMonitoring(monitoringData.data);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
        <p style={{ marginTop: '16px', color: 'var(--text-dim)' }}>Đang tải dashboard...</p>
      </div>
    );
  }

  if (!stats) {
    return <div style={{ padding: '24px', color: 'var(--text-dim)' }}>Không thể tải dữ liệu dashboard</div>;
  }

  const { overview, news_stats, business_stats, latest_news, system } = stats;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800 }}>Dashboard</h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-dim)' }}>Tổng quan hệ thống &amp; Monitoring</p>
        </div>
        <button onClick={fetchStats} title="Làm mới" style={{ width: '42px', height: '42px', borderRadius: '10px', border: '2px solid var(--border-neon)', background: 'var(--bg-input)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <RefreshCw size={18} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <StatCard icon={<Database size={20} />} color="#2563EB" bg="rgba(37,99,235,0.1)" value={overview.total_news} label="Tổng tin tức" badge={`${overview.news_today} hôm nay`} />
        <StatCard icon={<TrendingUp size={20} />} color="#16A34A" bg="rgba(22,163,74,0.1)" value={overview.total_businesses} label="Doanh nghiệp" />
        <StatCard icon={<Users size={20} />} color="#D97706" bg="rgba(217,119,6,0.1)" value={overview.total_users} label="Người dùng" badge={`+${overview.new_users_week} tuần này`} />
        <StatCard icon={<Activity size={20} />} color="var(--color-primary)" bg="rgba(215,30,40,0.1)" value={system.groq_enabled ? 'Groq' : 'Gemini'} label="LLM Engine" badge={`v${system.app_version}`} />
      </div>

      {monitoring && (
        <>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} color="var(--color-primary)" /> API Monitoring &amp; Performance
            </h3>
            {!monitoring.logfire_enabled && (
              <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: 'var(--text-dim)' }}>
                ⚠️ Chưa cấu hình <code>LOGFIRE_READ_TOKEN</code> — số liệu bên dưới đang là 0 vì chưa lấy được dữ liệu thật, không phải hệ thống không có traffic.
              </p>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <StatCard icon={<Zap size={20} />} color="#7C3AED" bg="rgba(124,58,237,0.1)" value={monitoring.api_metrics.total_requests_today} label="API Requests (hôm nay)" badge={`${monitoring.api_metrics.avg_response_time_ms}ms avg`} />
            <StatCard icon={<Clock size={20} />} color="#EA580C" bg="rgba(234,88,12,0.1)" value={`${monitoring.api_metrics.avg_response_time_ms}ms`} label="Avg Response Time" badge="Ultra-fast" />
            <StatCard icon={<AlertCircle size={20} />} color="#DC2626" bg="rgba(220,38,38,0.1)" value={`${(monitoring.api_metrics.error_rate * 100).toFixed(1)}%`} label="Error Rate" badge="Healthy" />
            <StatCard icon={<Server size={20} />} color="#2563EB" bg="rgba(37,99,235,0.1)" value={monitoring.database.size} label="Database Size" badge="PostgreSQL" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            <ChartCard title="Top API Endpoints (hôm nay)" icon={<Zap size={16} color="var(--color-primary)" />}>
              {monitoring.api_metrics.endpoints.length > 0 ? (
                <DonutChart data={monitoring.api_metrics.endpoints.map(ep => ({ label: ep.path, count: ep.count }))} />
              ) : (
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-dim)' }}>
                  Chưa có dữ liệu — cấu hình LOGFIRE_READ_TOKEN để xem số liệu thật.
                </p>
              )}
            </ChartCard>

            <ChartCard title="Recent Logs" icon={<AlertCircle size={16} color="var(--color-primary)" />}>
              {monitoring.recent_errors.map((err, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '10px', paddingBottom: '10px', borderBottom: idx < monitoring.recent_errors.length - 1 ? '1px solid var(--border-neon)' : 'none' }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', height: 'fit-content', flexShrink: 0,
                    background: err.level === 'ERROR' ? '#FEE2E2' : err.level === 'WARN' ? '#FEF3C7' : '#DBEAFE',
                    color: err.level === 'ERROR' ? '#DC2626' : err.level === 'WARN' ? '#D97706' : '#2563EB'
                  }}>{err.level}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 600 }}>{err.message}</p>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{err.endpoint} · {new Date(err.timestamp).toLocaleString('vi-VN')}</span>
                  </div>
                </div>
              ))}
            </ChartCard>

            <ChartCard title="Database Tables" icon={<Database size={16} color="var(--color-primary)" />}>
              {(() => {
                const withBytes = monitoring.database.tables.map(t => ({ ...t, bytes: parseSizeToBytes(t.size) }));
                const maxBytes = Math.max(...withBytes.map(t => t.bytes), 1);
                return withBytes.map((table, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                      <span style={{ color: 'var(--text-dim)' }}>{table.table_name}</span>
                      <strong>{table.size}</strong>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-input)', overflow: 'hidden' }}>
                      <div style={{ width: `${(table.bytes / maxBytes) * 100}%`, height: '100%', background: '#2563EB', borderRadius: '3px' }} />
                    </div>
                  </div>
                ));
              })()}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', paddingTop: '6px', borderTop: '1px solid var(--border-neon)' }}>
                <span style={{ color: 'var(--text-dim)' }}>Tổng dung lượng</span>
                <strong>{monitoring.database.size}</strong>
              </div>
            </ChartCard>

            <ChartCard title="System Health" icon={<Activity size={16} color="var(--color-primary)" />}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  ['Database', monitoring.system_health.database],
                  ['Groq API', monitoring.system_health.groq],
                  ['Crawler', monitoring.system_health.crawler],
                  ['Uptime', monitoring.system_health.uptime],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{label}</div>
                      <div style={{ fontSize: '12.5px', fontWeight: 700 }}>{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        </>
      )}

      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BarChart size={18} color="var(--color-primary)" /> Data Overview
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        <ChartCard title="Tin tức theo nguồn" icon={<BarChart size={16} color="var(--color-primary)" />}>
          {news_stats.by_source.map((item, idx) => (
            <BarRow key={idx} label={item.nha_dai || 'Khác'} count={item.count} max={news_stats.by_source[0].count} color="#2563EB" />
          ))}
        </ChartCard>

        <ChartCard title="Tin tức theo vùng" icon={<BarChart size={16} color="var(--color-primary)" />}>
          {news_stats.by_region.map((item, idx) => (
            <BarRow key={idx} label={item.vung_mien || 'Khác'} count={item.count} max={news_stats.by_region[0].count} color="#7C3AED" />
          ))}
        </ChartCard>

        <ChartCard title="Doanh nghiệp theo vùng" icon={<BarChart size={16} color="var(--color-primary)" />}>
          {business_stats.by_region.map((item, idx) => (
            <BarRow key={idx} label={item.vung_mien || 'Khác'} count={item.count} max={business_stats.by_region[0].count} color="#16A34A" />
          ))}
        </ChartCard>

        <ChartCard title="Tin tức mới nhất" icon={<Newspaper size={16} color="var(--color-primary)" />}>
          {latest_news.map((news, idx) => (
            <div key={idx} style={{ paddingBottom: '8px', borderBottom: idx < latest_news.length - 1 ? '1px solid var(--border-neon)' : 'none' }}>
              <p style={{ margin: '0 0 4px', fontSize: '12.5px', fontWeight: 700, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{news.tieu_de}</p>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{news.nha_dai} · {news.chuyen_muc} · {new Date(news.created_at).toLocaleString('vi-VN')}</span>
            </div>
          ))}
        </ChartCard>
      </div>

      <div style={{ ...CARD_STYLE, display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
        {[
          ['Phiên bản', system.app_version],
          ['LLM Engine', system.groq_enabled ? 'Groq (Ultra-fast)' : 'Gemini'],
          ['Database', 'PostgreSQL + pgvector'],
          ['Auto-crawler', 'Mỗi 30 phút'],
        ].map(([label, value]) => (
          <div key={label} style={{ fontSize: '12.5px' }}>
            <span style={{ color: 'var(--text-dim)' }}>{label}: </span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboardView;
