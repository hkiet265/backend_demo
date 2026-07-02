import { useState, useEffect } from 'react';

const DataQualityView = () => {
  const [summary, setSummary] = useState(null);
  const [outdatedData, setOutdatedData] = useState([]);
  const [missingData, setMissingData] = useState([]);
  const [invalidData, setInvalidData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState('overview');

  const API_BASE = '';

  const fetchDataQuality = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch all data quality metrics
      const [summaryRes, outdatedRes, missingRes, invalidRes] = await Promise.all([
        fetch(`${API_BASE}/api/ux/alerts/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/ux/alerts/outdated`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/ux/alerts/missing-fields?resource_type=business`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/ux/alerts/invalid-data`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const [summaryData, outdatedData, missingData, invalidData] = await Promise.all([
        summaryRes.json(),
        outdatedRes.json(),
        missingRes.json(),
        invalidRes.json()
      ]);

      if (summaryData.status === 'success') setSummary(summaryData.summary);
      if (outdatedData.status === 'success') setOutdatedData(outdatedData.alerts);
      if (missingData.status === 'success') setMissingData(missingData.alerts);
      if (invalidData.status === 'success') setInvalidData(invalidData.alerts);

    } catch (error) {
      console.error('Error fetching data quality:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataQuality();
    
    // Auto refresh every 10 minutes
    const interval = setInterval(fetchDataQuality, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const calculateQualityScore = () => {
    if (!summary) return 0;
    
    // Simple quality score calculation
    const total = summary.total_alerts;
    const critical = summary.by_severity.critical * 4;
    const error = summary.by_severity.error * 2;
    const warning = summary.by_severity.warning * 1;
    
    const penalty = critical + error + warning;
    const score = Math.max(0, 100 - penalty);
    
    return Math.round(score);
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10B981'; // Green
    if (score >= 70) return '#F59E0B'; // Orange
    if (score >= 50) return '#EF4444'; // Red
    return '#DC2626'; // Dark Red
  };

  const getScoreLabel = (score) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Poor';
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '20px auto' }}></div>
        <p>Loading data quality metrics...</p>
      </div>
    );
  }

  const qualityScore = calculateQualityScore();

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0' }}>📊 Data Quality Dashboard</h2>
          <p style={{ color: '#6B7280', margin: 0 }}>Monitor and improve your data quality</p>
        </div>
        <button
          onClick={fetchDataQuality}
          style={{
            padding: '10px 20px',
            background: '#FF8C42',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Quality Score Card */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        padding: '30px',
        color: 'white',
        marginBottom: '30px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '30px', alignItems: 'center' }}>
          {/* Score Circle */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '150px',
              height: '150px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              border: '8px solid rgba(255,255,255,0.3)'
            }}>
              <div style={{ fontSize: '48px', fontWeight: 'bold' }}>{qualityScore}</div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>/ 100</div>
            </div>
            <div style={{ marginTop: '10px', fontSize: '18px', fontWeight: 'bold' }}>
              {getScoreLabel(qualityScore)}
            </div>
          </div>

          {/* Metrics */}
          <div>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '24px' }}>Overall Data Quality</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '5px' }}>Total Issues</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{summary?.total_alerts || 0}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '5px' }}>Needs Attention</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{summary?.needs_attention || 0}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '5px' }}>Outdated Records</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{outdatedData.length}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '5px' }}>Missing Data</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{missingData.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '30px' }}>
        <div
          onClick={() => setActiveMetric('outdated')}
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            border: activeMetric === 'outdated' ? '2px solid #FF8C42' : '2px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏰</div>
          <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '5px' }}>Outdated Data</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#F59E0B' }}>{outdatedData.length}</div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '5px' }}>
            Records not updated in 180+ days
          </div>
        </div>

        <div
          onClick={() => setActiveMetric('missing')}
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            border: activeMetric === 'missing' ? '2px solid #FF8C42' : '2px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>📝</div>
          <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '5px' }}>Missing Fields</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3B82F6' }}>{missingData.length}</div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '5px' }}>
            Records with incomplete information
          </div>
        </div>

        <div
          onClick={() => setActiveMetric('invalid')}
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            border: activeMetric === 'invalid' ? '2px solid #FF8C42' : '2px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>❌</div>
          <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '5px' }}>Invalid Data</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#EF4444' }}>{invalidData.length}</div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '5px' }}>
            Records with format errors
          </div>
        </div>

        <div
          onClick={() => setActiveMetric('overview')}
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            border: activeMetric === 'overview' ? '2px solid #FF8C42' : '2px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>📈</div>
          <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '5px' }}>Quality Score</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: getScoreColor(qualityScore) }}>
            {qualityScore}%
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '5px' }}>
            Overall data health
          </div>
        </div>
      </div>

      {/* Detail Section */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {activeMetric === 'overview' && (
          <div>
            <h3 style={{ margin: '0 0 20px 0' }}>📊 Quality Breakdown</h3>
            
            {/* Severity Distribution */}
            {summary && (
              <div style={{ marginBottom: '30px' }}>
                <h4 style={{ fontSize: '16px', marginBottom: '15px', color: '#4B5563' }}>Severity Distribution</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  <div style={{ padding: '15px', background: '#EFF6FF', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3B82F6' }}>
                      {summary.by_severity.info}
                    </div>
                    <div style={{ fontSize: '12px', color: '#1E40AF', marginTop: '5px' }}>🔵 Info</div>
                  </div>
                  <div style={{ padding: '15px', background: '#FEF3C7', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F59E0B' }}>
                      {summary.by_severity.warning}
                    </div>
                    <div style={{ fontSize: '12px', color: '#92400E', marginTop: '5px' }}>🟡 Warning</div>
                  </div>
                  <div style={{ padding: '15px', background: '#FEE2E2', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#EF4444' }}>
                      {summary.by_severity.error}
                    </div>
                    <div style={{ fontSize: '12px', color: '#991B1B', marginTop: '5px' }}>🟠 Error</div>
                  </div>
                  <div style={{ padding: '15px', background: '#FEE2E2', borderRadius: '6px', textAlign: 'center', border: '2px solid #DC2626' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#DC2626' }}>
                      {summary.by_severity.critical}
                    </div>
                    <div style={{ fontSize: '12px', color: '#7F1D1D', marginTop: '5px' }}>🔴 Critical</div>
                  </div>
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div style={{ marginTop: '30px' }}>
              <h4 style={{ fontSize: '16px', marginBottom: '15px', color: '#4B5563' }}>💡 Recommendations</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {outdatedData.length > 10 && (
                  <div style={{ padding: '15px', background: '#FEF3C7', borderLeft: '4px solid #F59E0B', borderRadius: '6px' }}>
                    <strong style={{ color: '#92400E' }}>High Priority:</strong> {outdatedData.length} records haven't been updated in 180+ days. 
                    Consider contacting these businesses to verify they're still active.
                  </div>
                )}
                {missingData.length > 5 && (
                  <div style={{ padding: '15px', background: '#DBEAFE', borderLeft: '4px solid #3B82F6', borderRadius: '6px' }}>
                    <strong style={{ color: '#1E40AF' }}>Medium Priority:</strong> {missingData.length} records have missing critical information. 
                    Complete these fields to improve data quality.
                  </div>
                )}
                {invalidData.length > 0 && (
                  <div style={{ padding: '15px', background: '#FEE2E2', borderLeft: '4px solid #EF4444', borderRadius: '6px' }}>
                    <strong style={{ color: '#991B1B' }}>Fix Required:</strong> {invalidData.length} records have invalid data formats. 
                    Correct these to ensure data integrity.
                  </div>
                )}
                {qualityScore >= 90 && (
                  <div style={{ padding: '15px', background: '#D1FAE5', borderLeft: '4px solid #10B981', borderRadius: '6px' }}>
                    <strong style={{ color: '#065F46' }}>Great Job!</strong> Your data quality is excellent. 
                    Keep up the good work maintaining accurate records.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeMetric === 'outdated' && (
          <div>
            <h3 style={{ margin: '0 0 15px 0' }}>⏰ Outdated Data ({outdatedData.length})</h3>
            {outdatedData.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#10B981', padding: '40px' }}>
                ✅ No outdated data found!
              </p>
            ) : (
              <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                {outdatedData.slice(0, 10).map((item, idx) => (
                  <div key={idx} style={{ 
                    padding: '12px', 
                    borderBottom: '1px solid #E5E7EB',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: '500' }}>{item.resource_name}</div>
                      <div style={{ fontSize: '13px', color: '#6B7280' }}>{item.message}</div>
                    </div>
                    <button
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
                ))}
              </div>
            )}
          </div>
        )}

        {activeMetric === 'missing' && (
          <div>
            <h3 style={{ margin: '0 0 15px 0' }}>📝 Missing Fields ({missingData.length})</h3>
            {missingData.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#10B981', padding: '40px' }}>
                ✅ No missing data found!
              </p>
            ) : (
              <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                {missingData.slice(0, 10).map((item, idx) => (
                  <div key={idx} style={{ 
                    padding: '12px', 
                    borderBottom: '1px solid #E5E7EB',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: '500' }}>{item.resource_name}</div>
                      <div style={{ fontSize: '13px', color: '#6B7280' }}>{item.message}</div>
                    </div>
                    <button
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
                      Complete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeMetric === 'invalid' && (
          <div>
            <h3 style={{ margin: '0 0 15px 0' }}>❌ Invalid Data ({invalidData.length})</h3>
            {invalidData.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#10B981', padding: '40px' }}>
                ✅ No invalid data found!
              </p>
            ) : (
              <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                {invalidData.slice(0, 10).map((item, idx) => (
                  <div key={idx} style={{ 
                    padding: '12px', 
                    borderBottom: '1px solid #E5E7EB',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: '500' }}>{item.resource_name}</div>
                      <div style={{ fontSize: '13px', color: '#6B7280' }}>{item.message}</div>
                    </div>
                    <button
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
                      Correct
                    </button>
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

export default DataQualityView;
