import sys
import os

# Add the current directory to sys.path so we can import models and database
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, SessionLocal, SQLALCHEMY_DATABASE_URL
from .models import Base, User
from auth import get_password_hash

def setup_db():
    print(f"Connecting to database: {SQLALCHEMY_DATABASE_URL}")
    print("WARNING: This will drop all data in the database.")
    
    print("Dropping all existing tables...")
    Base.metadata.drop_all(bind=engine)
    
    print("Creating tables with new multi-tenant schema...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("Creating superadmin user...")
        superadmin = User(
            username="superadmin",
            password_hash=get_password_hash("admin123"),
            role="superadmin",
            company_id=None, # Superadmins have no company_id
            can_view_reports=True,
            can_manage_vouchers=True,
            can_manage_inventory=True,
            can_manage_masters=True
        )
        db.add(superadmin)
        db.commit()
        print("Superadmin created successfully!")
        print("Username: superadmin")
        print("Password: admin123")
    except Exception as e:
        print(f"Error creating superadmin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    setup_db()
