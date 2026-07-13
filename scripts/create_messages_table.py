"""
Phase 4 (Live Chat): bảng tin nhắn trực tiếp giữa nhà tuyển dụng và ứng
viên, gắn theo từng đơn ứng tuyển (job_id + candidate_user_id) để có ngữ
cảnh "đang trao đổi về vị trí nào".

    python scripts/create_messages_table.py
"""
import sys

sys.path.insert(0, ".")

import psycopg2
from app.config import settings

SQL = """
CREATE TABLE IF NOT EXISTS job_messages (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
    candidate_user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_messages_thread ON job_messages(job_id, candidate_user_id, created_at);
"""


def main():
    conn = psycopg2.connect(**settings.database_url)
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    cur.execute("SELECT COUNT(*) FROM job_messages")
    print(f"job_messages table ready. Current rows: {cur.fetchone()[0]}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
