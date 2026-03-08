from database import engine
from sqlalchemy import text
with engine.connect() as conn:
    conn.execute(text('ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS is_synced BOOLEAN DEFAULT FALSE'))
    conn.commit()
print("Success: is_synced column added.")
