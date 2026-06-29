import React, { useState, useEffect } from 'react';
import { BarChart, Activity, Database, Users, TrendingUp, RefreshCw, AlertCircle, Clock, Zap, Server } from 'lucide-react';

const AdminDashboardView = () => {
  const [stats, setStats] = useState(null);
  const [monitoring, setMonitoring] = useState(null);
  const [loading, setLoading] = useState(true); 

  const fetchStats = async () => {
    try {
      setLoading(true);

      const [statsRes, monitoringRes] = await Promise.all([
        fetch('http://127.0.0.1:8000/api/admin/stats'),
        fetch('http://127.0.0.1:8000/api/admin/monitoring')
      ]);
      
      const statsData = await statsRes.json();
      const monitoringData = await monitoringRes.json();
      
      if (statsData.status === 'success') {
        setStats(statsData.data);
      }
      
      if (monitoringData.status === 'success') {
        setMonitoring(monitoringData.data);
      } 
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
      <div className="admin-dashboard loading">
        <div className="loading-spinner">Đang tải dữ liệu...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="admin-dashboard error">
        <p>Không thể tải dữ liệu dashboard</p>
      </div>
    );
  }

  const { overview, news_stats, business_stats, latest_news, system } = stats;

  return (
    <div className="admin-dashboard"> 
      <div className="dashboard-header">
        <div>
          <h2>📊 Dashboard</h2>
          <p className="subtitle">Tổng quan hệ thống & Monitoring</p>
        </div> 
      </div>
 
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon news">
            <Database size={24} />
          </div>
          <div className="stat-content">
            <h3>{overview.total_news.toLocaleString()}</h3>
            <p>Tổng tin tức</p>
            <span className="stat-badge">{overview.news_today} hôm nay</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon business">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <h3>{overview.total_businesses.toLocaleString()}</h3>
            <p>Doanh nghiệp</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon users">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <h3>{overview.total_users}</h3>
            <p>Người dùng</p>
            <span className="stat-badge">{overview.new_users_week} tuần này</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon system">
            <Activity size={24} />
          </div>
          <div className="stat-content">
            <h3>{system.groq_enabled ? 'Groq' : 'Gemini'}</h3>
            <p>LLM Engine</p>
            <span className="stat-badge success">v{system.app_version}</span>
          </div>
        </div>
      </div>
 
      {monitoring && (
        <>
          <div className="section-divider">
            <h3>🔍 API Monitoring & Performance</h3>
          </div>
 
          <div className="stats-grid">
            <div className="stat-card monitoring">
              <div className="stat-icon api">
                <Zap size={24} />
              </div>
              <div className="stat-content">
                <h3>{monitoring.api_metrics.total_requests_today.toLocaleString()}</h3>
                <p>API Requests (hôm nay)</p>
                <span className="stat-badge">{monitoring.api_metrics.avg_response_time_ms}ms avg</span>
              </div>
            </div>

            <div className="stat-card monitoring">
              <div className="stat-icon performance">
                <Clock size={24} />
              </div>
              <div className="stat-content">
                <h3>{monitoring.api_metrics.avg_response_time_ms}ms</h3>
                <p>Avg Response Time</p>
                <span className="stat-badge success">Ultra-fast</span>
              </div>
            </div>

            <div className="stat-card monitoring">
              <div className="stat-icon error">
                <AlertCircle size={24} />
              </div>
              <div className="stat-content">
                <h3>{(monitoring.api_metrics.error_rate * 100).toFixed(1)}%</h3>
                <p>Error Rate</p>
                <span className="stat-badge success">Healthy</span>
              </div>
            </div>

            <div className="stat-card monitoring">
              <div className="stat-icon db">
                <Server size={24} />
              </div>
              <div className="stat-content">
                <h3>{monitoring.database.size}</h3>
                <p>Database Size</p>
                <span className="stat-badge">PostgreSQL</span>
              </div>
            </div>
          </div>
 
          <div className="charts-grid">
            <div className="chart-card monitoring-card">
              <h3><Zap size={20} /> Top API Endpoints (hôm nay)</h3>
              <div className="bar-chart">
                {monitoring.api_metrics.endpoints.map((endpoint, idx) => (
                  <div key={idx} className="bar-item">
                    <span className="bar-label" title={endpoint.path}>
                      {endpoint.path.split('/').pop() || 'root'}
                    </span>
                    <div className="bar-container">
                      <div 
                        className="bar-fill api" 
                        style={{width: `${(endpoint.count / monitoring.api_metrics.endpoints[0].count) * 100}%`}}
                      />
                    </div>
                    <span className="bar-value">{endpoint.count} calls</span>
                  </div>
                ))}
              </div>
            </div>
 
            <div className="chart-card monitoring-card">
              <h3><AlertCircle size={20} /> Recent Logs</h3>
              <div className="latest-list">
                {monitoring.recent_errors.map((error, idx) => (
                  <div key={idx} className="latest-item log-item">
                    <div className={`latest-badge ${error.level.toLowerCase()}`}>
                      {error.level}
                    </div>
                    <div className="latest-content">
                      <p className="latest-title">{error.message}</p>
                      <span className="latest-meta">
                        {error.endpoint} • {new Date(error.timestamp).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
 
            <div className="chart-card monitoring-card">
              <h3><Database size={20} /> Database Tables</h3>
              <div className="bar-chart">
                {monitoring.database.tables.map((table, idx) => (
                  <div key={idx} className="bar-item">
                    <span className="bar-label">{table.table_name}</span>
                    <div className="bar-container">
                      <div 
                        className="bar-fill db" 
                        style={{width: '100%'}}
                      />
                    </div>
                    <span className="bar-value">{table.size}</span>
                  </div>
                ))}
              </div>
            </div>
 
            <div className="chart-card monitoring-card">
              <h3><Activity size={20} /> System Health</h3>
              <div className="health-grid">
                <div className="health-item">
                  <div className="health-indicator success" />
                  <div className="health-info">
                    <span className="health-label">Database</span>
                    <span className="health-status">{monitoring.system_health.database}</span>
                  </div>
                </div>
                <div className="health-item">
                  <div className="health-indicator success" />
                  <div className="health-info">
                    <span className="health-label">Groq API</span>
                    <span className="health-status">{monitoring.system_health.groq}</span>
                  </div>
                </div>
                <div className="health-item">
                  <div className="health-indicator success" />
                  <div className="health-info">
                    <span className="health-label">Crawler</span>
                    <span className="health-status">{monitoring.system_health.crawler}</span>
                  </div>
                </div>
                <div className="health-item">
                  <div className="health-indicator success" />
                  <div className="health-info">
                    <span className="health-label">Uptime</span>
                    <span className="health-status">{monitoring.system_health.uptime}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
 
      <div className="section-divider">
        <h3>📈 Data Overview</h3>
      </div>

      <div className="charts-grid"> 
        <div className="chart-card">
          <h3><BarChart size={20} /> Tin tức theo nguồn</h3>
          <div className="bar-chart">
            {news_stats.by_source.map((item, idx) => (
              <div key={idx} className="bar-item">
                <span className="bar-label">{item.nha_dai || 'Khác'}</span>
                <div className="bar-container">
                  <div 
                    className="bar-fill" 
                    style={{width: `${(item.count / news_stats.by_source[0].count) * 100}%`}}
                  />
                </div>
                <span className="bar-value">{item.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
 
        <div className="chart-card">
          <h3><BarChart size={20} /> Tin tức theo vùng</h3>
          <div className="bar-chart">
            {news_stats.by_region.map((item, idx) => (
              <div key={idx} className="bar-item">
                <span className="bar-label">{item.vung_mien || 'Khác'}</span>
                <div className="bar-container">
                  <div 
                    className="bar-fill" 
                    style={{width: `${(item.count / news_stats.by_region[0].count) * 100}%`}}
                  />
                </div>
                <span className="bar-value">{item.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
 
        <div className="chart-card">
          <h3><BarChart size={20} /> Doanh nghiệp theo vùng</h3>
          <div className="bar-chart">
            {business_stats.by_region.map((item, idx) => (
              <div key={idx} className="bar-item">
                <span className="bar-label">{item.vung_mien || 'Khác'}</span>
                <div className="bar-container">
                  <div 
                    className="bar-fill business" 
                    style={{width: `${(item.count / business_stats.by_region[0].count) * 100}%`}}
                  />
                </div>
                <span className="bar-value">{item.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
 
        <div className="chart-card">
          <h3>📰 Tin tức mới nhất</h3>
          <div className="latest-list">
            {latest_news.map((news, idx) => (
              <div key={idx} className="latest-item">
                <div className="latest-badge">{news.nha_dai}</div>
                <div className="latest-content">
                  <p className="latest-title">{news.tieu_de}</p>
                  <span className="latest-meta">
                    {news.chuyen_muc} • {new Date(news.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
 
      <div className="system-info">
        <h3>🔧 Thông tin hệ thống</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Phiên bản:</span>
            <span className="info-value">{system.app_version}</span>
          </div>
          <div className="info-item">
            <span className="info-label">LLM Engine:</span>
            <span className="info-value">{system.groq_enabled ? 'Groq (Ultra-fast)' : 'Gemini'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Database:</span>
            <span className="info-value">PostgreSQL + pgvector</span>
          </div>
          <div className="info-item">
            <span className="info-label">Auto-crawler:</span>
            <span className="info-value">✅ Every 30 minutes</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardView;
