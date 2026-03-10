import os
import json
from decimal import Decimal
from datetime import date, datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, status, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from google import genai
from google.genai import types
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = None
if GEMINI_API_KEY and "your_gemini" not in GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from typing import List

from .models import Base, Ledger, TallyGroup, Voucher, VoucherEntry, User, Company
from .accounting import AccountingEngine
from pydantic import BaseModel
from datetime import date

# Database setup moved to database.py
from .database import engine, get_db, init_db

# Initialize database tables
init_db()

from .tally_push import sync_voucher_to_tally
from .auth import get_current_user, create_access_token, verify_password, get_password_hash
from .seeders import seed_default_accounts

app = FastAPI(title="WEEBAL ERP API")

import os
from dotenv import load_dotenv

load_dotenv()

# Explicit CORS Origins
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
origins = [
    FRONTEND_URL,
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Global Error Catch: {str(exc)}")
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
    )
    # Add CORS headers manually to error response
    response.headers["Access-Control-Allow-Origin"] = FRONTEND_URL
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

class VoucherEntrySchema(BaseModel):
    ledger_id: int
    amount: float
    is_debit: bool

class VoucherSchema(BaseModel):
    voucher_type_id: int
    voucher_number: str
    date: date
    narration: str = None
    entries: List[VoucherEntrySchema]

class LedgerCreateSchema(BaseModel):
    name: str
    group_id: int
    opening_balance: float = 0.0
    is_debit_balance: bool = True

class StockItemCreateSchema(BaseModel):
    name: str
    hsn_sac: str = None
    gst_rate: float = 0.0
    uom_id: int

class CompanyCreateSchema(BaseModel):
    name: str
    address: Optional[str] = None
    state: Optional[str] = None
    pin_code: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    financial_year_from: date
    books_beginning_from: date

class GroupCreateSchema(BaseModel):
    name: str
    parent_id: Optional[int] = None
    company_id: Optional[int] = None # For Superadmin use

class UOMCreateSchema(BaseModel):
    symbol: str
    formal_name: Optional[str] = None
    company_id: Optional[int] = None # For Superadmin use

class CompanySplitSchema(BaseModel):
    new_financial_year_start: date

class UserCreateSchema(BaseModel):
    username: str
    password: str
    role: str = "user"
    company_id: Optional[int] = None # Optional for Superadmin provisioning
    can_view_reports: bool = True
    can_manage_vouchers: bool = True
    can_manage_inventory: bool = True
    can_manage_masters: bool = True

class UserUpdateSchema(BaseModel):
    password: Optional[str] = None
    role: Optional[str] = None
    can_view_reports: Optional[bool] = None
    can_manage_vouchers: Optional[bool] = None
    can_manage_inventory: Optional[bool] = None
    can_manage_masters: Optional[bool] = None

@app.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": user.role,
        "company_id": user.company_id,
        "permissions": {
            "reports": user.can_view_reports,
            "vouchers": user.can_manage_vouchers,
            "inventory": user.can_manage_inventory,
            "masters": user.can_manage_masters
        }
    }

@app.get("/api/companies")
def get_companies(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Superadmins can see all companies, Admins/Users only see their own
    if current_user.role == "superadmin":
        companies = db.query(Company).all()
    else:
        companies = db.query(Company).filter(Company.id == current_user.company_id).all()
        
    result = []
    for c in companies:
        result.append({
            "id": c.id,
            "name": c.name,
            "address": c.address,
            "state": c.state,
            "pin_code": c.pin_code,
            "telephone": c.telephone,
            "email": c.email,
            "financial_year_from": c.financial_year_from,
            "books_beginning_from": c.books_beginning_from
        })
    return result

@app.post("/api/companies")
def create_company(company_data: CompanyCreateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Only Superadmins can create companies")
    
    try:
        new_company = Company(**company_data.dict())
        db.add(new_company)
        db.flush() # Get ID for seeding
        
        # Seed standard Tally Chart of Accounts
        seed_default_accounts(db, new_company.id)
        
        db.commit()
        db.refresh(new_company)
        return {"message": "Company created successfully with default Chart of Accounts", "id": new_company.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create company: {str(e)}")

@app.post("/api/companies/{company_id}/split")
def split_company(company_id: int, split_data: CompanySplitSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Only Superadmins can split companies")
        
    source_company = db.query(Company).filter(Company.id == company_id).first()
    if not source_company:
        raise HTTPException(status_code=404, detail="Source company not found")
        
    # 1. Create New Company
    new_company = Company(
        name=f"{source_company.name} ({split_data.new_financial_year_start.year}-{str(split_data.new_financial_year_start.year + 1)[2:]})",
        address=source_company.address,
        state=source_company.state,
        pin_code=source_company.pin_code,
        telephone=source_company.telephone,
        email=source_company.email,
        financial_year_from=split_data.new_financial_year_start,
        books_beginning_from=split_data.new_financial_year_start
    )
    db.add(new_company)
    db.flush() # Get new_company.id
    
    # 2. Clone Groups
    old_groups = db.query(TallyGroup).filter(TallyGroup.company_id == company_id).all()
    group_map = {} # old_id -> new_id
    
    # First pass: create groups without parents
    for og in old_groups:
        ng = TallyGroup(
            name=og.name,
            company_id=new_company.id,
            tally_guid=f"SPLIT-{new_company.id}-{og.id}", # Prevent GUID collision
            alterid=0
        )
        db.add(ng)
        db.flush()
        group_map[og.id] = ng.id
        
    # Second pass: assign parents
    new_groups = db.query(TallyGroup).filter(TallyGroup.company_id == new_company.id).all()
    group_id_to_ng = {ng.id: ng for ng in new_groups}
    for og in old_groups:
        if og.parent_id and og.parent_id in group_map:
            new_parent_id = group_map[og.parent_id]
            group_id_to_ng[group_map[og.id]].parent_id = new_parent_id
            
    # 3. Clone Ledgers with Closing -> Opening balances
    engine = AccountingEngine(db, company_id)
    old_ledgers = db.query(Ledger).filter(Ledger.company_id == company_id).all()
    
    for ol in old_ledgers:
        bal_info = engine.calculate_ledger_closing_balance(ol.id)
        nl = Ledger(
            name=ol.name,
            group_id=group_map.get(ol.group_id),
            company_id=new_company.id,
            opening_balance=bal_info['closing_balance'],
            is_debit_balance=bal_info['is_debit'],
            bill_by_bill_enabled=ol.bill_by_bill_enabled,
            tally_guid=f"SPLIT-{new_company.id}-{ol.id}",
            alterid=0
        )
        db.add(nl)
        
    try:
        db.commit()
        return {"message": "Company split completed successfully", "new_company_id": new_company.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Split failed: {str(e)}")

# --- User Management APIs (Admin Only) ---

@app.get("/api/users")
def get_users(company_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "superadmin"]:
         raise HTTPException(status_code=403, detail="Admin or Superadmin access required")
    
    if current_user.role == "superadmin":
        if company_id:
            users = db.query(User).filter(User.company_id == company_id).all()
        else:
            users = db.query(User).all()
    else:
        users = db.query(User).filter(User.company_id == current_user.company_id).all()
    return [{
        "id": u.id,
        "username": u.username,
        "role": u.role,
        "company_id": u.company_id,
        "can_view_reports": u.can_view_reports,
        "can_manage_vouchers": u.can_manage_vouchers,
        "can_manage_inventory": u.can_manage_inventory,
        "can_manage_masters": u.can_manage_masters
    } for u in users]

@app.post("/api/users")
def create_user(user_data: UserCreateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "superadmin"]:
         raise HTTPException(status_code=403, detail="Admin or Superadmin access required")
    
    # Determine company_id
    target_company_id = current_user.company_id
    if current_user.role == "superadmin":
        if not user_data.company_id and user_data.role != "superadmin":
             raise HTTPException(status_code=400, detail="company_id is required for tenant users")
        target_company_id = user_data.company_id
    
    # Check if user exists
    existing = db.query(User).filter(User.username == user_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    new_user = User(
        username=user_data.username,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role,
        company_id=target_company_id,
        can_view_reports=user_data.can_view_reports,
        can_manage_vouchers=user_data.can_manage_vouchers,
        can_manage_inventory=user_data.can_manage_inventory,
        can_manage_masters=user_data.can_manage_masters
    )
    db.add(new_user)
    db.commit()
    return {"message": "User created successfully"}

@app.patch("/api/users/{user_id}")
def update_user(user_id: int, updates: UserUpdateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "superadmin"]:
         raise HTTPException(status_code=403, detail="Admin or Superadmin access required")
    
    if current_user.role == "superadmin":
        user = db.query(User).filter(User.id == user_id).first()
    else:
        user = db.query(User).filter(User.id == user_id, User.company_id == current_user.company_id).first()
        
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = updates.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field == "password" and value:
            user.password_hash = get_password_hash(value)
        else:
            setattr(user, field, value)
    
    db.commit()
    return {"message": "User updated successfully"}

@app.get("/api/ledgers")
def get_ledgers(company_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns a list of all ledgers for the active company."""
    target_cid = current_user.company_id
    if current_user.role == "superadmin" and company_id:
        target_cid = company_id
        
    if not target_cid:
        return []
        
    ledgers = db.query(Ledger).filter(Ledger.company_id == target_cid).all()
    return [{"id": l.id, "name": l.name, "group_id": l.group_id, "opening_balance": float(l.opening_balance), "is_debit_balance": l.is_debit_balance} for l in ledgers]

@app.post("/api/ledgers")
def create_ledger(ledger: LedgerCreateSchema, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Creates a new ledger and triggers sync."""
    if not current_user.can_manage_masters:
        raise HTTPException(status_code=403, detail="Permission denied to manage masters")
        
    target_cid = current_user.company_id
    # Note: LedgerCreateSchema doesn't have company_id, so we assume Superadmin is assigned to a company in frontend or context.
    # For now, if Superadmin company_id is None, we need a way to assign it.
    if target_cid is None and current_user.role == "superadmin":
         # Fallback: find the latest company or a default to prevent NULL failure if no company is selected
         latest = db.query(Company).order_by(Company.id.desc()).first()
         if latest:
             target_cid = latest.id
    
    if not target_cid:
        raise HTTPException(status_code=400, detail="No active company context for ledger creation")

    db_ledger = db.query(Ledger).filter(Ledger.name == ledger.name, Ledger.company_id == target_cid).first()
    if db_ledger:
        raise HTTPException(status_code=400, detail="Ledger already exists in this company")
    
    new_ledger = Ledger(
        name=ledger.name,
        group_id=ledger.group_id,
        company_id=target_cid,
        opening_balance=Decimal(str(ledger.opening_balance)),
        is_debit_balance=ledger.is_debit_balance
    )
    db.add(new_ledger)
    db.commit()
    db.refresh(new_ledger)
    
    return new_ledger

@app.get("/api/groups")
def get_groups(company_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns all Tally Groups."""
    from .models import TallyGroup
    target_cid = current_user.company_id
    if current_user.role == "superadmin" and company_id:
        target_cid = company_id

    if not target_cid:
        return []

    groups = db.query(TallyGroup).filter(TallyGroup.company_id == target_cid).all()
    # Include parent_id for local hierarchy mapping in frontend
    return [{"id": g.id, "name": g.name, "parent_id": g.parent_id} for g in groups]

@app.post("/api/groups")
def create_group(group: GroupCreateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Creates a new Tally Group."""
    if not current_user.can_manage_masters:
        raise HTTPException(status_code=403, detail="Permission denied to manage masters")
    
    target_cid = current_user.company_id or group.company_id
    
    if target_cid is None and current_user.role == "superadmin":
         latest = db.query(Company).order_by(Company.id.desc()).first()
         if latest:
             target_cid = latest.id

    if not target_cid:
        raise HTTPException(status_code=400, detail="No active company context for group creation")

    db_group = db.query(TallyGroup).filter(TallyGroup.name == group.name, TallyGroup.company_id == target_cid).first()
    if db_group:
        raise HTTPException(status_code=400, detail="Group already exists in this company")
    
    new_group = TallyGroup(
        name=group.name,
        company_id=target_cid,
        parent_id=group.parent_id
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return new_group

@app.post("/api/sync/import-ledgers")
def import_ledgers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Triggers sync of ledgers from Tally."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can trigger sync")
    from tally_sync import sync_ledgers_to_db
    result = sync_ledgers_to_db(db)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

# --- File-Based Sync Endpoints ---

class AppJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

@app.post("/api/sync/upload-tally-xml")
async def upload_tally_xml(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Accepts a Tally XML file and syncs data to PostgreSQL."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    content = await file.read()
    xml_text = content.decode("utf-8")
    
    from tally_sync import sync_ledgers_to_db, sync_vouchers_to_db
    # Try syncing both as the file might contain both or just one
    l_res = sync_ledgers_to_db(db, xml_content=xml_text)
    v_res = sync_vouchers_to_db(db, xml_content=xml_text)
    
    return {
        "ledgers": l_res.get("message", l_res.get("error")),
        "transactions": v_res.get("message", v_res.get("error"))
    }

@app.get("/api/sync/export-app-data")
def export_app_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Exports all master and transaction data to a JSON backup."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from .models import TallyGroup, Ledger, Voucher, VoucherEntry, StockItem, UnitOfMeasure
    
    data = {
        "groups": [vars(g) for g in db.query(TallyGroup).filter(TallyGroup.company_id == current_user.company_id).all()],
        "ledgers": [vars(l) for l in db.query(Ledger).filter(Ledger.company_id == current_user.company_id).all()],
        "vouchers": [vars(v) for v in db.query(Voucher).filter(Voucher.company_id == current_user.company_id).all()],
        "voucher_entries": [vars(ve) for ve in db.query(VoucherEntry).join(Voucher).filter(Voucher.company_id == current_user.company_id).all()],
        "stock_items": [vars(si) for si in db.query(StockItem).filter(StockItem.company_id == current_user.company_id).all()],
        "uoms": [vars(u) for u in db.query(UnitOfMeasure).filter(UnitOfMeasure.company_id == current_user.company_id).all()]
    }
    
    # Remove SQLAlchemy state
    for k in data:
        for item in data[k]:
            item.pop('_sa_instance_state', None)
            
    filename = f"aivion_backup_{date.today().strftime('%Y%m%d')}.json"
    filepath = os.path.join("C:/tmp", filename) # Correct path for Windows tmp
    if not os.path.exists("C:/tmp"):
        os.makedirs("C:/tmp")
    
    with open(filepath, "w") as f:
        json.dump(data, f, cls=AppJSONEncoder, indent=4)
        
    return FileResponse(filepath, media_type='application/json', filename=filename)

@app.get("/api/sync/export-tally-xml")
def export_tally_xml(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Generates and returns a bulk Tally XML export file."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from tally_export import generate_bulk_tally_xml
    xml_content = generate_bulk_tally_xml(db)
    
    from fastapi import Response
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={
            "Content-Disposition": f"attachment; filename=aivion_to_tally_export_{date.today().strftime('%Y%m%d')}.xml"
        }
    )

@app.post("/api/sync/upload-app-json")
async def upload_app_json(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Restores data from an AIVION native JSON backup."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    content = await file.read()
    try:
        data = json.loads(content)
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    from .models import TallyGroup, Ledger, Voucher, VoucherEntry, StockItem, UnitOfMeasure
    
    # Simple restore logic (UPSERT by ID or Name where applicable)
    try:
        # Import Groups
        for g_data in data.get('groups', []):
            group = db.query(TallyGroup).filter(TallyGroup.name == g_data['name']).first()
            if not group:
                group = TallyGroup(name=g_data['name'], parent_id=g_data.get('parent_id'), tally_guid=g_data.get('tally_guid'))
                db.add(group)
        db.flush()

        # Import Ledgers
        for l_data in data.get('ledgers', []):
            ledger = db.query(Ledger).filter(Ledger.name == l_data['name']).first()
            if not ledger:
                # Remove ID if present to avoid conflicts
                l_data.pop('id', None)
                ledger = Ledger(**l_data)
                db.add(ledger)
        db.flush()
        
        # Import Vouchers & Entries
        for v_data in data.get('vouchers', []):
            vch = db.query(Voucher).filter(Voucher.tally_guid == v_data.get('tally_guid')).first()
            if not vch:
                v_data.pop('id', None)
                vch = Voucher(**v_data)
                db.add(vch)
        db.flush()
        
        db.commit()
        return {"message": "Data restored successfully from backup."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/trial-balance")
def get_trial_balance(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Calls the accounting engine to calculate the real-time hierarchical trial balance."""
    if not current_user.can_view_reports:
        raise HTTPException(status_code=403, detail="Permission denied")
    engine = AccountingEngine(db, current_user.company_id)
    try:
        tb_data = engine.generate_hierarchical_trial_balance()
        return tb_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/pnl")
def get_pnl(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Generates the Profit and Loss statement."""
    if not current_user.can_view_reports:
        raise HTTPException(status_code=403, detail="Permission denied")
    engine = AccountingEngine(db, current_user.company_id)
    try:
        pnl_data = engine.generate_pnl()
        return pnl_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/balance-sheet")
def get_balance_sheet(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Generates the Balance Sheet integrating Net Profit."""
    if not current_user.can_view_reports:
        raise HTTPException(status_code=403, detail="Permission denied")
    engine = AccountingEngine(db, current_user.company_id)
    try:
        bs_data = engine.generate_balance_sheet()
        return bs_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/vouchers")
def create_voucher(voucher: VoucherSchema, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Creates a new voucher and validates double-entry logic before commit.
    """
    if not current_user.can_manage_vouchers:
        raise HTTPException(status_code=403, detail="Permission denied to manage vouchers")
        
    from decimal import Decimal
    
    # Calculate Total Dr and Cr
    total_dr = sum([Decimal(str(e.amount)) for e in voucher.entries if e.is_debit])
    total_cr = sum([Decimal(str(e.amount)) for e in voucher.entries if not e.is_debit])
    
    if total_dr != total_cr:
        raise HTTPException(status_code=400, detail=f"Double-entry violation: Total Dr {total_dr} != Total Cr {total_cr}")
        
    # Check ledgers exist and belong to company
    ledger_ids = [e.ledger_id for e in voucher.entries]
    db_ledgers = db.query(Ledger).filter(Ledger.id.in_(ledger_ids), Ledger.company_id == current_user.company_id).all()
    if len(db_ledgers) != len(set(ledger_ids)):
        raise HTTPException(status_code=400, detail="One or more specified ledgers do not exist in this company.")

    try:
        new_voucher = Voucher(
            company_id=current_user.company_id,
            voucher_type_id=voucher.voucher_type_id,
            voucher_number=voucher.voucher_number,
            date=voucher.date,
            narration=voucher.narration
        )
        db.add(new_voucher)
        db.flush() # flush to get the voucher id
        
        for entry in voucher.entries:
            new_entry = VoucherEntry(
                voucher_id=new_voucher.id,
                ledger_id=entry.ledger_id,
                amount=Decimal(str(entry.amount)),
                is_debit=entry.is_debit
            )
            db.add(new_entry)
            
        db.commit()
        
        # Trigger Tally Sync in Background
        background_tasks.add_task(sync_voucher_to_tally, new_voucher.id, db)
        
        return {"message": "Voucher created successfully", "voucher_id": new_voucher.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create voucher: {str(e)}")

@app.put("/api/vouchers/{id}")
def update_voucher(id: int, voucher: VoucherSchema, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Updates an existing voucher using Delete & Re-insert strategy.
    """
    if not current_user.can_manage_vouchers:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    from decimal import Decimal
    
    # 1. Double-entry validation
    total_dr = sum([Decimal(str(e.amount)) for e in voucher.entries if e.is_debit])
    total_cr = sum([Decimal(str(e.amount)) for e in voucher.entries if not e.is_debit])
    
    if total_dr != total_cr:
        raise HTTPException(status_code=400, detail=f"Double-entry violation: Total Dr {total_dr} != Total Cr {total_cr}")

    # 2. Check header exists and belongs to company
    db_voucher = db.query(Voucher).filter(Voucher.id == id, Voucher.company_id == current_user.company_id).first()
    if not db_voucher:
        raise HTTPException(status_code=404, detail="Voucher not found in this company")

    try:
        # 3. Delete existing entries (implicitly safe as parent is filtered)
        db.query(VoucherEntry).filter(VoucherEntry.voucher_id == id).delete()
        
        # 4. Update header
        db_voucher.voucher_type_id = voucher.voucher_type_id
        db_voucher.voucher_number = voucher.voucher_number
        db_voucher.date = voucher.date
        db_voucher.narration = voucher.narration
        
        # 5. Insert new entries
        for entry in voucher.entries:
            new_entry = VoucherEntry(
                voucher_id=id,
                ledger_id=entry.ledger_id,
                amount=Decimal(str(entry.amount)),
                is_debit=entry.is_debit
            )
            db.add(new_entry)
            
        db.commit()
        
        # Trigger Tally Sync in Background
        background_tasks.add_task(sync_voucher_to_tally, id, db)
        
        return {"message": "Voucher updated successfully", "voucher_id": id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update voucher: {str(e)}")

# --- Phase 8.5: Sales Invoice Logic ---

from .models import StockItem, InventoryEntry

class SalesInvoiceItemSchema(BaseModel):
    stock_item_id: int
    quantity: float
    rate: float
    amount: float
    gst_rate: float

class SalesInvoiceSchema(BaseModel):
    party_ledger_id: int
    sales_ledger_id: int
    is_interstate: bool      # True if Party is from a different state
    date: date
    voucher_number: str
    place_of_supply: str = None
    items: List[SalesInvoiceItemSchema]
    
    # Auto-calculated tax totals from frontend (must be validated)
    total_tax_amount: float
    net_amount: float

@app.get("/api/stock-items")
def get_stock_items(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns a list of all stock items for the company."""
    items = db.query(StockItem).filter(StockItem.company_id == current_user.company_id).all()
    return [{"id": i.id, "name": i.name, "hsn_sac": i.hsn_sac, "gst_rate": float(i.gst_rate)} for i in items]

@app.post("/api/inventory/items")
def create_stock_item(item: StockItemCreateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Creates a new stock item."""
    if not current_user.can_manage_inventory:
         raise HTTPException(status_code=403, detail="Permission denied")
         
    from decimal import Decimal
    db_item = db.query(StockItem).filter(StockItem.name == item.name, StockItem.company_id == current_user.company_id).first()
    if db_item:
        raise HTTPException(status_code=400, detail="Stock Item already exists in this company")
    
    new_item = StockItem(
        name=item.name,
        company_id=current_user.company_id,
        hsn_sac=item.hsn_sac,
        gst_rate=Decimal(str(item.gst_rate)),
        uom_id=item.uom_id
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@app.get("/api/uoms")
def get_uoms(company_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns a list of all Units of Measure for the active company."""
    from .models import UnitOfMeasure
    target_cid = current_user.company_id
    if current_user.role == "superadmin" and company_id:
        target_cid = company_id
        
    if not target_cid:
        return []
        
    uoms = db.query(UnitOfMeasure).filter(UnitOfMeasure.company_id == target_cid).all()
    return [{"id": u.id, "symbol": u.symbol, "formal_name": u.formal_name} for u in uoms]

@app.post("/api/uoms")
def create_uom(uom: UOMCreateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Creates a new Unit of Measure."""
    from .models import UnitOfMeasure
    if not current_user.can_manage_masters:
        raise HTTPException(status_code=403, detail="Permission denied to manage masters")
    
    target_cid = current_user.company_id or uom.company_id
    
    if target_cid is None and current_user.role == "superadmin":
         latest = db.query(Company).order_by(Company.id.desc()).first()
         if latest:
             target_cid = latest.id

    if not target_cid:
        raise HTTPException(status_code=400, detail="No active company context for UOM creation")

    db_uom = db.query(UnitOfMeasure).filter(UnitOfMeasure.symbol == uom.symbol, UnitOfMeasure.company_id == target_cid).first()
    if db_uom:
        raise HTTPException(status_code=400, detail="UOM already exists in this company")
    
    new_uom = UnitOfMeasure(
        symbol=uom.symbol,
        formal_name=uom.formal_name,
        company_id=target_cid
    )
    db.add(new_uom)
    db.commit()
    db.refresh(new_uom)
    return new_uom

@app.post("/api/sales-invoice")
def create_sales_invoice(invoice: SalesInvoiceSchema, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Creates a Sales Invoice:
    1. Voucher Header
    2. Inventory Deductions
    3. Double Entry Accounting (Party Dr, Sales Cr, Taxes Cr)
    """
    from decimal import Decimal
    
    if not current_user.can_manage_vouchers:
        raise HTTPException(status_code=403, detail="Permission denied to manage vouchers")
        
    try:
        # 1. Create main header record in Vouchers (Type 2 = Sales)
        new_voucher = Voucher(
            company_id=current_user.company_id,
            voucher_type_id=2, 
            voucher_number=invoice.voucher_number,
            date=invoice.date,
            narration=f"Sales Invoice to {invoice.place_of_supply}"
        )
        db.add(new_voucher)
        db.flush()
        
        gross_total = Decimal('0.0000')
        total_cgst = Decimal('0.0000')
        total_sgst = Decimal('0.0000')
        total_igst = Decimal('0.0000')
        
        # 2. Inventory Impact
        for item in invoice.items:
            qty = Decimal(str(item.quantity))
            rate = Decimal(str(item.rate))
            amount = Decimal(str(item.amount))
            gross_total += amount
            
            # Inventory Outward (Sales)
            inv_entry = InventoryEntry(
                voucher_id=new_voucher.id,
                stock_item_id=item.stock_item_id,
                quantity=qty,
                rate=rate,
                amount=amount,
                is_inward=False 
            )
            db.add(inv_entry)
            
            # Compute Taxes
            tax_amount = amount * (Decimal(str(item.gst_rate)) / 100)
            if invoice.is_interstate:
                total_igst += tax_amount
            else:
                total_cgst += tax_amount / 2
                total_sgst += tax_amount / 2
        
        net_total = gross_total + total_cgst + total_sgst + total_igst

        # Create Ledger entries dynamically if tax ledgers don't exist for the sake of the demo
        def get_or_create_ledger(name, group_name="Duties & Taxes", is_debit=False):
            ledger = db.query(Ledger).filter(Ledger.name == name, Ledger.company_id == current_user.company_id).first()
            if not ledger:
                from models import TallyGroup
                group = db.query(TallyGroup).filter(TallyGroup.name == group_name, TallyGroup.company_id == current_user.company_id).first()
                if not group:
                    group = TallyGroup(name=group_name, company_id=current_user.company_id)
                    db.add(group)
                    db.flush()
                ledger = Ledger(name=name, group_id=group.id, company_id=current_user.company_id, is_debit_balance=is_debit)
                db.add(ledger)
                db.flush()
            return ledger.id

        cgst_id = get_or_create_ledger("CGST")
        sgst_id = get_or_create_ledger("SGST")
        igst_id = get_or_create_ledger("IGST")

        # 3. Accounting Impact (Double Entry)
        # Debit Party
        db.add(VoucherEntry(voucher_id=new_voucher.id, ledger_id=invoice.party_ledger_id, amount=net_total, is_debit=True))
        
        # Credit Sales
        db.add(VoucherEntry(voucher_id=new_voucher.id, ledger_id=invoice.sales_ledger_id, amount=gross_total, is_debit=False))
        
        # Credit Taxes
        if invoice.is_interstate and total_igst > 0:
            db.add(VoucherEntry(voucher_id=new_voucher.id, ledger_id=igst_id, amount=total_igst, is_debit=False))
        elif not invoice.is_interstate:
            if total_cgst > 0:
                db.add(VoucherEntry(voucher_id=new_voucher.id, ledger_id=cgst_id, amount=total_cgst, is_debit=False))
            if total_sgst > 0:
                db.add(VoucherEntry(voucher_id=new_voucher.id, ledger_id=sgst_id, amount=total_sgst, is_debit=False))
                
        db.commit()
        
        # Trigger Tally Sync in Background
        background_tasks.add_task(sync_voucher_to_tally, new_voucher.id, db)
        
        return {"message": "Sales Invoice processed successfully and inventory reduced.", "voucher_id": new_voucher.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to process sales invoice: {str(e)}")

@app.put("/api/sales-invoice/{id}")
def update_sales_invoice(id: int, invoice: SalesInvoiceSchema, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Updates an existing Sales Invoice using Delete & Re-insert strategy.
    """
    if not current_user.can_manage_vouchers:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    db_voucher = db.query(Voucher).filter(Voucher.id == id, Voucher.company_id == current_user.company_id).first()
    if not db_voucher:
        raise HTTPException(status_code=404, detail="Voucher not found in this company")

    try:
        # 1. Atomic Cleanup: Delete all entries tied to this voucher
        db.query(VoucherEntry).filter(VoucherEntry.voucher_id == id).delete()
        db.query(InventoryEntry).filter(InventoryEntry.voucher_id == id).delete()

        # 2. Update Header
        db_voucher.voucher_number = invoice.voucher_number
        db_voucher.date = invoice.date
        db_voucher.narration = f"Sales Invoice to {invoice.place_of_supply}"
        
        gross_total = Decimal('0.0000')
        total_cgst = Decimal('0.0000')
        total_sgst = Decimal('0.0000')
        total_igst = Decimal('0.0000')

        # 3. Inventory Re-Insertion
        for item in invoice.items:
            qty = Decimal(str(item.quantity))
            rate = Decimal(str(item.rate))
            amount = Decimal(str(item.amount))
            gross_total += amount
            
            # Inventory Outward
            inv_entry = InventoryEntry(
                voucher_id=id,
                stock_item_id=item.stock_item_id,
                quantity=qty,
                rate=rate,
                amount=amount,
                is_inward=False 
            )
            db.add(inv_entry)
            
            # Re-compute Taxes
            tax_amount = amount * (Decimal(str(item.gst_rate)) / 100)
            if invoice.is_interstate:
                total_igst += tax_amount
            else:
                total_cgst += tax_amount / 2
                total_sgst += tax_amount / 2
        
        net_total = gross_total + total_cgst + total_sgst + total_igst

        # Reuse tax ledger helper (ensure they exist)
        def get_or_create_ledger(name, group_name="Duties & Taxes", is_debit=False):
            ledger = db.query(Ledger).filter(Ledger.name == name, Ledger.company_id == current_user.company_id).first()
            if not ledger:
                from models import TallyGroup
                group = db.query(TallyGroup).filter(TallyGroup.name == group_name, TallyGroup.company_id == current_user.company_id).first()
                if not group:
                    group = TallyGroup(name=group_name, company_id=current_user.company_id)
                    db.add(group)
                    db.flush()
                ledger = Ledger(name=name, group_id=group.id, company_id=current_user.company_id, is_debit_balance=is_debit)
                db.add(ledger)
                db.flush()
            return ledger.id

        cgst_id = get_or_create_ledger("CGST")
        sgst_id = get_or_create_ledger("SGST")
        igst_id = get_or_create_ledger("IGST")

        # 4. Accounting Re-Insertion
        db.add(VoucherEntry(voucher_id=id, ledger_id=invoice.party_ledger_id, amount=net_total, is_debit=True))
        db.add(VoucherEntry(voucher_id=id, ledger_id=invoice.sales_ledger_id, amount=gross_total, is_debit=False))
        
        if invoice.is_interstate and total_igst > 0:
            db.add(VoucherEntry(voucher_id=id, ledger_id=igst_id, amount=total_igst, is_debit=False))
        elif not invoice.is_interstate:
            if total_cgst > 0:
                db.add(VoucherEntry(voucher_id=id, ledger_id=cgst_id, amount=total_cgst, is_debit=False))
            if total_sgst > 0:
                db.add(VoucherEntry(voucher_id=id, ledger_id=sgst_id, amount=total_sgst, is_debit=False))
                
        db.commit()
        
        # Trigger Tally Sync in Background
        background_tasks.add_task(sync_voucher_to_tally, id, db)
        
        return {"message": "Sales Invoice updated successfully.", "voucher_id": id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update sales invoice: {str(e)}")

@app.get("/api/vouchers/{id}")
def get_voucher(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns details for a specific voucher including inventory and entries."""
    from .models import VoucherType, InventoryEntry, StockItem

    voucher = db.query(Voucher).filter(Voucher.id == id, Voucher.company_id == current_user.company_id).first()
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found in this company")

    vtype = db.query(VoucherType).filter(VoucherType.id == voucher.voucher_type_id).first()
    
    entries = db.query(VoucherEntry).filter(VoucherEntry.voucher_id == voucher.id).all()
    inventory = db.query(InventoryEntry, StockItem).join(StockItem).filter(InventoryEntry.voucher_id == voucher.id).all()

    return {
        "id": voucher.id,
        "voucher_type": vtype.name if vtype else "Unknown",
        "voucher_type_id": voucher.voucher_type_id,
        "voucher_number": voucher.voucher_number,
        "date": voucher.date,
        "narration": voucher.narration,
        "entries": [
            {
                "ledger_id": e.ledger_id,
                "amount": float(e.amount),
                "is_debit": e.is_debit
            } for e in entries
        ],
        "inventory": [
            {
                "stock_item_id": i.stock_item_id,
                "stock_item_name": s.name,
                "quantity": float(i.quantity),
                "rate": float(i.rate),
                "amount": float(i.amount),
                "is_inward": i.is_inward
            } for i, s in inventory
        ]
    }

# --- Phase 11: Drill-Down Engine & Day Book ---

@app.get("/api/ledgers/{ledger_id}/vouchers")
def get_ledger_vouchers(ledger_id: int, start_date: str = None, end_date: str = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns chronological list of Voucher_Entries for a specific ledger."""
    from .models import VoucherType, Ledger

    ledger = db.query(Ledger).filter(Ledger.id == ledger_id, Ledger.company_id == current_user.company_id).first()
    if not ledger:
        raise HTTPException(status_code=404, detail="Ledger not found in this company")

    # Base query for opening balance (entries before start_date)
    opening_balance = float(ledger.opening_balance)
    if not ledger.is_debit_balance:
        opening_balance = -opening_balance

    if start_date:
        past_entries = db.query(VoucherEntry).join(Voucher).filter(
            VoucherEntry.ledger_id == ledger_id,
            Voucher.date < start_date
        ).all()
        for pe in past_entries:
            if pe.is_debit:
                opening_balance += float(pe.amount)
            else:
                opening_balance -= float(pe.amount)

    query = db.query(VoucherEntry, Voucher, VoucherType).join(
        Voucher, VoucherEntry.voucher_id == Voucher.id
    ).join(
        VoucherType, Voucher.voucher_type_id == VoucherType.id
    ).filter(VoucherEntry.ledger_id == ledger_id).order_by(Voucher.date.asc())

    if start_date:
        query = query.filter(Voucher.date >= start_date)
    if end_date:
        query = query.filter(Voucher.date <= end_date)

    entries = query.all()
    
    result_entries = []
    current_balance = opening_balance
    
    for entry, voucher, vtype in entries:
        # Find the opposite ledger for "Particulars"
        opposite_entries = db.query(VoucherEntry).filter(
            VoucherEntry.voucher_id == voucher.id,
            VoucherEntry.id != entry.id
        ).all()
        
        particulars = "Multiple"
        if len(opposite_entries) == 1:
            opposite_ledger = db.query(Ledger).filter(Ledger.id == opposite_entries[0].ledger_id).first()
            if opposite_ledger:
                particulars = opposite_ledger.name
        elif len(opposite_entries) > 1:
            particulars = "As per details"
            
        amt = float(entry.amount)
        if entry.is_debit:
            current_balance += amt
        else:
            current_balance -= amt
            
        result_entries.append({
            "id": entry.id,
            "date": voucher.date,
            "particulars": particulars,
            "voucher_type": vtype.name,
            "voucher_number": voucher.voucher_number,
            "debit": amt if entry.is_debit else 0,
            "credit": amt if not entry.is_debit else 0,
            "balance": abs(current_balance),
            "is_debit_balance": current_balance >= 0,
            "voucher_id": voucher.id
        })

    return {
        "ledger_name": ledger.name,
        "opening_balance": abs(opening_balance),
        "is_opening_debit": opening_balance >= 0,
        "closing_balance": abs(current_balance),
        "is_closing_debit": current_balance >= 0,
        "entries": result_entries
    }

@app.get("/api/daybook")
def get_daybook(date: str = None, start_date: str = None, end_date: str = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns all vouchers for a specific date or date range."""
    from .models import VoucherType, Ledger

    query = db.query(Voucher, VoucherType).join(VoucherType).filter(Voucher.company_id == current_user.company_id)
    
    if date:
        query = query.filter(Voucher.date == date)
    else:
        if start_date:
            query = query.filter(Voucher.date >= start_date)
        if end_date:
            query = query.filter(Voucher.date <= end_date)

    query = query.order_by(Voucher.date.asc(), Voucher.id.asc())
    vouchers = query.all()
    
    result = []
    for voucher, vtype in vouchers:
        entries = db.query(VoucherEntry).filter(VoucherEntry.voucher_id == voucher.id).all()
        # Find the primary ledger for the daybook row
        particulars = "Multiple"
        if len(entries) > 0:
            first_entry_ledger = db.query(Ledger).filter(Ledger.id == entries[0].ledger_id).first()
            if first_entry_ledger:
                particulars = first_entry_ledger.name
                
        debit_amount = sum(float(e.amount) for e in entries if e.is_debit)
        credit_amount = sum(float(e.amount) for e in entries if not e.is_debit)

        result.append({
            "id": voucher.id,
            "date": voucher.date,
            "particulars": particulars,
            "voucher_type": vtype.name,
            "voucher_number": voucher.voucher_number,
            "debit": debit_amount,
            "credit": credit_amount
        })
    return result

# --- Phase 14: Gen AI-Led Invoice Processing ---

@app.post("/api/ai/extract-invoice")
async def extract_invoice(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """
    Uses Google Gemini AI to extract structured data from an invoice image or PDF.
    """
    if not client:
        raise HTTPException(status_code=500, detail="Gemini AI Client is not initialized. Please ensure GEMINI_API_KEY is set in your .env file.")

    try:
        # Read the file content
        content = await file.read()
        
        # Prepare the prompt
        prompt = """
        You are an expert accountant. Analyze the attached invoice and extract the following details accurately. 
        Return ONLY a strict, valid JSON object with NO markdown formatting, NO backticks, and NO explanatory text.
        
        The JSON schema MUST be:
        {
          "party_name": "str",
          "invoice_number": "str",
          "date": "YYYY-MM-DD",
          "line_items": [
            {
              "item_name": "str",
              "quantity": float,
              "rate": float,
              "tax_percentage": float,
              "total_amount": float
            }
          ]
        }
        """
        
        # Send to Gemini
        response = client.models.generate_content(
            model='gemini-flash-latest',
            contents=[
                prompt,
                types.Part.from_bytes(data=content, mime_type=file.content_type)
            ]
        )
        
        # Parse result
        raw_text = response.text.strip()
        
        # Clean up in case Gemini provides markdown blocks despite instructions
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        
        extracted_data = json.loads(raw_text.strip())
        return extracted_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Extraction failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
