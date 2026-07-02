import { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, Clock, X, Newspaper, Heart, Settings, Check, Trash2, Filter } from 'lucide-react';

/**
 * UnifiedNotificationBell - Multi-tab notification center
 * Supports: Alerts, News, Social interactions
 */
const NotificationBell = ({ currentUser }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all, alert, news, social
  const [unreadCounts, setUnreadCounts] = useState({});
  const [filter, setFilter] = useState('unread'); // all, unread, today
  const popoverRef = useRef(null);

  const API_BASE = 'http://127.0.0.1:8000';

  // Fetch notifications
  const fetchNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setLoading(true);
      
      // Get notifications
      const notifResponse = await fetch(`${API_BASE}/api/notifications/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!notifResponse.ok) return;

      const notifData = await notifResponse.json();
      setNotifications(notifData.notifications || []);

      // Get unread counts by type
      const countResponse = await fetch(`${API_BASE}/api/notifications/unread-count?by_type=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (countResponse.ok) {
        const countData = await countResponse.json();
        setUnreadCounts(countData.counts || {});
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
      // Auto-refresh every 2 minutes
      const interval = setInterval(fetchNotifications, 2 * 60 * 1000);
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

  const markAsRead = async (notificationId) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const token = localStorage.getItem('token');
    const type = activeTab === 'all' ? null : activeTab;
    
    try {
      await fetch(`${API_BASE}/api/notifications/mark-all-read${type ? `?type=${type}` : ''}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`${API_BASE}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // Navigate if has link
    if (notification.link) {
      window.location.href = notification.link;
    }
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    // Filter by tab
    if (activeTab !== 'all' && n.type !== activeTab) return false;
    
    // Filter by read status
    if (filter === 'unread' && n.is_read) return false;
    
    // Filter by date
    if (filter === 'today') {
      const today = new Date().toDateString();
      const notifDate = new Date(n.created_at).toDateString();
      if (today !== notifDate) return false;
    }
    
    return true;
  });

  const getTypeIcon = (type) => {
    const icons = {
      alert: <AlertTriangle size={16} />,
      news: <Newspaper size={16} />,
      social: <Heart size={16} />,
      system: <Settings size={16} />
    };
    return icons[type] || <Bell size={16} />;
  };

  const getTypeLabel = (type) => {
    const labels = {
      alert: 'Cảnh báo',
      news: 'Tin tức',
      social: 'Tương tác',
      system: 'Hệ thống'
    };
    return labels[type] || type;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      urgent: '#dc2626',
      high: '#ea580c',
      medium: '#f59e0b',
      low: '#84cc16'
    };
    return colors[priority] || '#6b7280';
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

  if (!currentUser) return null;

  const totalUnread = unreadCounts.total || 0;

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      <button
        className="notification-bell-btn"
        onClick={() => setShowPopover(!showPopover)}
        title={`${totalUnread} thông báo chưa đọc`}
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
      >
        <Bell size={20} />
        {totalUnread > 0 && (
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
            animation: totalUnread > 0 ? 'pulse 2s infinite' : 'none'
          }}>
            {totalUnread > 99 ? '99+' : totalUnread}
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
            background: 'var(--bg-input)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>
                🔔 Thông báo
              </h3>
              <button onClick={() => setShowPopover(false)} style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-dim)',
                padding: '4px',
                display: 'flex'
              }}>
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {['all', 'alert', 'news', 'social'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: activeTab === tab ? 'linear-gradient(135deg, #FF8C42, #FF7A2F)' : 'transparent',
                    border: `2px solid ${activeTab === tab ? '#FF8C42' : 'var(--border-neon)'}`,
                    borderRadius: '8px',
                    color: activeTab === tab ? 'white' : 'var(--text-main)',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  {tab === 'all' ? 'Tất cả' : getTypeLabel(tab)}
                  {unreadCounts[tab] > 0 && (
                    <span style={{
                      background: activeTab === tab ? 'rgba(255,255,255,0.3)' : '#dc2626',
                      color: 'white',
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      minWidth: '16px',
                      textAlign: 'center'
                    }}>
                      {unreadCounts[tab]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Filter & Actions */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  background: 'var(--bg-panel)',
                  border: '2px solid var(--border-neon)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                <option value="all">Tất cả</option>
                <option value="unread">Chưa đọc</option>
                <option value="today">Hôm nay</option>
              </select>
              
              {filteredNotifications.some(n => !n.is_read) && (
                <button
                  onClick={markAllAsRead}
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '2px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    color: '#3b82f6',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Check size={14} />
                  Đọc hết
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '450px' }}>
            {loading ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: '14px', margin: 0 }}>Đang tải...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                <Bell size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>Không có thông báo</p>
                <p style={{ fontSize: '13px', margin: '4px 0 0 0', opacity: 0.7 }}>
                  {filter === 'unread' ? 'Bạn đã đọc hết rồi! 🎉' : 'Chưa có thông báo nào'}
                </p>
              </div>
            ) : (
              <div style={{ padding: '8px' }}>
                {filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    style={{
                      padding: '12px',
                      margin: '8px 0',
                      background: notif.is_read ? 'var(--bg-input)' : 'rgba(255, 140, 66, 0.08)',
                      border: `2px solid ${notif.is_read ? 'var(--border-neon)' : getPriorityColor(notif.priority)}`,
                      borderLeft: `6px solid ${getPriorityColor(notif.priority)}`,
                      borderRadius: '8px',
                      cursor: notif.link ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (notif.link) {
                        e.currentTarget.style.transform = 'translateX(4px)';
                        e.currentTarget.style.boxShadow = `0 4px 12px ${getPriorityColor(notif.priority)}40`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif.id);
                      }}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
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
                    >
                      <Trash2 size={14} />
                    </button>

                    <div style={{ display: 'flex', gap: '10px', paddingRight: '30px' }}>
                      <div style={{
                        fontSize: '20px',
                        lineHeight: 1,
                        flexShrink: 0
                      }}>
                        {notif.icon}
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            padding: '2px 6px',
                            borderRadius: '6px',
                            background: getPriorityColor(notif.priority),
                            color: 'white',
                            textTransform: 'uppercase'
                          }}>
                            {getTypeLabel(notif.type)}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                            <Clock size={11} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                            {formatTime(notif.created_at)}
                          </span>
                        </div>
                        
                        <p style={{
                          margin: '0 0 4px 0',
                          fontSize: '14px',
                          fontWeight: notif.is_read ? '500' : '700',
                          color: 'var(--text-main)',
                          lineHeight: '1.4'
                        }}>
                          {notif.title}
                        </p>
                        
                        <p style={{
                          margin: 0,
                          fontSize: '13px',
                          color: 'var(--text-dim)',
                          lineHeight: '1.5'
                        }}>
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {filteredNotifications.length > 0 && (
            <div style={{
              padding: '12px 16px',
              borderTop: '2px solid var(--border-neon)',
              background: 'var(--bg-input)',
              display: 'flex',
              gap: '8px',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                Hiển thị {filteredNotifications.length} thông báo
              </div>
              <button
                onClick={fetchNotifications}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
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

export default NotificationBell;
