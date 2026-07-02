import { useState, useEffect } from 'react';

const AdminAlertsView = () => {
  const [alertSummary, setAlertSummary] = useState(null);
  const [outdatedAlerts, setOutdatedAlerts] = useState([]);
  const [missingFieldsAlerts, setMissingFieldsAlerts] = useState([]);
  const [invalidDataAlerts, setInvalidDataAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const API_BASE = 'http://127.0.0.1:8000';

  const fetchAlertSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/ux/alerts/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.status === 'success') {
        setAlertSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching alert summary:', error);
    }
  };

  const fetchOutdatedAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/ux/alerts/outdated`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.status === 'success') {
        setOutdatedAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Error fetching outdated alerts:', error);
    }
  };

  const fetchMissingFieldsAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/ux/alerts/missing-fields?resource_type=business`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.status === 'success') {
        setMissingFieldsAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Error fetching missing fields alerts:', error);
    }
  };

  const fetchInvalidDataAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/ux/alerts/invalid-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.status === 'success') {
        setInvalidDataAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Error fetching invalid data alerts:', error);
    }
  };

  const fetchAllAlerts = async () => {
    setLoading(true);
    await Promise.all([
      fetchAlertSummary(),
      fetchOutdatedAlerts(),
      fetchMissingFieldsAlerts(),
      fetchInvalidDataAlerts()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllAlerts();

    // Auto refresh mỗi 5 phút
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchAllAlerts, 5 * 60 * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getSeverityColor = (severity) => {
    const colors = {
      info: '#3B82F6',
      warning: '#F59E0B',
      error: '#EF4444',
      critical: '#DC2626'
    };
    return colors[severity] || '#6B7280';
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      info: '🔵',
      warning: '🟡',
      error: '🟠',
      critical: '🔴'
    };
    return icons[severity] || '⚪';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '20px auto' }}></div>
        <p>Đang tải alerts...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>
          🚨 Data Quality Alerts
        </h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (5 phút)
          </label>
          <button
            onClick={fetchAllAlerts}
            style={{
              padding: '8px 16px',
              background: '#FF8C42',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {alertSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '30px' }}>
          {/* Total Alerts */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '2px solid #E5E7EB'
          }}>
            <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>Total Alerts</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1F2937' }}>
              {alertSummary.total_alerts}
            </div>
          </div>

          {/* Warning */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '2px solid #FCD34D'
          }}>
            <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>🟡 Warning</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#F59E0B' }}>
              {alertSummary.by_severity.warning}
            </div>
          </div>

          {/* Error */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '2px solid #FCA5A5'
          }}>
            <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>🟠 Error</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#EF4444' }}>
              {alertSummary.by_severity.error}
            </div>
          </div>

          {/* Critical */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '2px solid #DC2626'
          }}>
            <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>🔴 Critical</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#DC2626' }}>
              {alertSummary.by_severity.critical}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom: '2px solid #E5E7EB', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          {['summary', 'outdated', 'missing', 'invalid'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 24px',
                background: activeTab === tab ? '#FF8C42' : 'transparent',
                color: activeTab === tab ? 'white' : '#6B7280',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #FF8C42' : 'none',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? 'bold' : 'normal',
                borderRadius: '8px 8px 0 0'
              }}
            >
              {tab === 'summary' && '📊 Summary'}
              {tab === 'outdated' && `⏰ Outdated (${outdatedAlerts.length})`}
              {tab === 'missing' && `📝 Missing Fields (${missingFieldsAlerts.length})`}
              {tab === 'invalid' && `❌ Invalid Data (${invalidDataAlerts.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {/* Summary Tab */}
        {activeTab === 'summary' && alertSummary && (
          <div>
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0 }}>Alert Categories</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <div style={{ padding: '15px', background: '#FEF3C7', borderRadius: '6px' }}>
                  <div style={{ fontSize: '14px', color: '#92400E', marginBottom: '5px' }}>⏰ Outdated Data</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#92400E' }}>
                    {alertSummary.by_category.outdated}
                  </div>
                </div>
                <div style={{ padding: '15px', background: '#DBEAFE', borderRadius: '6px' }}>
                  <div style={{ fontSize: '14px', color: '#1E3A8A', marginBottom: '5px' }}>📝 Missing Fields</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1E3A8A' }}>
                    {alertSummary.by_category.missing_fields}
                  </div>
                </div>
                <div style={{ padding: '15px', background: '#FEE2E2', borderRadius: '6px' }}>
                  <div style={{ fontSize: '14px', color: '#991B1B', marginBottom: '5px' }}>❌ Invalid Data</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#991B1B' }}>
                    {alertSummary.by_category.invalid_data}
                  </div>
                </div>
              </div>

              {alertSummary.needs_attention > 0 && (
                <div style={{
                  marginTop: '20px',
                  padding: '15px',
                  background: '#FEE2E2',
                  borderLeft: '4px solid #DC2626',
                  borderRadius: '6px'
                }}>
                  <strong style={{ color: '#991B1B' }}>
                    ⚠️ {alertSummary.needs_attention} alerts cần xử lý ngay (Error/Critical)
                  </strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Outdated Tab */}
        {activeTab === 'outdated' && (
          <div>
            {outdatedAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '8px' }}>
                <p style={{ fontSize: '18px', color: '#10B981' }}>✅ Không có dữ liệu cũ!</p>
                <p style={{ color: '#6B7280' }}>Tất cả businesses đều được update trong 180 ngày qua.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {outdatedAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'white',
                      padding: '15px',
                      borderRadius: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      borderLeft: `4px solid ${getSeverityColor(alert.severity)}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '18px' }}>{getSeverityIcon(alert.severity)}</span>
                          <strong style={{ fontSize: '16px' }}>{alert.resource_name}</strong>
                          <span style={{
                            padding: '2px 8px',
                            background: '#F3F4F6',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#6B7280'
                          }}>
                            ID: {alert.resource_id}
                          </span>
                        </div>
                        <p style={{ margin: '5px 0', color: '#4B5563' }}>{alert.message}</p>
                        {alert.details && (
                          <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '8px' }}>
                            <span>Last updated: {formatDate(alert.details.last_updated)}</span>
                            <span style={{ marginLeft: '15px', fontWeight: 'bold', color: '#DC2626' }}>
                              {alert.details.days_old} ngày chưa update
                            </span>
                          </div>
                        )}
                        {alert.recommended_action && (
                          <div style={{
                            marginTop: '10px',
                            padding: '8px',
                            background: '#F3F4F6',
                            borderRadius: '4px',
                            fontSize: '13px'
                          }}>
                            💡 <strong>Khuyến nghị:</strong> {alert.recommended_action}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginLeft: '15px' }}>
                        <button
                          onClick={() => window.location.href = `/admin?tab=businesses&edit=${alert.resource_id}`}
                          style={{
                            padding: '6px 12px',
                            background: '#FF8C42',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}
                        >
                          Update
                        </button>
                        <button
                          style={{
                            padding: '6px 12px',
                            background: '#6B7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Missing Fields Tab */}
        {activeTab === 'missing' && (
          <div>
            {missingFieldsAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '8px' }}>
                <p style={{ fontSize: '18px', color: '#10B981' }}>✅ Không có dữ liệu thiếu!</p>
                <p style={{ color: '#6B7280' }}>Tất cả businesses đều có đầy đủ thông tin.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {missingFieldsAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'white',
                      padding: '15px',
                      borderRadius: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      borderLeft: `4px solid ${getSeverityColor(alert.severity)}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '18px' }}>📝</span>
                          <strong style={{ fontSize: '16px' }}>{alert.resource_name}</strong>
                        </div>
                        <p style={{ margin: '5px 0', color: '#4B5563' }}>{alert.message}</p>
                        {alert.recommended_action && (
                          <div style={{
                            marginTop: '10px',
                            padding: '8px',
                            background: '#F3F4F6',
                            borderRadius: '4px',
                            fontSize: '13px'
                          }}>
                            💡 {alert.recommended_action}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => window.location.href = `/admin?tab=businesses&edit=${alert.resource_id}`}
                        style={{
                          padding: '6px 12px',
                          background: '#FF8C42',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        Fix
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Invalid Data Tab */}
        {activeTab === 'invalid' && (
          <div>
            {invalidDataAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '8px' }}>
                <p style={{ fontSize: '18px', color: '#10B981' }}>✅ Không có dữ liệu không hợp lệ!</p>
                <p style={{ color: '#6B7280' }}>Tất cả dữ liệu đều hợp lệ.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {invalidDataAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'white',
                      padding: '15px',
                      borderRadius: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      borderLeft: `4px solid ${getSeverityColor(alert.severity)}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '18px' }}>❌</span>
                          <strong style={{ fontSize: '16px' }}>{alert.resource_name}</strong>
                        </div>
                        <p style={{ margin: '5px 0', color: '#4B5563' }}>{alert.message}</p>
                        {alert.recommended_action && (
                          <div style={{
                            marginTop: '10px',
                            padding: '8px',
                            background: '#F3F4F6',
                            borderRadius: '4px',
                            fontSize: '13px'
                          }}>
                            💡 {alert.recommended_action}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => window.location.href = `/admin?tab=businesses&edit=${alert.resource_id}`}
                        style={{
                          padding: '6px 12px',
                          background: '#FF8C42',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        Fix
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAlertsView;
