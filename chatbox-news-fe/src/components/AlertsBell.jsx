import { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, Clock, X } from 'lucide-react';

/**
 * AlertsBell - Notification icon for user alerts
 * Shows alerts for user's businesses (outdated data, missing fields, etc.)
 */
const AlertsBell = ({ currentUser }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const popoverRef = useRef(null);

  const API_BASE = '';

  // Fetch alerts for user's businesses
  const fetchAlerts = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setLoading(true);
      
      // First, get user's businesses
      const businessResponse = await fetch(`${API_BASE}/api/businesses/my-businesses?page=1&page_size=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!businessResponse.ok) return;

      const businessData = await businessResponse.json();
      const myBusinessIds = (businessData.data || []).map(b => b.id);

      if (myBusinessIds.length === 0) {
        setAlerts([]);
        setUnreadCount(0);
        return;
      }

      // Then, detect alerts for all businesses
      const alertResponse = await fetch(`${API_BASE}/api/ux/alerts/detect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ threshold_days: 180 })
      });

      if (!alertResponse.ok) return;

      const alertData = await alertResponse.json();
      
      // Filter alerts for user's businesses only
      const myAlerts = (alertData.alerts || []).filter(alert => 
        myBusinessIds.includes(alert.business_id)
      );

      setAlerts(myAlerts);
      setUnreadCount(myAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchAlerts();
      // Refresh alerts every 5 minutes
      const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSeverityColor = (severity) => {
    const colors = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#f59e0b',
      low: '#84cc16'
    };
    return colors[severity] || '#84cc16';
  };

  const getSeverityIcon = (severity) => {
    if (severity === 'critical' || severity === 'high') {
      return <AlertTriangle size={16} />;
    }
    return <Clock size={16} />;
  };

  const getSeverityLabel = (severity) => {
    const labels = {
      critical: 'Nghiêm trọng',
      high: 'Cao',
      medium: 'Trung bình',
      low: 'Thấp'
    };
    return labels[severity] || severity;
  };

  const getTypeLabel = (type) => {
    const labels = {
      outdated: 'Dữ liệu cũ',
      missing_field: 'Thiếu thông tin',
      invalid: 'Dữ liệu không hợp lệ'
    };
    return labels[type] || type;
  };

  if (!currentUser) return null;

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      <button
        className="alerts-bell-btn"
        onClick={() => setShowPopover(!showPopover)}
        title={`${unreadCount} cảnh báo`}
        style={{
          position: 'relative',
          background: showPopover ? 'rgba(255, 140, 66, 0.2)' : 'rgba(255, 140, 66, 0.1)',
          border: '2px solid var(--border-neon)',
          borderRadius: '50%',
          width: '42px',
          height: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          color: 'var(--text-main)'
        }}
        onMouseEnter={(e) => {
          if (!showPopover) {
            e.target.style.background = 'rgba(255, 140, 66, 0.15)';
            e.target.style.borderColor = 'var(--color-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!showPopover) {
            e.target.style.background = 'rgba(255, 140, 66, 0.1)';
            e.target.style.borderColor = 'var(--border-neon)';
          }
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#dc2626',
            color: 'white',
            fontSize: '11px',
            fontWeight: '700',
            padding: '2px 6px',
            borderRadius: '10px',
            minWidth: '18px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
            animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showPopover && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 12px)',
          right: 0,
          width: '400px',
          maxHeight: '500px',
          background: 'var(--bg-panel)',
          border: '2px solid var(--border-neon)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          animation: 'dropdownSlide 0.2s ease',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '2px solid var(--border-neon)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-input)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={20} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>
                Cảnh báo của bạn
              </h3>
            </div>
            <button
              onClick={() => setShowPopover(false)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-dim)',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 140, 66, 0.1)';
                e.target.style.color = 'var(--color-primary)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.color = 'var(--text-dim)';
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: '420px'
          }}>
            {loading ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: '14px', margin: 0 }}>Đang tải cảnh báo...</p>
              </div>
            ) : alerts.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                <Bell size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ fontSize: '14px', margin: 0, fontWeight: '600' }}>Không có cảnh báo nào</p>
                <p style={{ fontSize: '13px', margin: '4px 0 0 0', opacity: 0.7 }}>
                  Dữ liệu của bạn đều ổn định
                </p>
              </div>
            ) : (
              <div style={{ padding: '8px' }}>
                {alerts.map((alert, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '12px',
                      margin: '8px 0',
                      background: 'var(--bg-input)',
                      border: `2px solid ${getSeverityColor(alert.severity)}`,
                      borderLeft: `6px solid ${getSeverityColor(alert.severity)}`,
                      borderRadius: '8px',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(4px)';
                      e.currentTarget.style.boxShadow = `0 4px 12px ${getSeverityColor(alert.severity)}40`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ 
                        color: getSeverityColor(alert.severity),
                        marginTop: '2px',
                        flexShrink: 0
                      }}>
                        {getSeverityIcon(alert.severity)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          marginBottom: '6px',
                          flexWrap: 'wrap'
                        }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '8px',
                            background: getSeverityColor(alert.severity),
                            color: 'white',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {getSeverityLabel(alert.severity)}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '8px',
                            background: 'rgba(255, 140, 66, 0.15)',
                            color: 'var(--color-primary)'
                          }}>
                            {getTypeLabel(alert.alert_type)}
                          </span>
                        </div>
                        <p style={{
                          margin: '0 0 4px 0',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: 'var(--text-main)',
                          lineHeight: '1.4'
                        }}>
                          {alert.business_name}
                        </p>
                        <p style={{
                          margin: 0,
                          fontSize: '13px',
                          color: 'var(--text-dim)',
                          lineHeight: '1.5'
                        }}>
                          {alert.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div style={{
              padding: '12px 16px',
              borderTop: '2px solid var(--border-neon)',
              background: 'var(--bg-input)',
              textAlign: 'center'
            }}>
              <button
                onClick={() => {
                  fetchAlerts();
                }}
                style={{
                  background: 'transparent',
                  border: '2px solid var(--border-neon)',
                  color: 'var(--color-primary)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  width: '100%'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'var(--color-primary)';
                  e.target.style.color = 'white';
                  e.target.style.borderColor = 'var(--color-primary)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.color = 'var(--color-primary)';
                  e.target.style.borderColor = 'var(--border-neon)';
                }}
              >
                🔄 Làm mới cảnh báo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlertsBell;
