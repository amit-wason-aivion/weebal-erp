from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import TallyGroup, Ledger, VoucherType, Company, UnitOfMeasure, Godown

DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/aivion_erp"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

print("--- Companies ---")
companies = db.query(Company).all()
for c in companies:
    print(f"ID: {c.id}, Name: {c.name}")

latest_company = db.query(Company).order_by(Company.id.desc()).first()
if latest_company:
    cid = latest_company.id
    print(f"\n--- Data for Company ID: {cid} ({latest_company.name}) ---")
    
    group_count = db.query(TallyGroup).filter(TallyGroup.company_id == cid).count()
    print(f"Groups: {group_count}")
    
    ledger_count = db.query(Ledger).filter(Ledger.company_id == cid).count()
    print(f"Ledgers: {ledger_count}")
    
    vt_count = db.query(VoucherType).filter(VoucherType.company_id == cid).count()
    print(f"Voucher Types: {vt_count}")
    
    uom_count = db.query(UnitOfMeasure).filter(UnitOfMeasure.company_id == cid).count()
    print(f"Units of Measure: {uom_count}")
    
    godown_count = db.query(Godown).filter(Godown.name == "Main Location", Godown.company_id == cid).count()
    print(f"Default Godown (Main Location): {'Found' if godown_count > 0 else 'Not Found'}")
    
    if ledger_count > 0:
        ledgers = db.query(Ledger).filter(Ledger.company_id == cid).all()
        for l in ledgers:
            print(f"  Ledger: {l.name}")
            
db.close()
