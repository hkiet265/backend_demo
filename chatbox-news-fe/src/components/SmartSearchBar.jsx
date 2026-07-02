import { useState, useEffect, useRef } from 'react';

const SmartSearchBar = ({ onResultsFound }) => {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);

  const API_BASE = 'http://127.0.0.1:8000';

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults(null);
      return;
    }

    setSearching(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE}/api/ux/search/nlp?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const data = await response.json();
      if (data.status === 'success') {
        setResults(data);
        
        // Save to recent searches
        const newRecent = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
        setRecentSearches(newRecent);
        localStorage.setItem('recentSearches', JSON.stringify(newRecent));
        
        // Notify parent component
        if (onResultsFound) {
          onResultsFound(data);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    performSearch(query);
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    performSearch(suggestion);
    setShowSuggestions(false);
  };

  const getIntentIcon = (intent) => {
    const icons = {
      find_business: '🏢',
      find_news: '📰',
      compare: '⚖️',
      unknown: '🔍'
    };
    return icons[intent] || '🔍';
  };

  const getIntentLabel = (intent) => {
    const labels = {
      find_business: 'Tìm doanh nghiệp',
      find_news: 'Tìm tin tức',
      compare: 'So sánh',
      unknown: 'Không xác định'
    };
    return labels[intent] || intent;
  };

  return (
    <div ref={searchRef} style={{ maxWidth: '900px', margin: '0 auto', position: 'relative' }}>
      {/* Search Form */}
      <form onSubmit={handleSubmit}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          border: '2px solid ' + (results ? '#FF8C42' : '#E5E7EB')
        }}>
          <span style={{ fontSize: '24px', marginLeft: '8px' }}>🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Tìm kiếm thông minh... (VD: Tìm công ty công nghệ ở Hà Nội)"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '16px',
              padding: '8px'
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px',
                color: '#6B7280'
              }}
            >
              ✕
            </button>
          )}
          <button
            type="submit"
            disabled={searching || !query.trim()}
            style={{
              background: searching || !query.trim() ? '#D1D5DB' : '#FF8C42',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: searching || !query.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {searching ? 'Đang tìm...' : 'Tìm kiếm'}
          </button>
        </div>
      </form>

      {/* Recent Searches & Suggestions Dropdown */}
      {showSuggestions && (recentSearches.length > 0 || results?.suggestions?.length > 0) && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '8px',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '1px solid #E5E7EB',
          padding: '10px',
          zIndex: 1000
        }}>
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div style={{ marginBottom: results?.suggestions?.length > 0 ? '10px' : 0 }}>
              <div style={{ 
                fontSize: '12px', 
                color: '#6B7280', 
                fontWeight: '600', 
                marginBottom: '8px',
                paddingLeft: '8px'
              }}>
                🕐 Tìm kiếm gần đây
              </div>
              {recentSearches.map((search, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSuggestionClick(search)}
                  style={{
                    padding: '8px',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    fontSize: '14px',
                    ':hover': { background: '#F3F4F6' }
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#F3F4F6'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  {search}
                </div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {results?.suggestions?.length > 0 && (
            <div>
              <div style={{ 
                fontSize: '12px', 
                color: '#6B7280', 
                fontWeight: '600', 
                marginBottom: '8px',
                paddingLeft: '8px'
              }}>
                💡 Gợi ý tìm kiếm
              </div>
              {results.suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  style={{
                    padding: '8px',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#F3F4F6'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Results Analysis */}
      {results && (
        <div style={{ marginTop: '20px' }}>
          {/* Intent & Entities */}
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>
              🧠 NLP Analysis
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '15px' }}>
              {/* Intent */}
              <div style={{
                padding: '10px 20px',
                background: '#FEF3C7',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '24px' }}>{getIntentIcon(results.intent)}</span>
                <div>
                  <div style={{ fontSize: '11px', color: '#92400E', fontWeight: '600' }}>INTENT</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#92400E' }}>
                    {getIntentLabel(results.intent)}
                  </div>
                </div>
              </div>

              {/* Entities */}
              <div style={{
                padding: '15px',
                background: '#DBEAFE',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '11px', color: '#1E3A8A', fontWeight: '600', marginBottom: '8px' }}>
                  ENTITIES DETECTED
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {results.entities?.location && (
                    <span style={{
                      padding: '4px 12px',
                      background: 'white',
                      borderRadius: '20px',
                      fontSize: '13px',
                      color: '#1E40AF',
                      border: '1px solid #93C5FD'
                    }}>
                      📍 {results.entities.location}
                    </span>
                  )}
                  {results.entities?.industry && (
                    <span style={{
                      padding: '4px 12px',
                      background: 'white',
                      borderRadius: '20px',
                      fontSize: '13px',
                      color: '#1E40AF',
                      border: '1px solid #93C5FD'
                    }}>
                      🏢 {results.entities.industry}
                    </span>
                  )}
                  {results.entities?.region && (
                    <span style={{
                      padding: '4px 12px',
                      background: 'white',
                      borderRadius: '20px',
                      fontSize: '13px',
                      color: '#1E40AF',
                      border: '1px solid #93C5FD'
                    }}>
                      🗺️ Miền {results.entities.region}
                    </span>
                  )}
                  {results.entities?.keywords?.slice(0, 3).map((keyword, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '4px 12px',
                        background: 'white',
                        borderRadius: '20px',
                        fontSize: '13px',
                        color: '#1E40AF',
                        border: '1px solid #93C5FD'
                      }}
                    >
                      🔖 {keyword}
                    </span>
                  ))}
                  {(!results.entities?.location && !results.entities?.industry && 
                    !results.entities?.region && !results.entities?.keywords?.length) && (
                    <span style={{ fontSize: '13px', color: '#6B7280', fontStyle: 'italic' }}>
                      No entities detected
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '15px 20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF8C42' }}>
                {results.count}
              </span>
              <span style={{ marginLeft: '10px', fontSize: '16px', color: '#6B7280' }}>
                kết quả tìm thấy
              </span>
            </div>
            {results.count > 0 && (
              <button
                onClick={() => {
                  // Scroll to results
                  const resultsSection = document.getElementById('search-results');
                  if (resultsSection) {
                    resultsSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                style={{
                  padding: '8px 16px',
                  background: '#FF8C42',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Xem kết quả →
              </button>
            )}
          </div>

          {/* Results List */}
          {results.results && results.results.length > 0 && (
            <div id="search-results">
              <h3 style={{ marginBottom: '15px', fontSize: '18px' }}>📊 Results</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {results.results.map((result, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'white',
                      padding: '15px',
                      borderRadius: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      border: '1px solid #E5E7EB'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#1F2937' }}>
                          {result.name || result.ten_doanh_nghiep}
                        </h4>
                        <div style={{ fontSize: '13px', color: '#6B7280', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {result.industry && <span>🏢 {result.industry}</span>}
                          {result.location && <span>📍 {result.location}</span>}
                          {result.region && <span>🗺️ Miền {result.region === 'Bac' ? 'Bắc' : result.region === 'Trung' ? 'Trung' : 'Nam'}</span>}
                        </div>
                        {result.description && (
                          <p style={{ 
                            margin: '10px 0 0 0', 
                            fontSize: '14px', 
                            color: '#4B5563',
                            lineHeight: '1.5'
                          }}>
                            {result.description.slice(0, 150)}
                            {result.description.length > 150 && '...'}
                          </p>
                        )}
                      </div>
                      {result.similarity && (
                        <div style={{
                          padding: '4px 12px',
                          background: '#D1FAE5',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: '#065F46',
                          marginLeft: '15px'
                        }}>
                          {Math.round(result.similarity * 100)}% match
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartSearchBar;
