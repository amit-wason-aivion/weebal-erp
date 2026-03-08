from database import get_db, SessionLocal
from tally_push import generate_voucher_xml
from sqlalchemy.orm import Session
from models import Voucher

def test_xml():
    db = SessionLocal()
    voucher = db.query(Voucher).first()
    if voucher:
        xml = generate_voucher_xml(voucher.id, db)
        print("--- Generated Tally XML (Mock) ---")
        print(xml)
        print("--- End XML ---")
    else:
        print("No vouchers found in DB to test XML generation.")
    db.close()

if __name__ == "__main__":
    test_xml()
