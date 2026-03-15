from backend.database import SessionLocal
from backend.models import Voucher, VoucherEntry, Ledger, TallyGroup, VoucherType

def inspect_voucher(v_id):
    db = SessionLocal()
    try:
        v = db.query(Voucher).filter(Voucher.id == v_id).first()
        if not v:
            print(f"Voucher {v_id} not found")
            return
        vtype = db.query(VoucherType).filter(VoucherType.id == v.voucher_type_id).first()
        print(f"Voucher ID: {v.id}, Number: {v.voucher_number}, Type: {vtype.name}")
        
        entries = db.query(VoucherEntry, Ledger).join(Ledger).filter(VoucherEntry.voucher_id == v.id).all()
        for ve, l in entries:
            group = db.query(TallyGroup).filter(TallyGroup.id == l.group_id).first()
            print(f"  Entry: Ledger={l.name}, Group={group.name if group else 'N/A'}, Amount={ve.amount}, Debit={ve.is_debit}")
            
    finally:
        db.close()

if __name__ == "__main__":
    # Inspect some offending vouchers
    inspect_voucher(61)
    inspect_voucher(229)
