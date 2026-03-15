import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Add current folder to path so imports work
sys.path.append(os.getcwd())

if os.path.exists('backend/.env'):
    load_dotenv('backend/.env')
elif os.path.exists('.env'):
    load_dotenv('.env')

db_url = os.getenv('DATABASE_URL')
if not db_url:
    print("DATABASE_URL not found in .env")
    sys.exit(1)

engine = create_engine(db_url)

commands = [
    # 1. Ledgers
    "ALTER TABLE ledgers DROP CONSTRAINT IF EXISTS ledgers_tally_guid_key",
    "DROP INDEX IF EXISTS ix_ledgers_tally_guid",
    "CREATE INDEX IF NOT EXISTS ix_ledgers_tally_guid ON ledgers (tally_guid)",
    "ALTER TABLE ledgers DROP CONSTRAINT IF EXISTS _company_tally_ledger_guid_uc",
    "ALTER TABLE ledgers ADD CONSTRAINT _company_tally_ledger_guid_uc UNIQUE (company_id, tally_guid)",

    # 2. Tally Groups
    "ALTER TABLE tally_groups DROP CONSTRAINT IF EXISTS tally_groups_tally_guid_key",
    "DROP INDEX IF EXISTS ix_tally_groups_tally_guid",
    "CREATE INDEX IF NOT EXISTS ix_tally_groups_tally_guid ON tally_groups (tally_guid)",
    "ALTER TABLE tally_groups DROP CONSTRAINT IF EXISTS _company_tally_group_guid_uc",
    "ALTER TABLE tally_groups ADD CONSTRAINT _company_tally_group_guid_uc UNIQUE (company_id, tally_guid)",

    # 3. Voucher Types
    "ALTER TABLE voucher_types DROP CONSTRAINT IF EXISTS voucher_types_tally_guid_key",
    "DROP INDEX IF EXISTS ix_voucher_types_tally_guid",
    "CREATE INDEX IF NOT EXISTS ix_voucher_types_tally_guid ON voucher_types (tally_guid)",
    "ALTER TABLE voucher_types DROP CONSTRAINT IF EXISTS _company_tally_vtype_guid_uc",
    "ALTER TABLE voucher_types ADD CONSTRAINT _company_tally_vtype_guid_uc UNIQUE (company_id, tally_guid)",

    # 4. Vouchers
    "ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_tally_guid_key",
    "DROP INDEX IF EXISTS ix_vouchers_tally_guid",
    "CREATE INDEX IF NOT EXISTS ix_vouchers_tally_guid ON vouchers (tally_guid)",
    "ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS _company_tally_voucher_guid_uc",
    "ALTER TABLE vouchers ADD CONSTRAINT _company_tally_voucher_guid_uc UNIQUE (company_id, tally_guid)",
]

with engine.connect() as conn:
    for cmd in commands:
        try:
            print(f"Executing: {cmd}")
            conn.execute(text(cmd))
            conn.commit()
        except Exception as e:
            print(f"Error: {e}")
            conn.rollback()

print("\nDatabase constraints updated successfully!")
