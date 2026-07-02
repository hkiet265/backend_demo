import { useState, useEffect } from 'react';

const AuditLogView = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    resource_type: '',
    action: '',
    user_id: '',
    page: 1,
    page_size: 20
  });
  const [selectedLog, setSelectedLog] = useState(null);

  const API_BASE = 'http://127.0.0.1:8000';

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Build query params
      const params = new URLSearchParams();
      if (filters.resource_type) params.append('resource_type', filters.resource_type);
      if (filters.action) params.append('action', filters.action);
      if (filters.user_id) params.append('user_id', filters.user_id);
      params.append('page', filters.page);
      params.append('page_size', filters.page_size);

      const response = await fetch(`${API_BASE}/api/ux/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        setLogs(data.data);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const getActionColor = (action) => {
    const colors = {
      CREATE: '#10B981',
      UPDATE: '#F59E0B',
      DELETE: '#EF4444',
      LOGIN: '#3B82F6',
      LOGOUT: '#6B7280'
    };
    return colors[action] || '#6B7280';
  };

  const getActionIcon = (action) => {
    const icons = {
      CREATE: '➕',
      UPDATE: '✏️',
      DELETE: '🗑️',
      LOGIN: '🔓',
      LOGOUT: '🔒',
      VIEW: '👁️'
    };
    return icons[action] || '📝';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN');
  };

  const renderDiff = (oldValue, newValue, changes) => {
    if (!oldValue || !newValue) return null;

    return (
      <div style={{ marginTop: '15px', padding: '15px', background: '#F9FAFB', borderRadius: '6px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#374151' }}>📊 Changes Detail</h4>
        
        {changes && changes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {changes.map((change, idx) => (
              <div key={idx} style={{ 
                padding: '8px', 
                background: 'white', 
                borderRadius: '4px',
                borderLeft: '3px solid #F59E0B'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>
                  {change.field}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', fontSize: '12px' }}>
                  <div style={{ padding: '4px 8px', background: '#FEE2E2', borderRadius: '3px', color: '#991B1B' }}>
                    <strong>Old:</strong> {JSON.stringify(change.old)}
                  </div>
                  <div style={{ alignSelf: 'center' }}>→</div>
                  <div style={{ padding: '4px 8px', background: '#D1FAE5', borderRadius: '3px', color: '#065F46' }}>
                    <strong>New:</strong> {JSON.stringify(change.new)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <strong style={{ fontSize: '12px', color: '#6B7280' }}>OLD VALUE:</strong>
              <pre style={{ 
                margin: '5px 0 0 0', 
                padding: '8px', 
                background: '#FEE2E2', 
                borderRadius: '4px',
                fontSize: '11px',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                {JSON.stringify(oldValue, null, 2)}
              </pre>
            </div>
            <div>
              <strong style={{ fontSize: '12px', color: '#6B7280' }}>NEW VALUE:</strong>
              <pre style={{ 
                margin: '5px 0 0 0', 
                padding: '8px', 
                background: '#D1FAE5', 
                borderRadius: '4px',
                fontSize: '11px',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                {JSON.stringify(newValue, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>📜 Audit Logs</h2>
        <p style={{ color: '#6B7280', margin: 0 }}>Track all system changes and user activities</p>
      </div>

      {/* Filters */}
      <div style={{ 
        background: 'white', 
        padding: '20px', 
        borderRadius: '8px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '5px' }}>
              Resource Type
            </label>
            <select
              value={filters.resource_type}
              onChange={(e) => setFilters({ ...filters, resource_type: e.target.value, page: 1 })}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">All</option>
              <option value="BUSINESS">Business</option>
              <option value="NEWS">News</option>
              <option value="USER">User</option>
              <option value="CHAT">Chat</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '5px' }}>
              Action
            </label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">All</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="IMPORT">Import</option>
              <option value="EXPORT">Export</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '5px' }}>
              User ID
            </label>
            <input
              type="number"
              value={filters.user_id}
              onChange={(e) => setFilters({ ...filters, user_id: e.target.value, page: 1 })}
              placeholder="Filter by user..."
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => {
                setFilters({ resource_type: '', action: '', user_id: '', page: 1, page_size: 20 });
              }}
              style={{
                width: '100%',
                padding: '8px',
                background: '#6B7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Logs Timeline */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '10px' }}>Loading audit logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          background: 'white', 
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p style={{ fontSize: '18px' }}>📭 No audit logs found</p>
          <p style={{ color: '#6B7280' }}>Try adjusting your filters</p>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Timeline Line */}
          <div style={{
            position: 'absolute',
            left: '20px',
            top: '0',
            bottom: '0',
            width: '2px',
            background: '#E5E7EB'
          }} />

          {/* Log Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {logs.map((log, idx) => (
              <div
                key={log.id}
                style={{
                  marginLeft: '40px',
                  background: 'white',
                  padding: '15px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  position: 'relative',
                  cursor: 'pointer',
                  border: selectedLog?.id === log.id ? '2px solid #FF8C42' : '1px solid #E5E7EB'
                }}
                onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
              >
                {/* Timeline Dot */}
                <div style={{
                  position: 'absolute',
                  left: '-28px',
                  top: '20px',
                  width: '16px',
                  height: '16px',
                  background: getActionColor(log.action),
                  borderRadius: '50%',
                  border: '3px solid white',
                  boxShadow: '0 0 0 2px #E5E7EB'
                }} />

                {/* Log Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                      <span style={{ fontSize: '20px' }}>{getActionIcon(log.action)}</span>
                      <span style={{
                        padding: '2px 8px',
                        background: getActionColor(log.action),
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {log.action}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        background: '#F3F4F6',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#6B7280'
                      }}>
                        {log.resource_type}
                      </span>
                      {log.resource_id && (
                        <span style={{ fontSize: '12px', color: '#6B7280' }}>
                          #{log.resource_id}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '14px', color: '#4B5563' }}>
                      <strong>{log.username}</strong> (User ID: {log.user_id})
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '12px', color: '#6B7280' }}>
                    <div>{formatDate(log.created_at)}</div>
                    {log.ip_address && (
                      <div style={{ marginTop: '3px' }}>
                        🌐 {log.ip_address}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedLog?.id === log.id && (
                  <>
                    {log.details && (
                      <div style={{ 
                        marginTop: '10px', 
                        padding: '10px', 
                        background: '#F9FAFB', 
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}>
                        <strong>Details:</strong> {log.details}
                      </div>
                    )}
                    
                    {log.user_agent && (
                      <div style={{ 
                        marginTop: '10px', 
                        padding: '10px', 
                        background: '#F9FAFB', 
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#6B7280'
                      }}>
                        <strong>User Agent:</strong> {log.user_agent}
                      </div>
                    )}

                    {(log.old_value || log.new_value) && renderDiff(log.old_value, log.new_value, log.changes)}
                  </>
                )}

                {/* Click hint */}
                {selectedLog?.id !== log.id && (log.old_value || log.new_value || log.details) && (
                  <div style={{ 
                    marginTop: '10px', 
                    fontSize: '12px', 
                    color: '#6B7280',
                    fontStyle: 'italic'
                  }}>
                    Click to view details →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && logs.length > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '10px', 
          marginTop: '20px',
          padding: '20px'
        }}>
          <button
            onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
            disabled={filters.page === 1}
            style={{
              padding: '8px 16px',
              background: filters.page === 1 ? '#E5E7EB' : '#FF8C42',
              color: filters.page === 1 ? '#9CA3AF' : 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: filters.page === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            ← Previous
          </button>
          <span style={{ 
            padding: '8px 16px', 
            background: 'white', 
            borderRadius: '6px',
            border: '1px solid #E5E7EB'
          }}>
            Page {filters.page}
          </span>
          <button
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            disabled={logs.length < filters.page_size}
            style={{
              padding: '8px 16px',
              background: logs.length < filters.page_size ? '#E5E7EB' : '#FF8C42',
              color: logs.length < filters.page_size ? '#9CA3AF' : 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: logs.length < filters.page_size ? 'not-allowed' : 'pointer'
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default AuditLogView;
