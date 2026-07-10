import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell, AlertTriangle, Clock, X, Newspaper, Wrench, Heart,
  Check, Trash2, Bookmark, Filter, RefreshCw, ChevronDown
} from 'lucide-react';

const SAVED_KEY = 'saved_notification_ids';

// Maps a notification's `type`/category onto one of the 4 mockup tabs.
// Business alerts (from /api/ux/alerts/detect) are ephemeral, not persisted
// notification rows, so they only ever appear under "Cảnh báo".
function getTabForItem(item) {
  if (item.type === 'business_alert' || item.type === 'alert') return 'alerts';
  if (item.type === 'social') return 'personal';
  if (item.type === 'news' || item.type === 'system') return 'system';
  return 'system';
}

const CATEGORY_STYLE = {
  alerts: { bg: '#FEE2E2', color: '#dc2626', icon: AlertTriangle },
  system: { bg: '#FEF3C7', color: '#D97706', icon: Newspaper },
  personal: { bg: '#DCFCE7', color: '#16A34A', icon: Heart },
  maintenance: { bg: '#EDE9FE', color: '#7C3AED', icon: Wrench },
};

function getItemStyle(item) {
  if (item.category === 'system' || item.type === 'system') return CATEGORY_STYLE.maintenance;
  return CATEGORY_STYLE[getTabForItem(item)] || CATEGORY_STYLE.system;
}

const PRIORITY_PILL = {
  critical: { label: 'Cao', bg: '#FEE2E2', color: '#dc2626' },
  urgent: { label: 'Cao', bg: '#FEE2E2', color: '#dc2626' },
  high: { label: 'Cao', bg: '#FEE2E2', color: '#dc2626' },
  medium: { label: 'Trung bình', bg: '#FEF3C7', color: '#D97706' },
  low: { label: 'Thấp', bg: '#DCFCE7', color: '#16A34A' },
};

const UnifiedNotificationBell = ({ currentUser }) => {
  const [businessAlerts, setBusinessAlerts] = useState([]);
  const [systemNotifications, setSystemNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all | alerts | system | personal
  const [unreadCount, setUnreadCount] = useState(0);
  const [priorityFilter, setPriorityFilter] = useState(null); // null | high | medium | low
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [savedIds, setSavedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')); }
    catch (e) { return new Set(); }
  });

  const API_BASE = '';

  const fetchBusinessAlerts = async () => {
    const token = localStorage.getItem('token');
    if (!token) return [];

    try {
      const businessResponse = await fetch(`${API_BASE}/api/businesses/my-businesses?page=1&page_size=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!businessResponse.ok) return [];

      const businessData = await businessResponse.json();
      const myBusinessIds = (businessData.data || []).map(b => b.id);
      if (myBusinessIds.length === 0) return [];

      const alertResponse = await fetch(`${API_BASE}/api/ux/alerts/detect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold_days: 180 })
      });
      if (!alertResponse.ok) return [];

      const alertData = await alertResponse.json();
      return (alertData.alerts || []).filter(alert => myBusinessIds.includes(alert.business_id)).map(alert => ({
        ...alert,
        id: `biz-alert-${alert.business_id}-${alert.alert_type}`,
        type: 'business_alert',
        created_at: new Date().toISOString(),
        is_read: false
      }));
    } catch (error) {
      console.error('Error fetching business alerts:', error);
      return [];
    }
  };

  const fetchSystemNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) return [];

    try {
      const response = await fetch(`${API_BASE}/api/notifications/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) return [];

      const data = await response.json();
      return (data.notifications || []).map(notif => ({ ...notif, type: notif.type || 'system' }));
    } catch (error) {
      console.error('Error fetching system notifications:', error);
      return [];
    }
  };

  const fetchAllNotifications = async () => {
    setLoading(true);
    try {
      const [alerts, notifications] = await Promise.all([fetchBusinessAlerts(), fetchSystemNotifications()]);
      setBusinessAlerts(alerts);
      setSystemNotifications(notifications);

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
      const interval = setInterval(fetchAllNotifications, 3 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const toggleSaved = (id) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(SAVED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const getSeverityLabel = (severity) => PRIORITY_PILL[severity]?.label || severity || 'Trung bình';

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

  const markAllAsRead = async () => {
    const token = localStorage.getItem('token');
    // "Hệ thống" spans two backend types (news + system) — the endpoint only
    // filters by a single type, so scope with two calls for that tab.
    const typesToMark = activeTab === 'alerts' ? ['alert']
      : activeTab === 'personal' ? ['social']
      : activeTab === 'system' ? ['news', 'system']
      : [null];

    try {
      await Promise.all(typesToMark.map(type => fetch(
        `${API_BASE}/api/notifications/mark-all-read${type ? `?type=${type}` : ''}`,
        { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }
      )));
      fetchAllNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
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

  const combined = [...businessAlerts, ...systemNotifications].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const tabCounts = {
    all: combined.length,
    alerts: combined.filter(i => getTabForItem(i) === 'alerts').length,
    system: combined.filter(i => getTabForItem(i) === 'system').length,
    personal: combined.filter(i => getTabForItem(i) === 'personal').length,
  };

  let filteredItems = activeTab === 'all' ? combined : combined.filter(i => getTabForItem(i) === activeTab);
  if (priorityFilter) {
    filteredItems = filteredItems.filter(i => {
      const severity = i.type === 'business_alert' ? i.severity : (i.priority || 'medium');
      return getSeverityLabel(severity) === getSeverityLabel(priorityFilter);
    });
  }

  if (!currentUser) return null;

  return (
    <>
      <button
        className={`unified-bell-btn ${unreadCount > 0 ? 'has-alerts' : ''}`}
        onClick={() => setShowModal(true)}
        title={`${unreadCount} thông báo mới`}
        style={{
          position: 'relative', background: 'var(--bg-input)', border: '1px solid var(--border-neon)', borderRadius: '50%',
          width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.2s ease', color: 'var(--color-accent)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px', background: '#dc2626', color: 'white',
            fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '10px',
            minWidth: '18px', textAlign: 'center', boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '720px', padding: '28px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>

            <div className="edit-profile-header">
              <div className="edit-profile-icon-badge">
                <Bell size={24} />
              </div>
              <div>
                <h2>Thông báo</h2>
                <p>Cập nhật hoạt động, cảnh báo và tin tức dành cho bạn</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: `Tất cả (${tabCounts.all})`, icon: null },
                { key: 'alerts', label: `Cảnh báo (${tabCounts.alerts})`, icon: AlertTriangle },
                { key: 'system', label: `Hệ thống (${tabCounts.system})`, icon: Newspaper },
                { key: 'personal', label: `Cá nhân (${tabCounts.personal})`, icon: Heart },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px 12px',
                    background: activeTab === tab.key ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' : 'var(--bg-panel)',
                    border: `2px solid ${activeTab === tab.key ? 'var(--color-primary)' : 'var(--border-neon)'}`,
                    borderRadius: '10px', color: activeTab === tab.key ? 'white' : 'var(--text-main)',
                    fontSize: '13.5px', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  {tab.icon && <tab.icon size={14} />}
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button
                onClick={markAllAsRead}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px',
                  border: '2px solid var(--border-neon)', borderRadius: '10px', background: 'var(--bg-panel)',
                  color: 'var(--text-main)', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer'
                }}
              >
                <Check size={15} /> Đánh dấu đã đọc
              </button>

              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowFilterMenu(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px',
                    border: '2px solid var(--border-neon)', borderRadius: '10px', background: 'var(--bg-panel)',
                    color: 'var(--text-main)', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  <Filter size={15} /> {priorityFilter ? getSeverityLabel(priorityFilter) : 'Bộ lọc'} <ChevronDown size={14} />
                </button>
                {showFilterMenu && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setShowFilterMenu(false)} />
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: 'var(--bg-panel)',
                      border: '2px solid var(--border-neon)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                      zIndex: 20, minWidth: '160px', overflow: 'hidden'
                    }}>
                      {[null, 'high', 'medium', 'low'].map(level => (
                        <button
                          key={level || 'none'}
                          onClick={() => { setPriorityFilter(level); setShowFilterMenu(false); }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                            background: priorityFilter === level ? 'var(--bg-input)' : 'var(--bg-panel)', border: 'none',
                            color: priorityFilter === level ? 'var(--color-primary)' : 'var(--text-main)',
                            fontSize: '13.5px', fontWeight: 600, cursor: 'pointer'
                          }}
                        >
                          {level ? getSeverityLabel(level) : 'Tất cả mức độ'}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: '4px' }}>
              {loading ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  <div className="spinner" style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '14px', margin: 0 }}>Đang tải...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  <Bell size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                  <p style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>Không có thông báo nào</p>
                  <p style={{ fontSize: '13px', margin: '4px 0 0 0', opacity: 0.7 }}>Mọi thứ đều ổn định</p>
                </div>
              ) : (
                filteredItems.map((item, index) => {
                  const isBusinessAlert = item.type === 'business_alert';
                  const severity = isBusinessAlert ? item.severity : (item.priority || 'medium');
                  const pill = PRIORITY_PILL[severity] || PRIORITY_PILL.medium;
                  const style = getItemStyle(item);
                  const Icon = style.icon;
                  const itemKey = `${item.type}-${item.id || index}`;

                  return (
                    <div
                      key={itemKey}
                      style={{
                        display: 'flex', gap: '14px', padding: '16px', marginBottom: '12px',
                        border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)',
                        background: item.is_read === false || isBusinessAlert ? 'var(--bg-panel)' : 'var(--bg-dark-core)',
                        position: 'relative'
                      }}
                    >
                      {!item.is_read && (
                        <span style={{
                          position: 'absolute', top: '14px', left: '-4px', width: '8px', height: '8px',
                          borderRadius: '50%', background: isBusinessAlert ? '#dc2626' : '#22c55e'
                        }} />
                      )}

                      <div style={{
                        width: '48px', height: '48px', minWidth: '48px', borderRadius: '12px',
                        background: style.bg, color: style.color, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Icon size={22} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                          <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                            {isBusinessAlert ? item.business_name : item.title}
                          </p>
                          <span style={{
                            flexShrink: 0, fontSize: '12px', fontWeight: 700, padding: '3px 10px',
                            borderRadius: '20px', background: pill.bg, color: pill.color
                          }}>
                            {pill.label}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                          {item.message}
                        </p>
                        <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> {formatTime(item.created_at)}
                        </p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                        <button
                          onClick={() => toggleSaved(itemKey)}
                          title={savedIds.has(itemKey) ? 'Bỏ lưu' : 'Lưu thông báo'}
                          style={{
                            width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '2px solid var(--border-neon)', borderRadius: '8px', cursor: 'pointer',
                            background: savedIds.has(itemKey) ? 'var(--bg-input)' : 'var(--bg-panel)',
                            color: savedIds.has(itemKey) ? 'var(--color-primary)' : 'var(--text-dim)'
                          }}
                        >
                          <Bookmark size={16} fill={savedIds.has(itemKey) ? 'currentColor' : 'none'} />
                        </button>
                        {!isBusinessAlert && (
                          <button
                            onClick={() => deleteSystemNotification(item.id)}
                            title="Xóa thông báo"
                            style={{
                              width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: '2px solid rgba(239,68,68,0.3)', borderRadius: '8px', cursor: 'pointer',
                              background: 'var(--bg-panel)', color: '#ef4444'
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {filteredItems.length > 0 && (
              <button
                onClick={fetchAllNotifications}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%',
                  marginTop: '8px', padding: '12px', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-panel)', color: 'var(--color-primary)', fontSize: '14px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                <RefreshCw size={16} /> Làm mới
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default UnifiedNotificationBell;
