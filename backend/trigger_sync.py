import sys
import os
from sqlalchemy.orm import Session

# Add the parent directory to sys.path so we can import 'backend'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.tally_sync import sync_vouchers_to_db

def trigger_manual_sync(company_id: int):
    db = SessionLocal()
    try:
        print(f"Triggering sync for company {company_id}...")
        result = sync_vouchers_to_db(db, company_id=company_id)
        print(f"Sync Results: {result}")
    except Exception as e:
        print(f"Sync Failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    trigger_manual_sync(1)
