"""
Learning layer: persists learned preferences per session instead of
recomputing them from the full conversation history on every request
(that's what ConversationLearningService.extract_user_preferences() used
to do — it re-scanned every user message in history, every turn).

Reuses ConversationLearningService's keyword lists so the two stay in
sync, but only scans the LATEST message and merges the result into the
persisted row.
"""
import json
import logging
from typing import Dict, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import settings
from app.services.conversation_learning_service import get_learning_service

logger = logging.getLogger(__name__)


def _extract_from_single_message(message: str) -> Dict:
    learning_service = get_learning_service()
    keywords = learning_service.preference_keywords
    message_lower = message.lower()

    locations = [loc for loc in keywords['location'] if loc in message_lower]
    industries = [ind for ind in keywords['industry'] if ind in message_lower]
    criteria = {
        criterion: 1
        for criterion, kws in keywords['criteria'].items()
        if any(kw in message_lower for kw in kws)
    }
    return {'locations': locations, 'industries': industries, 'criteria': criteria}


class PreferenceStore:
    def get(self, session_id: str) -> Dict:
        conn = psycopg2.connect(**settings.database_url)
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                "SELECT locations, industries, criteria FROM user_preferences WHERE session_id = %s",
                (session_id,),
            )
            row = cur.fetchone()
            if not row:
                return {'locations': [], 'industries': [], 'criteria': {}}
            return {
                'locations': row['locations'] or [],
                'industries': row['industries'] or [],
                'criteria': row['criteria'] or {},
            }
        except Exception as e:
            logger.error(f"PreferenceStore.get failed: {e}")
            return {'locations': [], 'industries': [], 'criteria': {}}
        finally:
            conn.close()

    def upsert_from_message(self, session_id: str, user_id: Optional[int], message: str) -> Dict:
        new_signals = _extract_from_single_message(message)
        if not (new_signals['locations'] or new_signals['industries'] or new_signals['criteria']):
            return self.get(session_id)

        current = self.get(session_id)
        merged_locations = list(dict.fromkeys(current['locations'] + new_signals['locations']))
        merged_industries = list(dict.fromkeys(current['industries'] + new_signals['industries']))
        merged_criteria = dict(current['criteria'])
        for criterion, count in new_signals['criteria'].items():
            merged_criteria[criterion] = merged_criteria.get(criterion, 0) + count

        conn = psycopg2.connect(**settings.database_url)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO user_preferences (session_id, user_id, locations, industries, criteria)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (session_id) DO UPDATE SET
                    user_id = COALESCE(EXCLUDED.user_id, user_preferences.user_id),
                    locations = EXCLUDED.locations,
                    industries = EXCLUDED.industries,
                    criteria = EXCLUDED.criteria
                """,
                (
                    session_id, user_id,
                    json.dumps(merged_locations), json.dumps(merged_industries), json.dumps(merged_criteria),
                ),
            )
            conn.commit()
        except Exception as e:
            logger.error(f"PreferenceStore.upsert_from_message failed: {e}")
        finally:
            conn.close()

        return {'locations': merged_locations, 'industries': merged_industries, 'criteria': merged_criteria}


_preference_store: Optional[PreferenceStore] = None


def get_preference_store() -> PreferenceStore:
    global _preference_store
    if _preference_store is None:
        _preference_store = PreferenceStore()
    return _preference_store
