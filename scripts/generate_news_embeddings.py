"""
Generate embeddings for all news articles
"""
import psycopg2
from app.config import settings
from app.services.embedding_service import get_embedding_service
import time

def generate_embeddings():
    """Generate embeddings for news without embeddings"""
    
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor()
    
    # Get news without embeddings
    cur.execute("""
        SELECT id, tieu_de, tom_tat
        FROM station_news
        WHERE embedding_vector IS NULL
        ORDER BY created_at DESC;
    """)
    
    news_list = cur.fetchall()
    total = len(news_list)
    
    print("=" * 80)
    print("🚀 GENERATE NEWS EMBEDDINGS")
    print("=" * 80)
    print(f"📊 Found {total} news without embeddings")
    
    if total == 0:
        print("✅ All news already have embeddings!")
        cur.close()
        conn.close()
        return
    
    # Confirm
    confirm = input(f"\n⚠️  Generate embeddings for {total} news? (y/n): ")
    if confirm.lower() != 'y':
        print("❌ Cancelled")
        cur.close()
        conn.close()
        return
    
    print(f"\n🔄 Processing {total} news articles...")
    print("⏱️  This may take a while (rate limit: ~60 requests/minute)")
    
    embedding_service = get_embedding_service()
    
    success_count = 0
    error_count = 0
    skipped_count = 0
    
    for idx, (news_id, title, summary) in enumerate(news_list, 1):
        try:
            # Create text for embedding
            text = f"{title}\n{summary}" if summary else title
            
            if not text or len(text.strip()) < 10:
                print(f"  ⚠️  [{idx}/{total}] ID {news_id}: Text too short, skipped")
                skipped_count += 1
                continue
            
            # Generate embedding
            embedding = embedding_service.get_embedding(text)
            
            if embedding and len(embedding) == settings.EMBEDDING_DIMENSION:
                # Update database
                cur.execute("""
                    UPDATE station_news
                    SET embedding_vector = %s
                    WHERE id = %s;
                """, (embedding, news_id))
                
                conn.commit()
                success_count += 1
                
                # Progress
                if idx % 10 == 0 or idx == total:
                    print(f"  ✅ [{idx}/{total}] Processed: {success_count} success, {error_count} errors, {skipped_count} skipped")
                
                # Rate limiting - sleep every 50 requests
                if idx % 50 == 0:
                    print(f"  ⏸️  Rate limit pause (30s)...")
                    time.sleep(30)
                else:
                    time.sleep(0.5)  # Small delay between requests
            else:
                print(f"  ❌ [{idx}/{total}] ID {news_id}: Invalid embedding")
                error_count += 1
                
        except Exception as e:
            print(f"  ❌ [{idx}/{total}] ID {news_id}: Error - {str(e)[:50]}")
            error_count += 1
            time.sleep(2)  # Longer pause on error
    
    cur.close()
    conn.close()
    
    print("\n" + "=" * 80)
    print("🎉 EMBEDDING GENERATION COMPLETE")
    print("=" * 80)
    print(f"✅ Success: {success_count}")
    print(f"❌ Errors: {error_count}")
    print(f"⚠️  Skipped: {skipped_count}")
    print(f"📊 Total: {total}")
    print(f"📈 Success rate: {success_count/total*100:.1f}%")
    print("\n🚀 RAG system is now ready with {success_count + 10} news articles!")
    print("   (10 existing + {success_count} new)")


if __name__ == "__main__":
    print("\n⚡ GEMINI EMBEDDING GENERATOR")
    print("   This script will generate embeddings for all news without embeddings.")
    print("   Using: gemini-embedding-001 (3072 dimensions)")
    print()
    
    try:
        generate_embeddings()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Fatal error: {e}")
