import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Add current folder to path so imports work
sys.path.append(os.getcwd())

if os.path.exists('backend/.env'):
    load_dotenv('backend/.env')
elif os.path.exists('.env'):
    load_dotenv('.env')

db_url = os.getenv('DATABASE_URL')
if not db_url:
    print("DATABASE_URL not found in .env")
    sys.exit(1)

engine = create_engine(db_url)

with engine.connect() as conn:
    print("\n--- Summary ---")
    res = conn.execute(text("SELECT id, name FROM companies"))
    companies = {row[0]: row[1] for row in res}
    print(f"Total Companies: {len(companies)}")
    for id, name in companies.items():
        print(f"  [{id}] {name}")
        
    target_guid = 'eec14209-f9cd-491e-a51f-7724aa4018a0-0000001e'
    print(f"\n--- Investigating Conflict for GUID: {target_guid} ---")
    
    # Check all rows with this GUID
    res = conn.execute(text(f"SELECT id, name, company_id, tally_guid FROM ledgers WHERE tally_guid = '{target_guid}'"))
    guid_rows = list(res)
    if not guid_rows:
        print("No row found with this GUID.")
    else:
        for row in guid_rows:
            comp_name = companies.get(row[2], 'Unknown')
            print(f"Row WITH GUID: ID={row[0]}, Name='{row[1]}', Company=[{row[2]}] {comp_name}")

    # Check the record that was being updated (ID 51)
    res = conn.execute(text(f"SELECT id, name, company_id, tally_guid FROM ledgers WHERE id = 51"))
    id_51_rows = list(res)
    if not id_51_rows:
        print("No row found with ID 51.")
    else:
        for row in id_51_rows:
            comp_name = companies.get(row[2], 'Unknown')
            print(f"Target Row (ID 51): Name='{row[1]}', Company=[{row[2]}] {comp_name}, Current GUID='{row[3]}'")

    print("\n--- Checking for Name Conflicts ---")
    if id_51_rows:
        target_name = id_51_rows[0][1]
        res = conn.execute(text(f"SELECT id, name, company_id, tally_guid FROM ledgers WHERE name = '{target_name}'"))
        for row in res:
            comp_name = companies.get(row[2], 'Unknown')
            print(f"Row with Name '{target_name}': ID={row[0]}, Company=[{row[2]}] {comp_name}, GUID='{row[3]}'")
