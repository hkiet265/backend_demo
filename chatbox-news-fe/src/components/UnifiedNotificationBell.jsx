import { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, Clock, X, Newspaper, Settings, Check, Trash2 } from 'lucide-react';

/**
 * UnifiedNotificationBell - Combined notification center
 * Includes: Business Alerts + System Notifications
 */
const UnifiedNotificationBell = ({ currentUser }) => {
  const [businessAlerts, setBusinessAlerts] = useState([]);
  const [systemNotifications, setSystemNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all, alerts, notifications
  const [unreadCount, setUnreadCount] = useState(0);
  const popoverRef = useRef(null);

  const API_BASE = '';

  // Fetch business alerts
  const fetchBusinessAlerts = async () => {
    const token = localStorage.getItem('token');
    if (!token) return [];

    try {
      // Get user's businesses
      const businessResponse = await fetch(`${API_BASE}/api/businesses/my-businesses?page=1&page_size=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!businessResponse.ok) return [];

      const businessData = await businessResponse.json();
      const myBusinessIds = (businessData.data || []).map(b => b.id);

      if (myBusinessIds.length === 0) return [];

      // Get alerts for all businesses
      const alertResponse = await fetch(`${API_BASE}/api/ux/alerts/detect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ threshold_days: 180 })
      });

      if (!alertResponse.ok) return [];

      const alertData = await alertResponse.json();
      
      // Filter alerts for user's businesses only
      const myAlerts = (alertData.alerts || []).filter(alert => 
        myBusinessIds.includes(alert.business_id)
      ).map(alert => ({
        ...alert,
        type: 'business_alert',
        created_at: new Date().toISOString(),
        is_read: false
      }));

      return myAlerts;
    } catch (error) {
      console.error('Error fetching business alerts:', error);
      return [];
    }
  };

  // Fetch system notifications
  const fetchSystemNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) return [];

    try {
      const response = await fetch(`${API_BASE}/api/notifications/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) return [];

      const data = await response.json();
      return (data.notifications || []).map(notif => ({
        ...notif,
        type: 'system_notification'
      }));
    } catch (error) {
      console.error('Error fetching system notifications:', error);
      return [];
    }
  };

  // Fetch all notifications
  const fetchAllNotifications = async () => {
    setLoading(true);
    try {
      const [alerts, notifications] = await Promise.all([
        fetchBusinessAlerts(),
        fetchSystemNotifications()
      ]);

      setBusinessAlerts(alerts);
      setSystemNotifications(notifications);

      // Calculate unread count
      const alertsUnread = alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length;
      const notifsUnread = notifications.filter(n => !n.is_read).length;
      setUnreadCount(alertsUnread + notifsUnread);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchAllNotifications();
      // Refresh every 3 minutes
      const interval = setInterval(fetchAllNotifications, 3 * 60 * 1000);
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
      low: '#84cc16',
      urgent: '#dc2626'
    };
    return colors[severity] || '#6b7280';
  };

  const getSeverityIcon = (severity) => {
    if (severity === 'critical' || severity === 'high' || severity === 'urgent') {
      return <AlertTriangle size={16} />;
    }
    return <Clock size={16} />;
  };

  const getSeverityLabel = (severity) => {
    const labels = {
      critical: 'Nghiêm trọng',
      high: 'Cao',
      medium: 'Trung bình',
      low: 'Thấp',
      urgent: 'Khẩn cấp'
    };
    return labels[severity] || severity;
  };

  const getAlertTypeLabel = (type) => {
    const labels = {
      outdated: 'Dữ liệu cũ',
      missing_field: 'Thiếu thông tin',
      invalid: 'Không hợp lệ'
    };
    return labels[type] || type;
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  const markAsRead = async (notificationId) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchAllNotifications();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const deleteSystemNotification = async (notificationId) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`${API_BASE}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchAllNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Get filtered items based on active tab
  const getFilteredItems = () => {
    if (activeTab === 'alerts') {
      return businessAlerts;
    } else if (activeTab === 'notifications') {
      return systemNotifications;
    } else {
      // Combine and sort by date
      const combined = [
        ...businessAlerts,
        ...systemNotifications
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return combined;
    }
  };

  const filteredItems = getFilteredItems();

  if (!currentUser) return null;

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      <button
        className={`unified-bell-btn ${unreadCount > 0 ? 'has-alerts' : ''}`}
        onClick={() => setShowPopover(!showPopover)}
        title={`${unreadCount} thông báo mới`}
        style={{
          position: 'relative',
          background: '#F8FAFC',
          border: '1px solid #E8EDF3',
          borderRadius: '50%',
          width: '42px',
          height: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          color: '#D71E28',
          boxShadow: showPopover ? '0 4px 16px rgba(0, 0, 0, 0.12)' : '0 2px 8px rgba(0, 0, 0, 0.08)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.background = '#FFFFFF';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = showPopover ? '0 4px 16px rgba(0, 0, 0, 0.12)' : '0 2px 8px rgba(0, 0, 0, 0.08)';
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.background = '#F8FAFC';
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
            boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)'
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
          width: '450px',
          maxHeight: '600px',
          background: 'white',
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
            flexDirection: 'column',
            gap: '12px',
            background: '#F8FAFC'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={20} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Thông báo
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
                  e.target.style.background = '#F1F5F9';
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

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setActiveTab('all')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: activeTab === 'all' ? 'linear-gradient(135deg, #D71E28, #B91C1C)' : 'white',
                  border: `2px solid ${activeTab === 'all' ? '#D71E28' : 'var(--border-neon)'}`,
                  borderRadius: '8px',
                  color: activeTab === 'all' ? 'white' : 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Tất cả ({businessAlerts.length + systemNotifications.length})
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: activeTab === 'alerts' ? 'linear-gradient(135deg, #D71E28, #B91C1C)' : 'white',
                  border: `2px solid ${activeTab === 'alerts' ? '#D71E28' : 'var(--border-neon)'}`,
                  borderRadius: '8px',
                  color: activeTab === 'alerts' ? 'white' : 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <AlertTriangle size={14} />
                Cảnh báo ({businessAlerts.length})
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: activeTab === 'notifications' ? 'linear-gradient(135deg, #D71E28, #B91C1C)' : 'white',
                  border: `2px solid ${activeTab === 'notifications' ? '#D71E28' : 'var(--border-neon)'}`,
                  borderRadius: '8px',
                  color: activeTab === 'notifications' ? 'white' : 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <Newspaper size={14} />
                Hệ thống ({systemNotifications.length})
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: '450px'
          }}>
            {loading ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: '14px', margin: 0 }}>Đang tải...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                <Bell size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>
                  {activeTab === 'alerts' ? 'Không có cảnh báo' : activeTab === 'notifications' ? 'Không có thông báo' : 'Không có thông báo nào'}
                </p>
                <p style={{ fontSize: '13px', margin: '4px 0 0 0', opacity: 0.7 }}>
                  Mọi thứ đều ổn định
                </p>
              </div>
            ) : (
              <div style={{ padding: '8px' }}>
                {filteredItems.map((item, index) => {
                  const isBusinessAlert = item.type === 'business_alert';
                  const severity = isBusinessAlert ? item.severity : (item.priority || 'medium');
                  
                  return (
                    <div
                      key={`${item.type}-${item.id || index}`}
                      style={{
                        padding: '12px',
                        margin: '8px 0',
                        background: '#F8FAFC',
                        border: `2px solid ${getSeverityColor(severity)}`,
                        borderLeft: `6px solid ${getSeverityColor(severity)}`,
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateX(4px)';
                        e.currentTarget.style.boxShadow = `0 4px 12px ${getSeverityColor(severity)}40`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateX(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {/* Action buttons for system notifications */}
                      {!isBusinessAlert && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          display: 'flex',
                          gap: '4px'
                        }}>
                          {!item.is_read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(item.id);
                              }}
                              style={{
                                background: 'rgba(34, 197, 94, 0.1)',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px',
                                cursor: 'pointer',
                                color: '#22c55e',
                                display: 'flex',
                                opacity: 0.6,
                                transition: 'opacity 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.opacity = 1}
                              onMouseLeave={(e) => e.target.style.opacity = 0.6}
                              title="Đánh dấu đã đọc"
                            >
                              <Check size={14} />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSystemNotification(item.id);
                            }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px',
                              cursor: 'pointer',
                              color: '#ef4444',
                              display: 'flex',
                              opacity: 0.6,
                              transition: 'opacity 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.opacity = 1}
                            onMouseLeave={(e) => e.target.style.opacity = 0.6}
                            title="Xóa thông báo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingRight: !isBusinessAlert ? '60px' : '0' }}>
                        <div style={{ 
                          color: getSeverityColor(severity),
                          marginTop: '2px',
                          flexShrink: 0
                        }}>
                          {getSeverityIcon(severity)}
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
                              background: getSeverityColor(severity),
                              color: 'white',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              {getSeverityLabel(severity)}
                            </span>
                            {isBusinessAlert && (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                padding: '2px 8px',
                                borderRadius: '8px',
                                background: 'rgba(14, 165, 233, 0.1)',
                                color: 'var(--color-primary)'
                              }}>
                                {getAlertTypeLabel(item.alert_type)}
                              </span>
                            )}
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                              <Clock size={11} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                              {formatTime(item.created_at)}
                            </span>
                          </div>
                          <p style={{
                            margin: '0 0 4px 0',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: 'var(--text-main)',
                            lineHeight: '1.4'
                          }}>
                            {isBusinessAlert ? item.business_name : item.title}
                          </p>
                          <p style={{
                            margin: 0,
                            fontSize: '13px',
                            color: 'var(--text-dim)',
                            lineHeight: '1.5'
                          }}>
                            {item.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {filteredItems.length > 0 && (
            <div style={{
              padding: '12px 16px',
              borderTop: '2px solid var(--border-neon)',
              background: '#F8FAFC',
              textAlign: 'center'
            }}>
              <button
                onClick={fetchAllNotifications}
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
                🔄 Làm mới
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UnifiedNotificationBell;
