import os
import sys
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

# Ensure we load the correct .env
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

DATABASE_URL = os.getenv("DATABASE_URL")
print(f"DEBUG: Connecting to {DATABASE_URL}")

engine = create_engine(DATABASE_URL)

def force_fix_columns():
    with engine.connect() as conn:
        print("Fixing ledgers table...")
        columns_to_add = [
            ("address", "VARCHAR"),
            ("city", "VARCHAR"),
            ("state", "VARCHAR"),
            ("pincode", "VARCHAR"),
            ("gstin", "VARCHAR"),
            ("tally_guid", "VARCHAR"),
            ("alterid", "INTEGER")
        ]
        
        for col_name, col_type in columns_to_add:
            try:
                conn.execute(text(f"ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                print(f"  Verified/Added {col_name}")
            except Exception as e:
                print(f"  Error adding {col_name}: {e}")
        
        conn.commit()
    print("Force fix completed.")

if __name__ == "__main__":
    force_fix_columns()
