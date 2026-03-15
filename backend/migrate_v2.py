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
            conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS fssai_no VARCHAR"))
            conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS enable_bill_by_bill BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS maintain_stock_batches BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS enable_gst BOOLEAN DEFAULT TRUE"))
            conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS enable_tds BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS enable_cost_centres BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS iec_code VARCHAR"))
            print("Verified: companies branding, F11 features, and IEC")
        except Exception as e:
            print(f"Skipping companies.company_type: {e}")

        # 2. Add Pharma fields to stock_items
        try:
            conn.execute(text("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS salt_composition VARCHAR"))
            conn.execute(text("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS rack_number VARCHAR"))
            conn.execute(text("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS main_unit_name VARCHAR"))
            conn.execute(text("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS sub_unit_name VARCHAR"))
            conn.execute(text("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS conversion_factor INTEGER DEFAULT 1"))
            conn.execute(text("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS is_narcotic BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS is_h1 BOOLEAN DEFAULT FALSE"))
            print("Verified: stock_items pharma fields")
        except Exception as e:
            print(f"Skipping stock_items fields: {e}")

        # 3. Add batch_id/godown_id to inventory_entries
        try:
            conn.execute(text("ALTER TABLE inventory_entries ADD COLUMN IF NOT EXISTS batch_id INTEGER REFERENCES stock_batches(id)"))
            conn.execute(text("ALTER TABLE inventory_entries ADD COLUMN IF NOT EXISTS godown_id INTEGER REFERENCES godowns(id)"))
            print("Verified: inventory_entries pharma/godown fields")
        except Exception as e:
            print(f"Skipping inventory_entries fields: {e}")

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
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS fssai_no VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS tax_type VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC(5,2)"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS tax_head VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS employee_id VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS designation VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS bank_name VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS primary_pan VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS basic_pay NUMERIC(15,4) DEFAULT 0"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS da_pay NUMERIC(15,4) DEFAULT 0"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS hra_pay NUMERIC(15,4) DEFAULT 0"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS other_allowances NUMERIC(15,4) DEFAULT 0"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS total_ctc NUMERIC(15,4) DEFAULT 0"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS attendance_source VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS shift_type VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS country VARCHAR DEFAULT 'India'"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS iec_code VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS account_no VARCHAR"))
            conn.execute(text("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS tally_guid VARCHAR"))
            
            # Create salary_history table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS salary_history (
                    id SERIAL PRIMARY KEY,
                    ledger_id INTEGER NOT NULL REFERENCES ledgers(id),
                    effective_date DATE NOT NULL,
                    old_salary NUMERIC(15,4) NOT NULL,
                    new_salary NUMERIC(15,4) NOT NULL,
                    change_percentage NUMERIC(7,2)
                )
            """))
            
            print("Verified: advanced payroll fields and salary_history table")
        except Exception as e:
            print(f"Skipping ledgers fields: {e}")

        # 5. Add Banking fields to voucher_entries
        try:
            conn.execute(text("ALTER TABLE voucher_entries ADD COLUMN IF NOT EXISTS instrument_no VARCHAR"))
            conn.execute(text("ALTER TABLE voucher_entries ADD COLUMN IF NOT EXISTS instrument_date DATE"))
            conn.execute(text("ALTER TABLE voucher_entries ADD COLUMN IF NOT EXISTS bank_date DATE"))
            print("Verified: voucher_entries banking fields")
        except Exception as e:
            print(f"Skipping voucher_entries banking fields: {e}")

        # 6. Add Permission fields to users
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_reports BOOLEAN DEFAULT TRUE"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_vouchers BOOLEAN DEFAULT TRUE"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_inventory BOOLEAN DEFAULT TRUE"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_masters BOOLEAN DEFAULT TRUE"))
            print("Verified: users permission fields")
        except Exception as e:
            print(f"Skipping users fields: {e}")

        # 7. Fix Unique Constraints for Tally GUIDs (Per-Company)
        try:
            # Ledgers
            conn.execute(text("ALTER TABLE ledgers DROP CONSTRAINT IF EXISTS ledgers_tally_guid_key"))
            conn.execute(text("DROP INDEX IF EXISTS ix_ledgers_tally_guid"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_ledgers_tally_guid ON ledgers (tally_guid)"))
            conn.execute(text("ALTER TABLE ledgers DROP CONSTRAINT IF EXISTS _company_tally_ledger_guid_uc"))
            conn.execute(text("ALTER TABLE ledgers ADD CONSTRAINT _company_tally_ledger_guid_uc UNIQUE (company_id, tally_guid)"))

            # Tally Groups
            conn.execute(text("ALTER TABLE tally_groups DROP CONSTRAINT IF EXISTS tally_groups_tally_guid_key"))
            conn.execute(text("DROP INDEX IF EXISTS ix_tally_groups_tally_guid"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_tally_groups_tally_guid ON tally_groups (tally_guid)"))
            conn.execute(text("ALTER TABLE tally_groups DROP CONSTRAINT IF EXISTS _company_tally_group_guid_uc"))
            conn.execute(text("ALTER TABLE tally_groups ADD CONSTRAINT _company_tally_group_guid_uc UNIQUE (company_id, tally_guid)"))

            # Voucher Types
            conn.execute(text("ALTER TABLE voucher_types DROP CONSTRAINT IF EXISTS voucher_types_tally_guid_key"))
            conn.execute(text("DROP INDEX IF EXISTS ix_voucher_types_tally_guid"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_voucher_types_tally_guid ON voucher_types (tally_guid)"))
            conn.execute(text("ALTER TABLE voucher_types DROP CONSTRAINT IF EXISTS _company_tally_vtype_guid_uc"))
            conn.execute(text("ALTER TABLE voucher_types ADD CONSTRAINT _company_tally_vtype_guid_uc UNIQUE (company_id, tally_guid)"))

            # Vouchers
            conn.execute(text("ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_tally_guid_key"))
            conn.execute(text("DROP INDEX IF EXISTS ix_vouchers_tally_guid"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_vouchers_tally_guid ON vouchers (tally_guid)"))
            conn.execute(text("ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS _company_tally_voucher_guid_uc"))
            conn.execute(text("ALTER TABLE vouchers ADD CONSTRAINT _company_tally_voucher_guid_uc UNIQUE (company_id, tally_guid)"))
            print("Verified: composite Tally GUID constraints")
        except Exception as e:
            print(f"Skipping unique constraints fix: {e}")

        conn.commit()
    
    print("V2 Database Migration completed successfully.")

if __name__ == "__main__":
    migrate()
