import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Try to find .env
if os.path.exists('backend/.env'):
    load_dotenv('backend/.env')
elif os.path.exists('.env'):
    load_dotenv('.env')

db_url = os.getenv('DATABASE_URL')
if not db_url:
    print("DATABASE_URL not found in .env")
    sys.exit(1)

engine = create_engine(db_url)

voucher_id = 59
if len(sys.argv) > 1:
    voucher_id = int(sys.argv[1])

print(f"Checking DB for Voucher ID: {voucher_id}")

try:
    with engine.connect() as conn:
        print(f"--- Voucher Table ---")
        v = conn.execute(text("SELECT * FROM vouchers WHERE id = :id"), {"id": voucher_id}).fetchone()
        if not v:
            print("Voucher not found")
        else:
            print(f"Voucher: {dict(v._mapping)}")
            
            print("\n--- Accounting Entries (voucher_entries) ---")
            entries = conn.execute(text("SELECT * FROM voucher_entries WHERE voucher_id = :id"), {"id": voucher_id}).fetchall()
            for e in entries:
                print(dict(e._mapping))
                
            print("\n--- Inventory Entries (inventory_entries) ---")
            inventory = conn.execute(text("SELECT * FROM inventory_entries WHERE voucher_id = :id"), {"id": voucher_id}).fetchall()
            if not inventory:
                print("NO INVENTORY ENTRIES FOUND for this voucher.")
            for i in inventory:
                data = dict(i._mapping)
                print(data)
                # Check if stock item exists
                if data['stock_item_id']:
                    si = conn.execute(text("SELECT name FROM stock_items WHERE id = :id"), {"id": data['stock_item_id']}).fetchone()
                    if si:
                        print(f"  -> Stock Item ({data['stock_item_id']}): {si.name}")
                    else:
                        print(f"  -> Stock Item ({data['stock_item_id']}): MISSING (This will cause inner join to fail!)")
                else:
                    print("  -> Stock Item ID is NULL")
except Exception as err:
    print(f"Error: {err}")
