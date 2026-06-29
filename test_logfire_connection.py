"""
Test Logfire Connection
Quick script to test if Logfire Read Token is configured correctly
"""
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()


async def test_logfire():
    """Test Logfire API connection"""
    print("=" * 60)
    print("🔥 Testing Logfire Connection")
    print("=" * 60)
    
    # Check if token exists
    read_token = os.getenv('LOGFIRE_READ_TOKEN', '')
    
    if not read_token:
        print("❌ LOGFIRE_READ_TOKEN not found in .env")
        print("\n📝 To fix this:")
        print("1. Create a read token at https://logfire.pydantic.dev/")
        print("2. Add to .env: LOGFIRE_READ_TOKEN=your_token_here")
        print("\n📖 See LOGFIRE_SETUP.md for detailed instructions")
        return False
    
    print(f"✅ Token found: {read_token[:20]}...{read_token[-10:]}")
    
    # Test connection
    try:
        from app.services.logfire_service import get_logfire_service
        
        logfire = get_logfire_service()
        
        print("\n📊 Testing API queries...")
        
        # Test 1: Request metrics
        print("\n1. Testing request metrics...")
        metrics = await logfire.get_request_metrics(hours=24)
        
        if "error" in metrics:
            print(f"   ❌ Error: {metrics['error']}")
            return False
        
        print(f"   ✅ Total requests: {metrics.get('total_requests_today', 0)}")
        print(f"   ✅ Avg response time: {metrics.get('avg_response_time_ms', 0)}ms")
        print(f"   ✅ Error rate: {metrics.get('error_rate', 0) * 100:.2f}%")
        
        # Test 2: Top endpoints
        print("\n2. Testing top endpoints...")
        endpoints = metrics.get('endpoints', [])
        
        if endpoints:
            print(f"   ✅ Found {len(endpoints)} endpoints:")
            for ep in endpoints[:3]:
                print(f"      - {ep['path']}: {ep['count']} requests, {ep['avg_time']}ms avg")
        else:
            print("   ⚠️  No endpoints found (maybe no data yet)")
        
        # Test 3: Recent errors
        print("\n3. Testing error logs...")
        errors = await logfire.get_recent_errors(hours=24, limit=5)
        
        if "error" in str(errors):
            print("   ❌ Error fetching logs")
        elif errors:
            print(f"   ✅ Found {len(errors)} recent logs:")
            for err in errors[:3]:
                print(f"      - [{err['level']}] {err['message'][:50]}...")
        else:
            print("   ✅ No recent errors (good!)")
        
        # Test 4: System health
        print("\n4. Testing system health...")
        health = await logfire.get_system_health()
        
        print(f"   ✅ Database: {health.get('database', 'unknown')}")
        print(f"   ✅ Groq: {health.get('groq', 'unknown')}")
        print(f"   ✅ Crawler: {health.get('crawler', 'unknown')}")
        
        print("\n" + "=" * 60)
        print("🎉 SUCCESS! Logfire connection is working!")
        print("=" * 60)
        print("\n✅ Your admin dashboard will now show REAL-TIME data from Logfire")
        print("📍 Visit: http://localhost:5173/admin")
        print("🔥 Tab: Logfire Monitoring")
        
        return True
        
    except ImportError as e:
        print(f"\n❌ Import error: {e}")
        print("\n📝 To fix this:")
        print("pip install httpx>=0.25.0")
        return False
        
    except Exception as e:
        print(f"\n❌ Connection error: {e}")
        print("\n📝 Possible issues:")
        print("- Token might be invalid or expired")
        print("- Network connection issue")
        print("- Logfire service might be down")
        print("\n📖 See LOGFIRE_SETUP.md for troubleshooting")
        return False


if __name__ == "__main__":
    result = asyncio.run(test_logfire())
    
    if not result:
        print("\n⚠️  Admin dashboard will use fallback data until Logfire is configured")
        exit(1)
    else:
        exit(0)
