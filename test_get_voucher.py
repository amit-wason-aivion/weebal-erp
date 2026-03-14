from backend.database import SessionLocal
from backend.main import get_voucher
from backend.models import Voucher, VoucherEntry, InventoryEntry

db = SessionLocal()
try:
    print(get_voucher(59, db=db, company_id=1))
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
