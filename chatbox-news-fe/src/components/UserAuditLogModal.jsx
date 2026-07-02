import { useState, useEffect } from 'react';
import { X, FileText, Clock, User as UserIcon, TrendingUp } from 'lucide-react';
import { createPortal } from 'react-dom';

/**
 * UserAuditLogModal - Shows audit log history for a specific business
 * User can see all changes made to their business
 */
const UserAuditLogModal = ({ business, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  const API_BASE = '';

  useEffect(() => {
    if (business) {
      fetchAuditLogs();
    }
  }, [business]);

  const fetchAuditLogs = async () => {
    const token = localStorage.getItem('token');
    if (!token || !business) return;

    try {
      setLoading(true);
      
      // Fetch audit logs for this business
      const response = await fetch(
        `${API_BASE}/api/ux/audit-logs?entity_type=business&entity_id=${business.id}&limit=50`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch audit logs');

      const data = await response.json();
      setLogs(data.logs || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionBadge = (action) => {
    const badges = {
      create: { label: 'Tạo mới', color: '#10b981', icon: '➕' },
      update: { label: 'Cập nhật', color: '#3b82f6', icon: '✏️' },
      delete: { label: 'Xóa', color: '#ef4444', icon: '🗑️' }
    };
    return badges[action] || { label: action, color: '#6b7280', icon: '📝' };
  };

  const renderChanges = (log) => {
    if (!log.changes || Object.keys(log.changes).length === 0) {
      return <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>Không có chi tiết thay đổi</p>;
    }

    return (
      <div style={{ marginTop: '8px' }}>
        {Object.entries(log.changes).map(([field, change], idx) => (
          <div
            key={idx}
            style={{
              padding: '8px 12px',
              background: 'rgba(255, 140, 66, 0.05)',
              borderRadius: '6px',
              marginBottom: '6px',
              fontSize: '13px'
            }}
          >
            <div style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>
              📌 {field}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {change.old !== null && (
                <div style={{ flex: 1 }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: '11px', textTransform: 'uppercase' }}>
                    Cũ:
                  </span>
                  <div style={{
                    marginTop: '2px',
                    padding: '4px 8px',
                    background: '#fee',
                    color: '#c00',
                    borderRadius: '4px',
                    fontSize: '12px',
                    wordBreak: 'break-word'
                  }}>
                    {String(change.old)}
                  </div>
                </div>
              )}
              <div style={{ color: 'var(--text-dim)' }}>→</div>
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Mới:
                </span>
                <div style={{
                  marginTop: '2px',
                  padding: '4px 8px',
                  background: '#efe',
                  color: '#060',
                  borderRadius: '4px',
                  fontSize: '12px',
                  wordBreak: 'break-word'
                }}>
                  {String(change.new)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!business) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 2000 }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '800px',
          width: '95%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '16px',
          borderBottom: '2px solid var(--border-neon)',
          marginBottom: '20px'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '700',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FileText size={24} style={{ color: 'var(--color-primary)' }} />
              Lịch sử thay đổi
            </h2>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: 'var(--text-dim)'
            }}>
              {business.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="modal-close"
            style={{ position: 'static' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <div style={{
              padding: '12px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
              border: '2px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
                {stats.total_logs || 0}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                Tổng thay đổi
              </div>
            </div>
            <div style={{
              padding: '12px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
                {stats.recent_changes || 0}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                7 ngày qua
              </div>
            </div>
          </div>
        )}

        {/* Logs Timeline */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          paddingRight: '8px'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: '14px', margin: 0 }}>Đang tải lịch sử...</p>
            </div>
          ) : logs.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: 'var(--text-dim)'
            }}>
              <FileText size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <p style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>
                Chưa có lịch sử thay đổi
              </p>
              <p style={{ fontSize: '13px', margin: '4px 0 0 0', opacity: 0.7 }}>
                Các thay đổi sẽ được ghi lại tại đây
              </p>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Timeline line */}
              <div style={{
                position: 'absolute',
                left: '20px',
                top: '20px',
                bottom: '20px',
                width: '2px',
                background: 'linear-gradient(to bottom, var(--color-primary), transparent)',
                zIndex: 0
              }} />

              {logs.map((log, index) => {
                const badge = getActionBadge(log.action);
                return (
                  <div
                    key={log.id || index}
                    style={{
                      position: 'relative',
                      marginLeft: '40px',
                      marginBottom: '24px',
                      paddingLeft: '20px'
                    }}
                  >
                    {/* Timeline dot */}
                    <div style={{
                      position: 'absolute',
                      left: '-28px',
                      top: '8px',
                      width: '16px',
                      height: '16px',
                      background: badge.color,
                      borderRadius: '50%',
                      border: '3px solid var(--bg-panel)',
                      zIndex: 1,
                      boxShadow: `0 0 0 2px ${badge.color}`
                    }} />

                    {/* Log card */}
                    <div style={{
                      padding: '16px',
                      background: 'var(--bg-input)',
                      border: '2px solid var(--border-neon)',
                      borderRadius: '12px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = badge.color;
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-neon)';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: '8px'
                      }}>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          background: badge.color,
                          color: 'white',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span>{badge.icon}</span>
                          {badge.label}
                        </span>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text-dim)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Clock size={14} />
                          {formatDate(log.timestamp)}
                        </div>
                      </div>

                      {log.performed_by && (
                        <div style={{
                          fontSize: '13px',
                          color: 'var(--text-dim)',
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <UserIcon size={14} />
                          <span>{log.performed_by}</span>
                        </div>
                      )}

                      {renderChanges(log)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '2px solid var(--border-neon)',
          textAlign: 'center'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #FF8C42, #FF7A2F)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #FF7A2F, #FF6B1F)';
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 4px 12px rgba(255, 122, 47, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #FF8C42, #FF7A2F)';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default UserAuditLogModal;
