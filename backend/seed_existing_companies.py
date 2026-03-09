import sys
import os
from sqlalchemy.orm import Session

# Add the current directory to sys.path so we can import models and database
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, SessionLocal
from models import Company
from seeders import seed_default_inventory

def seed_existing():
    db = SessionLocal()
    try:
        companies = db.query(Company).all()
        print(f"Found {len(companies)} companies. Starting retroactive inventory seeding...")
        
        for company in companies:
            print(f"Seeding inventory for: {company.name} (ID: {company.id})...")
            # seed_default_inventory handles existence checks internally
            seed_default_inventory(db, company.id)
            print(f"  - Done for {company.name}")
        
        db.commit()
        print("\nSuccess: Retroactive inventory seeding completed for all companies.")
    except Exception as e:
        db.rollback()
        print(f"\nError during retroactive seeding: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_existing()
