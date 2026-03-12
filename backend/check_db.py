from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Company, User, Base
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/aivion_erp")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

from sqlalchemy import inspect
inspector = inspect(engine)
for table in inspector.get_table_names():
    cols = [col['name'] for col in inspector.get_columns(table)]
    print(f"Table: {table}, Columns: {cols}")

print("--- Companies ---")
try:
    companies = db.query(Company).all()
    if not companies:
        print("No companies found in database.")
    for c in companies:
        print(f"ID: {c.id}, Name: {c.name}")
except Exception as e:
    print(f"Error querying companies: {e}")

print("\n--- Users ---")
try:
    users = db.query(User).all()
    if not users:
        print("No users found in database.")
    for u in users:
        print(f"ID: {u.id}, Username: {u.username}, Role: {u.role}, Company ID: {u.company_id}")
except Exception as e:
    print(f"Error querying users: {e}")

db.close()
