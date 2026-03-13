from backend.database import SessionLocal
from backend.models import Ledger, Voucher, Company

db = SessionLocal()
try:
    companies = db.query(Company).all()
    print(f"{'ID':<5} | {'Company Name':<30} | {'Ledgers':<8} | {'Vouchers':<8}")
    print("-" * 60)
    for c in companies:
        ledger_count = db.query(Ledger).filter(Ledger.company_id == c.id).count()
        voucher_count = db.query(Voucher).filter(Voucher.company_id == c.id).count()
        print(f"{c.id:<5} | {c.name[:30]:<30} | {ledger_count:<8} | {voucher_count:<8}")
finally:
    db.close()
