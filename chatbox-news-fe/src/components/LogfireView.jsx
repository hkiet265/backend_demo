import React, { useState, useEffect } from 'react';
import { Activity, Zap, Clock, TrendingUp, AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import Spinner from './atoms/Spinner';

const LogfireView = () => {
  const [monitoring, setMonitoring] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logfireEnabled, setLogfireEnabled] = useState(false);

  const logfireUrl = 'https://logfire-us.pydantic.dev/kiethk/emtu';

  const fetchMonitoring = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/monitoring');
      const data = await response.json();
      
      if (data.status === 'success') {
        setMonitoring(data.data);
        setLogfireEnabled(data.data.logfire_enabled || false);
      }
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoring();

    const interval = setInterval(fetchMonitoring, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !monitoring) {
    return (
      <div className="loading-state" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
        <p style={{ marginTop: '16px', color: 'var(--text-dim)' }}>Đang tải monitoring data...</p>
      </div>
    );
  }

  if (!monitoring) {
    return (
      <div className="logfire-view error">
        <p>Không thể tải monitoring data</p>
      </div>
    );
  }

  const { api_metrics, recent_errors, system_health, database } = monitoring;

  return (
    <div className="logfire-view"> 
      <div className="dashboard-header">
        <div>
          <h2>🔥 Logfire Monitoring</h2>
          <p className="subtitle">
            Real-time system monitoring & performance analytics
            {logfireEnabled ? (
              <span style={{color: '#4ade80', marginLeft: '10px'}}>● Connected</span>
            ) : (
              <span style={{color: '#f59e0b', marginLeft: '10px'}}>● Not Connected (Using fallback data)</span>
            )}
          </p>
        </div> 
      </div>
 
      <div className="stats-grid">
        <div className="stat-card monitoring">
          <div className="stat-icon api">
            <Zap size={24} />
          </div>
          <div className="stat-content">
            <h3>{api_metrics.total_requests_today.toLocaleString()}</h3>
            <p>Total Requests</p>
            <span className="stat-badge">{api_metrics.avg_response_time_ms}ms avg</span>
          </div>
        </div>

        <div className="stat-card monitoring">
          <div className="stat-icon performance">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <h3>{api_metrics.avg_response_time_ms}ms</h3>
            <p>Response Time</p>
            <span className="stat-badge success">Ultra-fast</span>
          </div>
        </div>

        <div className="stat-card monitoring">
          <div className="stat-icon error">
            <AlertCircle size={24} />
          </div>
          <div className="stat-content">
            <h3>{(api_metrics.error_rate * 100).toFixed(1)}%</h3>
            <p>Error Rate</p>
            <span className="stat-badge success">Healthy</span>
          </div>
        </div>

        <div className="stat-card monitoring">
          <div className="stat-icon db">
            <Activity size={24} />
          </div>
          <div className="stat-content">
            <h3>{database.size}</h3>
            <p>Database Size</p>
            <span className="stat-badge">PostgreSQL</span>
          </div>
        </div>
      </div>
 
      <div className="charts-grid"> 
        <div className="chart-card monitoring-card">
          <h3><Zap size={20} /> Top API Endpoints (hôm nay)</h3>
          <div className="bar-chart">
            {api_metrics.endpoints.map((endpoint, idx) => (
              <div key={idx} className="bar-item">
                <span className="bar-label" title={endpoint.path}>
                  {endpoint.path.split('/').pop() || 'root'}
                </span>
                <div className="bar-container">
                  <div 
                    className="bar-fill api" 
                    style={{width: `${(endpoint.count / api_metrics.endpoints[0].count) * 100}%`}}
                  />
                </div>
                <span className="bar-value">{endpoint.count} calls ({endpoint.avg_time}ms)</span>
              </div>
            ))}
          </div>
        </div>
 
        <div className="chart-card monitoring-card">
          <h3><AlertCircle size={20} /> Recent Logs & Errors</h3>
          <div className="latest-list">
            {recent_errors.map((error, idx) => (
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
          <h3><Activity size={20} /> Database Tables</h3>
          <div className="bar-chart">
            {database.tables.map((table, idx) => (
              <div key={idx} className="bar-item">
                <span className="bar-label">{table.table_name}</span>
                <div className="bar-container">
                  <div className="bar-fill db" style={{width: '100%'}} />
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
              <div className={`health-indicator ${system_health.database === 'healthy' ? 'success' : 'error'}`} />
              <div className="health-info">
                <span className="health-label">Database</span>
                <span className="health-status">{system_health.database}</span>
              </div>
            </div>
            <div className="health-item">
              <div className={`health-indicator ${system_health.groq === 'healthy' ? 'success' : 'warning'}`} />
              <div className="health-info">
                <span className="health-label">Groq API</span>
                <span className="health-status">{system_health.groq}</span>
              </div>
            </div>
            <div className="health-item">
              <div className={`health-indicator ${system_health.crawler === 'active' ? 'success' : 'error'}`} />
              <div className="health-info">
                <span className="health-label">Auto Crawler</span>
                <span className="health-status">{system_health.crawler}</span>
              </div>
            </div>
            <div className="health-item">
              <div className="health-indicator success" />
              <div className="health-info">
                <span className="health-label">Uptime</span>
                <span className="health-status">{system_health.uptime}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
 
      <div className="endpoint-details-section">
        <h3>📊 Endpoint Performance Details</h3>
        <div className="endpoint-cards-grid">
          {api_metrics.endpoints.map((endpoint, idx) => (
            <div key={idx} className="endpoint-card">
              <div className="endpoint-header">
                <span className="endpoint-method">POST</span>
                <span className="endpoint-path">{endpoint.path}</span>
              </div>
              <div className="endpoint-stats">
                <div className="endpoint-stat">
                  <span className="stat-label">Requests</span>
                  <span className="stat-value">{endpoint.count.toLocaleString()}</span>
                </div>
                <div className="endpoint-stat">
                  <span className="stat-label">Avg Time</span>
                  <span className="stat-value">{endpoint.avg_time}ms</span>
                </div>
                <div className="endpoint-stat">
                  <span className="stat-label">Status</span>
                  <span className="stat-badge success">
                    <CheckCircle size={14} />
                    Active
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LogfireView;
