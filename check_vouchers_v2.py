from backend.database import SessionLocal
from backend.models import Voucher, VoucherEntry, InventoryEntry, VoucherType
import sys

def check_vouchers():
    db = SessionLocal()
    try:
        vouchers = db.query(Voucher).all()
        print(f"Total Vouchers: {len(vouchers)}")
        for v in vouchers:
            vtype = db.query(VoucherType).filter(VoucherType.id == v.voucher_type_id).first()
            if vtype and 'sales' in vtype.name.lower():
                l_entries = db.query(VoucherEntry).filter(VoucherEntry.voucher_id == v.id).count()
                i_entries = db.query(InventoryEntry).filter(InventoryEntry.voucher_id == v.id).count()
                print(f"SALES - Voucher ID: {v.id}, Number: {v.voucher_number}, Type: {vtype.name}, Ledgers: {l_entries}, Inventory: {i_entries}")
    finally:
        db.close()

if __name__ == "__main__":
    check_vouchers()
