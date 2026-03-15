from backend.database import SessionLocal
from backend.models import Voucher, VoucherEntry, InventoryEntry, VoucherType

def check_vouchers():
    db = SessionLocal()
    try:
        vouchers = db.query(Voucher).all()
        print(f"Total Vouchers: {len(vouchers)}")
        for v in vouchers:
            vtype = db.query(VoucherType).filter(VoucherType.id == v.voucher_type_id).first()
            l_entries = db.query(VoucherEntry).filter(VoucherEntry.voucher_id == v.id).count()
            i_entries = db.query(InventoryEntry).filter(InventoryEntry.voucher_id == v.id).count()
            if i_entries == 0 and l_entries > 0:
                print(f"Voucher ID: {v.id}, Number: {v.voucher_number}, Type: {vtype.name if vtype else 'Unknown'}, Ledgers: {l_entries}, Inventory: {i_entries}")
    finally:
        db.close()

if __name__ == "__main__":
    check_vouchers()
