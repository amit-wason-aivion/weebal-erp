"""initial_schema

Revision ID: 6f72cf7e5da5
Revises: 
Create Date: 2026-03-14 12:47:25.835966

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6f72cf7e5da5'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Insert idempotent raw SQL to ensure production database catches up with all the missing columns.
    # We use IF NOT EXISTS so this succeeds even if run on a database that already has these columns (like localhost).
    
    # 1. companies
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_type VARCHAR DEFAULT 'GENERAL'")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS fssai_no VARCHAR")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS enable_bill_by_bill BOOLEAN DEFAULT FALSE")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS maintain_stock_batches BOOLEAN DEFAULT FALSE")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS enable_gst BOOLEAN DEFAULT TRUE")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS enable_tds BOOLEAN DEFAULT FALSE")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS enable_cost_centres BOOLEAN DEFAULT FALSE")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS iec_code VARCHAR")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS gstin VARCHAR")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS drug_license_no VARCHAR")

    # 2. stock_items
    op.execute("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS salt_composition VARCHAR")
    op.execute("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS rack_number VARCHAR")
    op.execute("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS conversion_factor INTEGER DEFAULT 1")

    # 3. inventory_entries
    op.execute("ALTER TABLE inventory_entries ADD COLUMN IF NOT EXISTS batch_id INTEGER REFERENCES stock_batches(id)")

    # 4. ledgers
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS address VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS city VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS state VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS pincode VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS gstin VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS pan_no VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS drug_license_no VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS phone VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS email VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS fssai_no VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS tax_type VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC(5,2)")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS tax_head VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS employee_id VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS designation VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS bank_name VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS primary_pan VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS basic_pay NUMERIC(15,4) DEFAULT 0")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS da_pay NUMERIC(15,4) DEFAULT 0")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS hra_pay NUMERIC(15,4) DEFAULT 0")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS other_allowances NUMERIC(15,4) DEFAULT 0")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS total_ctc NUMERIC(15,4) DEFAULT 0")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN DEFAULT FALSE")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS attendance_source VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS shift_type VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS country VARCHAR DEFAULT 'India'")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS iec_code VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS account_no VARCHAR")
    op.execute("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS tally_guid VARCHAR")

    # 5. salary_history table creation (safe with IF NOT EXISTS)
    op.execute("""
        CREATE TABLE IF NOT EXISTS salary_history (
            id SERIAL PRIMARY KEY,
            ledger_id INTEGER NOT NULL REFERENCES ledgers(id),
            effective_date DATE NOT NULL,
            old_salary NUMERIC(15,4) NOT NULL,
            new_salary NUMERIC(15,4) NOT NULL,
            change_percentage NUMERIC(7,2)
        )
    """)

    # 6. voucher_entries
    op.execute("ALTER TABLE voucher_entries ADD COLUMN IF NOT EXISTS instrument_no VARCHAR")
    op.execute("ALTER TABLE voucher_entries ADD COLUMN IF NOT EXISTS instrument_date DATE")
    op.execute("ALTER TABLE voucher_entries ADD COLUMN IF NOT EXISTS bank_date DATE")

    # 7. tally_groups (new from recent changes)
    op.execute("ALTER TABLE tally_groups ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)")
    op.execute("ALTER TABLE tally_groups ADD COLUMN IF NOT EXISTS tally_guid VARCHAR")
    op.execute("ALTER TABLE tally_groups ADD COLUMN IF NOT EXISTS alterid INTEGER")



def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    pass
    # ### end Alembic commands ###
