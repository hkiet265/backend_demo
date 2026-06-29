"""
Simple Logfire Query Test
"""
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()


async def test_simple_query():
    """Test a simple Logfire query"""
    print("🔥 Testing simple Logfire query...")
    
    read_token = os.getenv('LOGFIRE_READ_TOKEN', '')
    
    if not read_token:
        print("❌ No token found")
        return
    
    print(f"✅ Token: {read_token[:20]}...{read_token[-10:]}")
    
    from app.services.logfire_service import get_logfire_service
    
    logfire = get_logfire_service()
    
    # Simple query: Count all records
    print("\n1. Testing simple COUNT query...")
    result = await logfire.query_json(
        sql="SELECT COUNT(*) as total FROM records",
        limit=1
    )
    
    print(f"   Result: {result}")
    
    if "error" not in result and "data" in result:
        data = result.get("data", [])
        if data:
            total = data[0].get("total", 0)
            print(f"   ✅ Total records: {total}")
        else:
            print("   ⚠️  No data returned")
    else:
        print(f"   ❌ Error: {result.get('error', 'Unknown')}")


if __name__ == "__main__":
    asyncio.run(test_simple_query())
