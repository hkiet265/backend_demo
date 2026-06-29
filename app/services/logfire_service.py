"""
Logfire Query Service
Service to fetch real-time metrics from Logfire API
"""
import httpx
from datetime import datetime, timedelta, UTC
from typing import Optional, Dict, Any, List
import logging
from app.config import settings

logger = logging.getLogger(__name__)

# Simple cache to avoid rate limiting (cache for 60 seconds)
_metrics_cache: Optional[Dict[str, Any]] = None
_cache_timestamp: Optional[datetime] = None
CACHE_TTL_SECONDS = 60


class LogfireQueryService:
    """Service to query Logfire API for real-time metrics"""
    
    def __init__(self):
        """Initialize Logfire query service"""
        self.base_url = "https://logfire-us.pydantic.dev"  # US region
        self.read_token = settings.__dict__.get('LOGFIRE_READ_TOKEN', '')
        self.headers = {
            'Authorization': f'Bearer {self.read_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'  # Request JSON format explicitly
        }
    
    def is_enabled(self) -> bool:
        """Check if Logfire read token is configured"""
        return bool(self.read_token)
    
    async def query_json(
        self, 
        sql: str, 
        min_timestamp: Optional[datetime] = None,
        limit: int = 1000
    ) -> Dict[str, Any]:
        """
        Execute SQL query against Logfire API
        
        Args:
            sql: SQL query to execute
            min_timestamp: Filter records after this timestamp
            limit: Maximum rows to return
            
        Returns:
            Query results in JSON format
        """
        if not self.is_enabled():
            logger.warning("Logfire read token not configured")
            return {"error": "Logfire not configured"}
        
        # Default to last 24 hours
        if min_timestamp is None:
            min_timestamp = datetime.now(UTC) - timedelta(hours=24)
        
        body = {
            'sql': sql,
            'min_timestamp': min_timestamp.isoformat(),
            'limit': limit
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f'{self.base_url}/v2/query',
                    json=body,
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    # Parse JSON response
                    try:
                        return response.json()
                    except Exception as e:
                        logger.error(f"Failed to parse Logfire response: {e}")
                        return {"error": f"Parse error: {str(e)}"}
                else:
                    logger.error(f"Logfire API error: {response.status_code} - {response.text}")
                    return {"error": f"API error: {response.status_code}"}
                    
        except Exception as e:
            logger.error(f"Logfire query failed: {e}")
            return {"error": str(e)}
    
    async def get_request_metrics(self, hours: int = 24) -> Dict[str, Any]:
        """
        Get API request metrics from Logfire (with caching to avoid rate limit)
        
        Returns:
            - Total requests
            - Average response time
            - Error rate
            - Top endpoints
        """
        global _metrics_cache, _cache_timestamp
        
        # Check cache first
        now = datetime.now(UTC)
        if _metrics_cache and _cache_timestamp:
            age_seconds = (now - _cache_timestamp).total_seconds()
            if age_seconds < CACHE_TTL_SECONDS:
                logger.info(f"📦 Using cached metrics (age: {int(age_seconds)}s)")
                return _metrics_cache
        
        logger.info("🔄 Fetching fresh metrics from Logfire...")
        
        min_timestamp = now - timedelta(hours=hours)
        
        # Combined query to reduce API calls (avoid rate limit)
        sql_combined = """
        WITH request_stats AS (
            SELECT 
                COUNT(*) as total_requests,
                AVG(duration) / 1000000 as avg_response_ms,
                SUM(CASE WHEN otel_status_code = 'ERROR' THEN 1 ELSE 0 END) as error_count
            FROM records
            WHERE span_name LIKE 'GET %' OR span_name LIKE 'POST %'
        ),
        top_endpoints AS (
            SELECT 
                span_name as endpoint,
                COUNT(*) as count,
                AVG(duration) / 1000000 as avg_time_ms
            FROM records
            WHERE span_name LIKE 'GET %' OR span_name LIKE 'POST %'
            GROUP BY span_name
            ORDER BY count DESC
            LIMIT 5
        )
        SELECT 
            (SELECT total_requests FROM request_stats) as total_requests,
            (SELECT avg_response_ms FROM request_stats) as avg_response_ms,
            (SELECT error_count FROM request_stats) as error_count
        """
        
        result = await self.query_json(sql_combined, min_timestamp)
        
        if "error" in result:
            # Return cached data if available, otherwise fallback
            if _metrics_cache:
                logger.warning("⚠️ API error, using stale cache")
                return _metrics_cache
            return self._get_fallback_metrics()
        
        data = result.get('data', [])
        if not data:
            if _metrics_cache:
                return _metrics_cache
            return self._get_fallback_metrics()
        
        row = data[0]
        total_requests = row.get('total_requests', 0) or 0
        avg_response_ms = round(row.get('avg_response_ms', 0) or 0, 2)
        error_count = row.get('error_count', 0) or 0
        error_rate = error_count / total_requests if total_requests > 0 else 0
        
        # Get top endpoints in separate query only if needed
        endpoints = await self.get_top_endpoints(min_timestamp)
        
        metrics = {
            "total_requests_today": total_requests,
            "avg_response_time_ms": avg_response_ms,
            "error_rate": error_rate,
            "error_count": error_count,
            "endpoints": endpoints
        }
        
        # Update cache
        _metrics_cache = metrics
        _cache_timestamp = now
        
        return metrics
    
    async def get_top_endpoints(self, min_timestamp: datetime, limit: int = 5) -> List[Dict]:
        """Get top API endpoints by request count"""
        sql = """
        SELECT 
            span_name as endpoint,
            COUNT(*) as count,
            AVG(duration) / 1000000 as avg_time_ms
        FROM records
        WHERE span_name LIKE 'GET %' OR span_name LIKE 'POST %'
        GROUP BY span_name
        ORDER BY count DESC
        LIMIT 5
        """
        
        result = await self.query_json(sql, min_timestamp, limit)
        
        if "error" in result:
            return []
        
        data = result.get('data', [])
        return [
            {
                "path": row.get('endpoint', 'Unknown'),
                "count": row.get('count', 0),
                "avg_time": round(row.get('avg_time_ms', 0), 2)
            }
            for row in data
        ]
    
    async def get_recent_errors(self, hours: int = 24, limit: int = 10) -> List[Dict]:
        """Get recent errors and warnings from Logfire"""
        min_timestamp = datetime.now(UTC) - timedelta(hours=hours)
        
        sql = """
        SELECT 
            start_timestamp,
            level,
            message,
            span_name as endpoint
        FROM records
        WHERE level IN ('error', 'warning')
        ORDER BY start_timestamp DESC
        LIMIT 10
        """
        
        result = await self.query_json(sql, min_timestamp, limit)
        
        if "error" in result:
            return self._get_fallback_errors()
        
        data = result.get('data', [])
        return [
            {
                "timestamp": row.get('start_timestamp', ''),
                "level": row.get('level', 'INFO').upper(),
                "message": row.get('message', 'No message'),
                "endpoint": row.get('endpoint', 'Unknown')
            }
            for row in data
        ]
    
    async def get_system_health(self) -> Dict[str, str]:
        """Get system health status from Logfire"""
        # Query recent errors in last hour
        min_timestamp = datetime.now(UTC) - timedelta(hours=1)
        
        sql = """
        SELECT COUNT(*) as error_count
        FROM records
        WHERE level = 'error'
        """
        
        result = await self.query_json(sql, min_timestamp)
        
        if "error" in result:
            return {
                "database": "unknown",
                "groq": "unknown",
                "crawler": "unknown",
                "uptime": "unknown"
            }
        
        data = result.get('data', [])
        error_count = data[0].get('error_count', 0) if data else 0
        
        return {
            "database": "healthy" if error_count < 10 else "warning",
            "groq": "healthy" if settings.USE_GROQ_FOR_GENERATION else "disabled",
            "crawler": "active",
            "uptime": "Running"
        }
    
    def _get_fallback_metrics(self) -> Dict[str, Any]:
        """Return fallback metrics when Logfire is unavailable"""
        return {
            "total_requests_today": 0,
            "avg_response_time_ms": 0,
            "error_rate": 0,
            "error_count": 0,
            "endpoints": []
        }
    
    def _get_fallback_errors(self) -> List[Dict]:
        """Return fallback errors when Logfire is unavailable"""
        return [
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "level": "INFO",
                "message": "Logfire read token not configured",
                "endpoint": "System"
            }
        ]


# Singleton instance
_logfire_service: Optional[LogfireQueryService] = None


def get_logfire_service() -> LogfireQueryService:
    """Get or create Logfire query service instance"""
    global _logfire_service
    if _logfire_service is None:
        _logfire_service = LogfireQueryService()
    return _logfire_service
