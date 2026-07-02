import { useState } from 'react';
import { Search, Award, FileText, BarChart3, Globe, RefreshCw, Download } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

function EnrichmentView() {
  const [activeTab, setActiveTab] = useState('scraper'); // scraper, scoring, ner, clustering
  const [loading, setLoading] = useState(false);
  
  // Scraper state
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [scrapedData, setScrapedData] = useState(null);
  const [businessId, setBusinessId] = useState('');
  
  // Lead scoring state
  const [scoringBusinessId, setScoringBusinessId] = useState('');
  const [leadScore, setLeadScore] = useState(null);
  const [rankedBusinesses, setRankedBusinesses] = useState([]);
  const [minScore, setMinScore] = useState(70);
  
  // NER state
  const [nerNewsId, setNerNewsId] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [entities, setEntities] = useState(null);
  
  // Clustering state
  const [timeWindow, setTimeWindow] = useState(48);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.7);
  const [clusters, setClusters] = useState([]);
  const [clusterStats, setClusterStats] = useState(null);

  const getAuthToken = () => localStorage.getItem('token');

  // Website Scraper Functions
  const scrapeWebsite = async () => {
    if (!websiteUrl) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/enrichment/scrape-website?url=${encodeURIComponent(websiteUrl)}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        }
      );
      const data = await response.json();
      setScrapedData(data.data);
    } catch (error) {
      console.error('Scrape error:', error);
      alert('Lỗi khi scrape website');
    } finally {
      setLoading(false);
    }
  };

  const enrichBusiness = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/enrichment/enrich-business/${businessId}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        }
      );
      const data = await response.json();
      alert(data.message || 'Đã cập nhật thông tin doanh nghiệp');
      setScrapedData(data.scraped_data);
    } catch (error) {
      console.error('Enrich error:', error);
      alert('Lỗi khi enrich business');
    } finally {
      setLoading(false);
    }
  };

  // Lead Scoring Functions
  const getLeadScore = async () => {
    if (!scoringBusinessId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/enrichment/lead-score/${scoringBusinessId}`,
        { headers: { 'Authorization': `Bearer ${getAuthToken()}` } }
      );
      const data = await response.json();
      setLeadScore(data);
    } catch (error) {
      console.error('Lead score error:', error);
      alert('Lỗi khi tính lead score');
    } finally {
      setLoading(false);
    }
  };

  const getRankedBusinesses = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/enrichment/rank-businesses?page=1&page_size=50&min_score=${minScore}`,
        { headers: { 'Authorization': `Bearer ${getAuthToken()}` } }
      );
      const data = await response.json();
      setRankedBusinesses(data.data || []);
    } catch (error) {
      console.error('Ranking error:', error);
      alert('Lỗi khi lấy danh sách ranking');
    } finally {
      setLoading(false);
    }
  };

  // NER Functions
  const extractEntities = async () => {
    if (!nerNewsId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/enrichment/extract-entities?news_id=${nerNewsId}&use_ai=${useAI}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        }
      );
      const data = await response.json();
      setEntities(data);
    } catch (error) {
      console.error('NER error:', error);
      alert('Lỗi khi extract entities');
    } finally {
      setLoading(false);
    }
  };

  // Clustering Functions
  const clusterNews = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/enrichment/cluster-news?time_window_hours=${timeWindow}&similarity_threshold=${similarityThreshold}`,
        { headers: { 'Authorization': `Bearer ${getAuthToken()}` } }
      );
      const data = await response.json();
      setClusters(data.data || []);
      setClusterStats(data.stats);
    } catch (error) {
      console.error('Clustering error:', error);
      alert('Lỗi khi gom cụm tin tức');
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade) => {
    const colors = {
      'A': '#10b981',
      'B': '#3b82f6',
      'C': '#f59e0b',
      'D': '#f97316',
      'F': '#ef4444'
    };
    return colors[grade] || '#6b7280';
  };

  return (
    <div className="enrichment-view">
      <div className="admin-header">
        <h2>🔬 AI Enrichment & Analytics</h2>
        <p className="admin-subtitle">Website Scraping • Lead Scoring • NER • News Clustering</p>
      </div>

      {/* Tabs */}
      <div className="enrichment-tabs">
        <button
          className={`enrichment-tab ${activeTab === 'scraper' ? 'active' : ''}`}
          onClick={() => setActiveTab('scraper')}
        >
          <Globe size={18} />
          Website Scraper
        </button>
        <button
          className={`enrichment-tab ${activeTab === 'scoring' ? 'active' : ''}`}
          onClick={() => setActiveTab('scoring')}
        >
          <Award size={18} />
          Lead Scoring
        </button>
        <button
          className={`enrichment-tab ${activeTab === 'ner' ? 'active' : ''}`}
          onClick={() => setActiveTab('ner')}
        >
          <FileText size={18} />
          NER
        </button>
        <button
          className={`enrichment-tab ${activeTab === 'clustering' ? 'active' : ''}`}
          onClick={() => setActiveTab('clustering')}
        >
          <BarChart3 size={18} />
          News Clustering
        </button>
      </div>

      {/* Website Scraper Tab */}
      {activeTab === 'scraper' && (
        <div className="enrichment-content">
          <div className="enrichment-section">
            <h3>🌐 Scrape Website</h3>
            <p>Thu thập thông tin từ website (email, phone, social links)</p>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <input
                type="url"
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                style={{ flex: 1 }}
                className="admin-input"
              />
              <button onClick={scrapeWebsite} disabled={loading} className="admin-button-primary">
                {loading ? <RefreshCw size={18} className="spinning" /> : <Search size={18} />}
                Scrape
              </button>
            </div>

            {scrapedData && (
              <div className="result-box" style={{ marginTop: '20px' }}>
                <h4>📊 Kết quả:</h4>
                {scrapedData.success ? (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div><strong>Title:</strong> {scrapedData.title || 'N/A'}</div>
                    <div><strong>Description:</strong> {scrapedData.description || 'N/A'}</div>
                    <div><strong>Emails:</strong> {scrapedData.emails?.join(', ') || 'None'}</div>
                    <div><strong>Phones:</strong> {scrapedData.phones?.join(', ') || 'None'}</div>
                    <div><strong>Facebook:</strong> {scrapedData.facebook || 'None'}</div>
                    <div><strong>LinkedIn:</strong> {scrapedData.linkedin || 'None'}</div>
                  </div>
                ) : (
                  <div style={{ color: '#ef4444' }}>❌ {scrapedData.error}</div>
                )}
              </div>
            )}
          </div>

          <div className="enrichment-section">
            <h3>🔄 Enrich Business</h3>
            <p>Tự động cập nhật thông tin doanh nghiệp từ website</p>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <input
                type="number"
                placeholder="Business ID"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className="admin-input"
                style={{ width: '200px' }}
              />
              <button onClick={enrichBusiness} disabled={loading} className="admin-button-primary">
                <RefreshCw size={18} />
                Enrich
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead Scoring Tab */}
      {activeTab === 'scoring' && (
        <div className="enrichment-content">
          <div className="enrichment-section">
            <h3>🎯 Lead Score</h3>
            <p>Chấm điểm doanh nghiệp (0-100) dựa trên nhiều yếu tố</p>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <input
                type="number"
                placeholder="Business ID"
                value={scoringBusinessId}
                onChange={(e) => setScoringBusinessId(e.target.value)}
                className="admin-input"
                style={{ width: '200px' }}
              />
              <button onClick={getLeadScore} disabled={loading} className="admin-button-primary">
                <Award size={18} />
                Tính Điểm
              </button>
            </div>

            {leadScore && leadScore.lead_score && (
              <div className="result-box" style={{ marginTop: '20px' }}>
                <h4>📊 {leadScore.business_name}</h4>
                <div style={{ display: 'flex', gap: '20px', marginTop: '16px', alignItems: 'center' }}>
                  <div style={{ 
                    fontSize: '48px', 
                    fontWeight: '700',
                    color: getGradeColor(leadScore.lead_score.grade)
                  }}>
                    {leadScore.lead_score.total_score}
                  </div>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: '700',
                    padding: '8px 20px',
                    borderRadius: '12px',
                    background: getGradeColor(leadScore.lead_score.grade) + '20',
                    color: getGradeColor(leadScore.lead_score.grade)
                  }}>
                    Grade {leadScore.lead_score.grade}
                  </div>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <h5>Breakdown:</h5>
                  <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
                    {Object.entries(leadScore.lead_score.breakdown).map(([key, value]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ width: '150px', textTransform: 'capitalize' }}>{key}:</span>
                        <div style={{ 
                          flex: 1, 
                          height: '24px', 
                          background: '#f3f4f6',
                          borderRadius: '6px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${(value / 30) * 100}%`,
                            background: 'linear-gradient(135deg, #FF8C42, #FF7A2F)',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                        <span style={{ width: '40px', textAlign: 'right', fontWeight: '600' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="enrichment-section">
            <h3>📊 Ranked Businesses</h3>
            <p>Danh sách doanh nghiệp xếp hạng theo lead score</p>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', alignItems: 'center' }}>
              <label>Min Score:</label>
              <input
                type="number"
                min="0"
                max="100"
                value={minScore}
                onChange={(e) => setMinScore(parseInt(e.target.value))}
                className="admin-input"
                style={{ width: '100px' }}
              />
              <button onClick={getRankedBusinesses} disabled={loading} className="admin-button-primary">
                <BarChart3 size={18} />
                Get Rankings
              </button>
            </div>

            {rankedBusinesses.length > 0 && (
              <div className="result-box" style={{ marginTop: '20px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Doanh nghiệp</th>
                        <th>Ngành nghề</th>
                        <th>Vùng</th>
                        <th>Score</th>
                        <th>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedBusinesses.map((biz, idx) => (
                        <tr key={biz.id}>
                          <td style={{ fontWeight: '700' }}>#{idx + 1}</td>
                          <td>{biz.ten_doanh_nghiep}</td>
                          <td>{biz.nganh_nghe || 'N/A'}</td>
                          <td>{biz.vung_mien || 'N/A'}</td>
                          <td style={{ fontWeight: '700' }}>{biz.lead_score}</td>
                          <td>
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '6px',
                              fontWeight: '700',
                              background: getGradeColor(biz.lead_grade) + '20',
                              color: getGradeColor(biz.lead_grade)
                            }}>
                              {biz.lead_grade}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NER Tab */}
      {activeTab === 'ner' && (
        <div className="enrichment-content">
          <div className="enrichment-section">
            <h3>🏷️ Named Entity Recognition</h3>
            <p>Trích xuất địa danh, tổ chức, nhân vật từ tin tức</p>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', alignItems: 'center' }}>
              <input
                type="number"
                placeholder="News ID"
                value={nerNewsId}
                onChange={(e) => setNerNewsId(e.target.value)}
                className="admin-input"
                style={{ width: '200px' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={useAI}
                  onChange={(e) => setUseAI(e.target.checked)}
                />
                Use AI (chậm hơn, chính xác hơn)
              </label>
              <button onClick={extractEntities} disabled={loading} className="admin-button-primary">
                <FileText size={18} />
                Extract
              </button>
            </div>

            {entities && entities.entities && (
              <div className="result-box" style={{ marginTop: '20px' }}>
                <h4>📋 Entities (News #{entities.news_id})</h4>
                <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
                  {Object.entries(entities.entities).map(([type, items]) => (
                    items && items.length > 0 && (
                      <div key={type}>
                        <h5 style={{ marginBottom: '8px', textTransform: 'capitalize' }}>
                          {type} ({items.length})
                        </h5>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {items.map((item, idx) => (
                            <span key={idx} className="entity-tag">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clustering Tab */}
      {activeTab === 'clustering' && (
        <div className="enrichment-content">
          <div className="enrichment-section">
            <h3>📊 News Clustering</h3>
            <p>Gom cụm tin tức tương tự để phát hiện trùng lặp</p>
            
            <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={{ width: '150px' }}>Time Window (hours):</label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(parseInt(e.target.value))}
                  className="admin-input"
                  style={{ width: '100px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={{ width: '150px' }}>Similarity (0-1):</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={similarityThreshold}
                  onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                  className="admin-input"
                  style={{ width: '100px' }}
                />
              </div>
              <button onClick={clusterNews} disabled={loading} className="admin-button-primary" style={{ width: 'fit-content' }}>
                <BarChart3 size={18} />
                Cluster News
              </button>
            </div>

            {clusterStats && (
              <div className="stats-grid" style={{ marginTop: '20px' }}>
                <div className="stat-card">
                  <div className="stat-value">{clusterStats.total_news}</div>
                  <div className="stat-label">Total News</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{clusterStats.num_clusters}</div>
                  <div className="stat-label">Clusters</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{clusterStats.num_duplicate_groups}</div>
                  <div className="stat-label">Duplicate Groups</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{clusterStats.num_duplicates}</div>
                  <div className="stat-label">Duplicates</div>
                </div>
              </div>
            )}

            {clusters.length > 0 && (
              <div className="result-box" style={{ marginTop: '20px' }}>
                <h4>🔍 Duplicate Groups ({clusters.length})</h4>
                <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
                  {clusters.map((cluster, idx) => (
                    <div key={idx} className="cluster-card">
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'start',
                        marginBottom: '12px'
                      }}>
                        <h5 style={{ margin: 0, flex: 1 }}>{cluster.title}</h5>
                        <span style={{
                          background: '#FF8C42',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}>
                          {cluster.count} articles
                        </span>
                      </div>
                      <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                        {cluster.summary}
                      </p>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>
                        📰 {cluster.sources.join(', ')} • 🕒 {cluster.time_range}
                      </div>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {cluster.articles.map((article) => (
                          <div key={article.id} style={{
                            padding: '8px 12px',
                            background: '#f9fafb',
                            borderRadius: '6px',
                            fontSize: '13px'
                          }}>
                            <strong>{article.nha_dai}:</strong> {article.tieu_de}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EnrichmentView;
