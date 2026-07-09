"""
Backfill anh_dai_dien (og:image) for existing news rows that have none —
the old crawler never saved images. Run in batches since each row needs a
real page fetch.
Run: python scripts/backfill_news_images.py [batch_size] [num_batches]
"""
import sys
import os
import io
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from app.config import settings
from app.database import init_db_pool
from app.services.news_crawler_service import get_crawler_service

def main():
    init_db_pool(settings.database_url)
    batch_size = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    num_batches = int(sys.argv[2]) if len(sys.argv) > 2 else 1

    crawler = get_crawler_service()
    total_updated = 0
    total_processed = 0

    for i in range(num_batches):
        result = crawler.backfill_missing_images(limit=batch_size)
        total_updated += result.get('updated', 0)
        total_processed += result.get('processed', 0)
        print(f"Batch {i+1}/{num_batches}: {result}")
        if result.get('processed', 0) == 0:
            print("No more news without images — stopping early.")
            break

    print(f"\nTotal: {total_processed} processed, {total_updated} updated with a real image")

if __name__ == "__main__":
    main()
