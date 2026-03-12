from sqlalchemy import text
from .database import engine
from .models import Base

def migrate():
    print("Starting V2 Database Migration...")
    
    # Tables to ensure exist (StockBatch is new)
    Base.metadata.create_all(bind=engine)
    
    with engine.connect() as conn:
        # 1. Add company_type to companies
        try:
            conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_type VARCHAR DEFAULT 'GENERAL'"))
            print("Verified: companies.company_type")
        except Exception as e:
            print(f"Skipping companies.company_type: {e}")

        # 2. Add Pharma fields to stock_items
        try:
            conn.execute(text("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS salt_composition VARCHAR"))
            conn.execute(text("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS rack_number VARCHAR"))
            conn.execute(text("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS conversion_factor INTEGER DEFAULT 1"))
            print("Verified: stock_items pharma fields")
        except Exception as e:
            print(f"Skipping stock_items fields: {e}")

        # 3. Add batch_id to inventory_entries
        try:
            conn.execute(text("ALTER TABLE inventory_entries ADD COLUMN IF NOT EXISTS batch_id INTEGER REFERENCES stock_batches(id)"))
            print("Verified: inventory_entries.batch_id")
        except Exception as e:
            print(f"Skipping inventory_entries.batch_id: {e}")

        # 4. Add Ledger fields
        try:
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS address VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS city VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS state VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS pincode VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS gstin VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS pan_no VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS drug_license_no VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS phone VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS email VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS tally_guid VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS alterid INTEGER"))
            print("Verified: ledgers fields")
        except Exception as e:
            print(f"Skipping ledgers fields: {e}")

        conn.commit()
    
    print("V2 Database Migration completed successfully.")

if __name__ == "__main__":
    migrate()
