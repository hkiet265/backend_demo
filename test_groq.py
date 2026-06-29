"""
Quick test script to verify Groq integration is working
"""
import sys
import os

# Add app directory to path
sys.path.insert(0, os.path.dirname(__file__))

from app.services.groq_service import get_groq_service

def test_groq():
    """Test Groq service initialization and generation"""
    print("=" * 60)
    print("🧪 Testing Groq Integration")
    print("=" * 60)
    
    # Get Groq service
    groq_service = get_groq_service()
    
    if not groq_service:
        print("❌ Groq service not initialized (no API keys?)")
        return False
    
    print(f"✅ Groq service initialized with {len(groq_service.api_keys)} API keys")
    print(f"📦 Model: {groq_service.model}")
    print()
    
    # Test generation
    print("🚀 Testing generation...")
    system_prompt = "Bạn là trợ lý AI thân thiện."
    user_prompt = "Xin chào! Bạn tên gì?"
    
    answer = groq_service.generate(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.7,
        max_tokens=100
    )
    
    if answer:
        print(f"✅ Groq response:\n{answer}")
        print()
        return True
    else:
        print("❌ Groq generation failed")
        return False

if __name__ == "__main__":
    success = test_groq()
    sys.exit(0 if success else 1)
