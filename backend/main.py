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
import traceback
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = None
if GEMINI_API_KEY and "your_gemini" not in GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from typing import List

from .models import Base, Ledger, TallyGroup, Voucher, VoucherEntry, User, Company, SalaryHistory
from .accounting import AccountingEngine
from pydantic import BaseModel
from datetime import date

# Database setup moved to database.py
from .database import engine, get_db, init_db
from .tally_push import sync_voucher_to_tally
from .auth import get_current_user, create_access_token, verify_password, get_password_hash, get_current_company, check_report_access, check_admin_access
from .seeders import seed_default_accounts
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Task 2: Automated Database Initialization & Migration
    print("Initializing database tables...")
    from .database import init_db
    from .migrate_v2 import migrate
    init_db()
    migrate()
    print("Database tables & migrations verified successfully.")
    yield

app = FastAPI(title="WEEBAL ERP API", lifespan=lifespan)

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
    error_msg = f"Global Error Catch: {type(exc).__name__}: {str(exc)}\n{traceback.format_exc()}"
    print(error_msg)
    try:
        with open("backend_error.log", "a") as f:
            f.write(f"\n--- {datetime.now()} ---\n")
            f.write(f"URL: {request.url}\n")
            f.write(error_msg)
            f.write("\n" + "="*50 + "\n")
    except Exception as log_error:
        print(f"FAILED TO LOG TO FILE: {log_error}")
    
    return JSONResponse(
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
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gstin: Optional[str] = None
    pan_no: Optional[str] = None
    drug_license_no: Optional[str] = None
    fssai_no: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_type: Optional[str] = None
    tax_percentage: Optional[float] = None
    tax_head: Optional[str] = None
    employee_id: Optional[str] = None
    designation: Optional[str] = None
    bank_name: Optional[str] = None
    primary_pan: Optional[str] = None
    basic_pay: Optional[float] = 0.0
    da_pay: Optional[float] = 0.0
    hra_pay: Optional[float] = 0.0
    other_allowances: Optional[float] = 0.0
    total_ctc: Optional[float] = 0.0
    monitoring_enabled: Optional[bool] = False
    attendance_source: Optional[str] = None
    shift_type: Optional[str] = None

class SalaryHistorySchema(BaseModel):
    id: int
    ledger_id: int
    effective_date: date
    old_salary: float
    new_salary: float
    change_percentage: Optional[float] = None

    class Config:
        from_attributes = True

class SalaryRevisionSchema(BaseModel):
    effective_date: date
    new_salary: float

class StockItemCreateSchema(BaseModel):
    name: str
    hsn_sac: str = None
    gst_rate: float = 0.0
    uom_id: int
    salt_composition: Optional[str] = None
    rack_number: Optional[str] = None
    main_unit_name: Optional[str] = None
    sub_unit_name: Optional[str] = None
    conversion_factor: Optional[int] = 1
    min_stock_level: Optional[int] = 0
    is_narcotic: Optional[bool] = False
    is_h1: Optional[bool] = False

class StockBatchSchema(BaseModel):
    batch_no: str
    expiry_date: date
    opening_stock: float = 0.0

class CompanyCreateSchema(BaseModel):
    name: str
    address: Optional[str] = None
    state: Optional[str] = None
    pin_code: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    drug_license_no: Optional[str] = None
    fssai_no: Optional[str] = None
    company_type: Optional[str] = "GENERAL"
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
    role: str = "Operator"
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

@app.get("/api/voucher-types")
def get_voucher_types(db: Session = Depends(get_db), company_id: int = Depends(get_current_company)):
    """Returns all voucher types for the active company."""
    from .models import VoucherType
    vtypes = db.query(VoucherType).filter(VoucherType.company_id == company_id).all()
    return [{"id": v.id, "name": v.name, "parent_type": v.parent_type} for v in vtypes]

@app.get("/api/vouchers")
def get_vouchers(db: Session = Depends(get_db), company_id: int = Depends(get_current_company)):
    """Daybook: Returns all vouchers for the company."""
    vouchers = db.query(Voucher).filter(Voucher.company_id == company_id).order_by(Voucher.date.desc()).all()
    result = []
    for v in vouchers:
        vtype = db.query(VoucherType).filter(VoucherType.id == v.voucher_type_id).first()
        entries = db.query(VoucherEntry, Ledger.name).join(Ledger).filter(VoucherEntry.voucher_id == v.id).all()
        
        # Calculate total (Sum of debits)
        debit_amount = sum([float(e[0].amount) for e in entries if e[0].is_debit])
        credit_amount = sum([float(e[0].amount) for e in entries if not e[0].is_debit])
        
        # Summary for particulars: display first few ledgers
        particulars = ", ".join([e[1] for e in entries[:2]]) + ("..." if len(entries) > 2 else "")
        
        result.append({
            "id": v.id,
            "date": v.date,
            "particulars": particulars,
            "voucher_type": vtype.name if vtype else "Journal",
            "voucher_number": v.voucher_number,
            "debit": debit_amount,
            "credit": credit_amount
        })
    return result

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
            "gstin": c.gstin,
            "drug_license_no": c.drug_license_no,
            "fssai_no": c.fssai_no,
            "company_type": c.company_type,
            "financial_year_from": c.financial_year_from,
            "books_beginning_from": c.books_beginning_from
        })
    return result

@app.put("/api/companies/{company_id}")
def update_company(company_id: int, company_data: CompanyCreateSchema, db: Session = Depends(get_db), current_user: User = Depends(check_admin_access)):
    """Allows updating company details (name, type, etc.). Restricted to company admins or superadmins."""
    # Ensure current user is authorized for THIS company
    if current_user.role != "superadmin" and current_user.company_id != company_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this company")
    
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Update fields
    for key, value in company_data.dict().items():
        setattr(db_company, key, value)
    
    db.commit()
    db.refresh(db_company)
    return db_company

@app.post("/api/companies")
def create_company(company_data: CompanyCreateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Only Superadmins can create companies")
    
    try:
        # Ensure database tables exist before creating a company
        init_db()
        
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
        gstin=source_company.gstin,
        drug_license_no=source_company.drug_license_no,
        company_type=source_company.company_type,
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
def get_users(company_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(check_admin_access)):
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
def create_user(user_data: UserCreateSchema, db: Session = Depends(get_db), current_user: User = Depends(check_admin_access)):
    # Check if user exists
    db_user = db.query(User).filter(User.username == user_data.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    # Determine company_id
    target_company_id = current_user.company_id
    if current_user.role == "superadmin":
        if not user_data.company_id and user_data.role != "superadmin":
             raise HTTPException(status_code=400, detail="company_id is required for tenant users")
        target_company_id = user_data.company_id
    
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
def update_user(user_id: int, updates: UserUpdateSchema, db: Session = Depends(get_db), current_user: User = Depends(check_admin_access)):
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
def get_ledgers(db: Session = Depends(get_db), company_id: int = Depends(get_current_company)):
    """Returns a list of all ledgers for the company."""
    ledgers = db.query(Ledger).filter(Ledger.company_id == company_id).all()
    # For many UI components, we need the group name
    from .models import TallyGroup
    result = []
    for l in ledgers:
        group = db.query(TallyGroup).filter(TallyGroup.id == l.group_id, TallyGroup.company_id == company_id).first()
        result.append({
            "id": l.id,
            "name": l.name,
            "group_id": l.group_id,
            "group_name": group.name if group else "N/A",
            "opening_balance": float(l.opening_balance),
            "is_debit_balance": l.is_debit_balance,
            "address": l.address,
            "city": l.city,
            "state": l.state,
            "pincode": l.pincode,
            "gstin": l.gstin,
            "pan_no": l.pan_no,
            "drug_license_no": l.drug_license_no,
            "fssai_no": l.fssai_no,
            "phone": l.phone,
            "email": l.email,
            "tax_type": l.tax_type,
            "tax_percentage": float(l.tax_percentage) if l.tax_percentage else None,
            "tax_head": l.tax_head,
            "employee_id": l.employee_id,
            "designation": l.designation,
            "bank_name": l.bank_name,
            "account_no": l.account_no,
            "ifsc_code": l.ifsc_code,
            "primary_pan": l.primary_pan,
            "basic_pay": float(l.basic_pay),
            "da_pay": float(l.da_pay),
            "hra_pay": float(l.hra_pay),
            "other_allowances": float(l.other_allowances),
            "total_ctc": float(l.total_ctc),
            "monitoring_enabled": l.monitoring_enabled,
            "attendance_source": l.attendance_source,
            "shift_type": l.shift_type
        })
    return result

@app.post("/api/ledgers")
def create_ledger(ledger: LedgerCreateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), company_id: int = Depends(get_current_company)):
    """Creates a new ledger."""
    if not current_user.can_manage_masters:
        raise HTTPException(status_code=403, detail="Permission denied to manage masters")
    
    db_ledger = db.query(Ledger).filter(Ledger.name == ledger.name, Ledger.company_id == company_id).first()
    if db_ledger:
        raise HTTPException(status_code=400, detail="Ledger already exists in this company")
    
    new_ledger = Ledger(
        name=ledger.name,
        group_id=ledger.group_id,
        company_id=company_id,
        opening_balance=Decimal(str(ledger.opening_balance)),
        is_debit_balance=ledger.is_debit_balance,
        address=ledger.address,
        city=ledger.city,
        state=ledger.state,
        pincode=ledger.pincode,
        gstin=ledger.gstin,
        pan_no=ledger.pan_no,
        drug_license_no=ledger.drug_license_no,
        fssai_no=ledger.fssai_no,
        phone=ledger.phone,
        email=ledger.email,
        tax_type=ledger.tax_type,
        tax_percentage=Decimal(str(ledger.tax_percentage)) if ledger.tax_percentage else None,
        tax_head=ledger.tax_head,
        employee_id=ledger.employee_id,
        designation=ledger.designation,
        bank_name=ledger.bank_name,
        account_no=ledger.account_no,
        ifsc_code=ledger.ifsc_code,
        primary_pan=ledger.primary_pan,
        basic_pay=Decimal(str(ledger.basic_pay)) if ledger.basic_pay else 0,
        da_pay=Decimal(str(ledger.da_pay)) if ledger.da_pay else 0,
        hra_pay=Decimal(str(ledger.hra_pay)) if ledger.hra_pay else 0,
        other_allowances=Decimal(str(ledger.other_allowances)) if ledger.other_allowances else 0,
        total_ctc=Decimal(str(ledger.total_ctc)) if ledger.total_ctc else 0,
        monitoring_enabled=ledger.monitoring_enabled,
        attendance_source=ledger.attendance_source,
        shift_type=ledger.shift_type
    )
    db.add(new_ledger)
    db.commit()
    db.refresh(new_ledger)
    
    return new_ledger

@app.put("/api/ledgers/{ledger_id}")
def update_ledger(ledger_id: int, ledger_data: LedgerCreateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), company_id: int = Depends(get_current_company)):
    """Updates an existing ledger."""
    if not current_user.can_manage_masters:
        raise HTTPException(status_code=403, detail="Permission denied to manage masters")
    
    db_ledger = db.query(Ledger).filter(Ledger.id == ledger_id, Ledger.company_id == company_id).first()
    if not db_ledger:
        raise HTTPException(status_code=404, detail="Ledger not found")
    
    # Check if name is being changed to an existing ledger name
    if ledger_data.name != db_ledger.name:
        existing = db.query(Ledger).filter(Ledger.name == ledger_data.name, Ledger.company_id == company_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Another ledger with this name already exists")
    
    # Update fields
    db_ledger.name = ledger_data.name
    db_ledger.group_id = ledger_data.group_id
    db_ledger.opening_balance = Decimal(str(ledger_data.opening_balance))
    db_ledger.is_debit_balance = ledger_data.is_debit_balance
    db_ledger.address = ledger_data.address
    db_ledger.city = ledger_data.city
    db_ledger.state = ledger_data.state
    db_ledger.pincode = ledger_data.pincode
    db_ledger.gstin = ledger_data.gstin
    db_ledger.pan_no = ledger_data.pan_no
    db_ledger.drug_license_no = ledger_data.drug_license_no
    db_ledger.fssai_no = ledger_data.fssai_no
    db_ledger.phone = ledger_data.phone
    db_ledger.email = ledger_data.email
    db_ledger.tax_type = ledger_data.tax_type
    db_ledger.tax_percentage = Decimal(str(ledger_data.tax_percentage)) if ledger_data.tax_percentage else None
    db_ledger.tax_head = ledger_data.tax_head
    db_ledger.employee_id = ledger_data.employee_id
    db_ledger.designation = ledger_data.designation
    db_ledger.bank_name = ledger_data.bank_name
    db_ledger.account_no = ledger_data.account_no
    db_ledger.ifsc_code = ledger_data.ifsc_code
    db_ledger.primary_pan = ledger_data.primary_pan
    db_ledger.basic_pay = Decimal(str(ledger_data.basic_pay)) if ledger_data.basic_pay else 0
    db_ledger.da_pay = Decimal(str(ledger_data.da_pay)) if ledger_data.da_pay else 0
    db_ledger.hra_pay = Decimal(str(ledger_data.hra_pay)) if ledger_data.hra_pay else 0
    db_ledger.other_allowances = Decimal(str(ledger_data.other_allowances)) if ledger_data.other_allowances else 0
    db_ledger.total_ctc = Decimal(str(ledger_data.total_ctc)) if ledger_data.total_ctc else 0
    db_ledger.monitoring_enabled = ledger_data.monitoring_enabled
    db_ledger.attendance_source = ledger_data.attendance_source
    db_ledger.shift_type = ledger_data.shift_type
    
    db.commit()
    db.refresh(db_ledger)
    return db_ledger

@app.get("/api/ledgers/{ledger_id}/salary-history")
def get_salary_history(ledger_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    history = db.query(SalaryHistory).filter(SalaryHistory.ledger_id == ledger_id).order_by(SalaryHistory.effective_date.desc()).all()
    return history

@app.post("/api/ledgers/{ledger_id}/salary-history")
def add_salary_revision(ledger_id: int, revision: SalaryRevisionSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ledger = db.query(Ledger).filter(Ledger.id == ledger_id).first()
    if not ledger:
        return {"error": "Ledger not found"}, 404
    
    old_salary = float(ledger.total_ctc)
    new_salary = float(revision.new_salary)
    
    change_pct = 0
    if old_salary > 0:
        change_pct = ((new_salary - old_salary) / old_salary) * 100
    
    new_history = SalaryHistory(
        ledger_id=ledger_id,
        effective_date=revision.effective_date,
        old_salary=old_salary,
        new_salary=new_salary,
        change_percentage=change_pct
    )
    
    # Update ledger's total CTC
    ledger.total_ctc = Decimal(str(new_salary))
    
    db.add(new_history)
    db.commit()
    return {"message": "Salary revision added successfully"}

@app.get("/api/groups")
def get_groups(db: Session = Depends(get_db), company_id: int = Depends(get_current_company)):
    """Returns all Tally Groups for the active company."""
    from .models import TallyGroup
    groups = db.query(TallyGroup).filter(TallyGroup.company_id == company_id).all()
    # Include parent_id for local hierarchy mapping in frontend
    return [{"id": g.id, "name": g.name, "parent_id": g.parent_id} for g in groups]

@app.post("/api/groups")
def create_group(group: GroupCreateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), company_id: int = Depends(get_current_company)):
    """Creates a new Tally Group."""
    if not current_user.can_manage_masters:
        raise HTTPException(status_code=403, detail="Permission denied to manage masters")
    
    db_group = db.query(TallyGroup).filter(TallyGroup.name == group.name, TallyGroup.company_id == company_id).first()
    if db_group:
         raise HTTPException(status_code=400, detail="Group already exists")

    new_group = TallyGroup(
        name=group.name,
        parent_id=group.parent_id,
        company_id=company_id
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return new_group

@app.post("/api/sync/import-ledgers")
def import_ledgers(db: Session = Depends(get_db), current_user: User = Depends(check_admin_access), company_id: int = Depends(get_current_company)):
    """Triggers sync of ledgers from Tally."""
    from tally_sync import sync_ledgers_to_db
    result = sync_ledgers_to_db(db, company_id=company_id)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.post("/api/sync/import-vouchers")
def import_vouchers(db: Session = Depends(get_db), current_user: User = Depends(check_admin_access), company_id: int = Depends(get_current_company)):
    """Triggers sync of vouchers from Tally."""
    from tally_sync import sync_vouchers_to_db
    result = sync_vouchers_to_db(db, company_id=company_id)
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
async def upload_tally_xml(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(check_admin_access), company_id: int = Depends(get_current_company)):
    """Accepts a Tally XML file and syncs data to PostgreSQL."""
    print(f"DEBUG: upload_tally_xml reached. Filename: {file.filename}, User ID: {current_user.id}, Company ID: {company_id}")
    
    content = await file.read()
    print(f"DEBUG: File content read. Size: {len(content)} bytes")
    
    # Robustly decode XML content (Tally often uses UTF-16)
    try:
        xml_text = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            xml_text = content.decode("utf-16")
        except UnicodeDecodeError:
            try:
                xml_text = content.decode("utf-8-sig")
            except UnicodeDecodeError:
                xml_text = content.decode("iso-8859-1")
    
    import re
    # Broadly remove invalid numerical entities that Tally often includes
    # This catches &#1;, &#x01;, &#01;, &#31;, etc. but preserves allowed ones like &#10; (newline) if they are standard.
    # However, for Tally, it's safer to remove all low control characters.
    xml_text = re.sub(r'&#x?([0-9a-fA-F]+);', lambda m: '' if int(m.group(1), 16 if 'x' in m.group(0).lower() else 10) < 32 and int(m.group(1), 16 if 'x' in m.group(0).lower() else 10) not in [9, 10, 13] else m.group(0), xml_text)
    
    # Also remove any raw control characters that might have slipped through decoding
    xml_text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', xml_text)
    
    from .tally_sync import sync_ledgers_to_db, sync_vouchers_to_db
    # Try syncing both as the file might contain both or just one
    l_res = sync_ledgers_to_db(db, company_id=company_id, xml_content=xml_text)
    v_res = sync_vouchers_to_db(db, company_id=company_id, xml_content=xml_text)
    
    return {
        "ledgers": l_res.get("message", l_res.get("error")),
        "transactions": v_res.get("message", v_res.get("error"))
    }

@app.get("/api/sync/export-app-data")
def export_app_data(db: Session = Depends(get_db), current_user: User = Depends(check_admin_access), company_id: int = Depends(get_current_company)):
    """Exports all master and transaction data to a JSON backup."""
    
    from .models import TallyGroup, Ledger, Voucher, VoucherEntry, StockItem, UnitOfMeasure, Company
    
    company = db.query(Company).filter(Company.id == company_id).first()
    
    data = {
        "company": vars(company) if company else None,
        "groups": [vars(g) for g in db.query(TallyGroup).filter(TallyGroup.company_id == company_id).all()],
        "ledgers": [vars(l) for l in db.query(Ledger).filter(Ledger.company_id == company_id).all()],
        "vouchers": [vars(v) for v in db.query(Voucher).filter(Voucher.company_id == company_id).all()],
        "voucher_entries": [vars(ve) for ve in db.query(VoucherEntry).join(Voucher).filter(Voucher.company_id == company_id).all()],
        "stock_items": [vars(si) for si in db.query(StockItem).filter(StockItem.company_id == company_id).all()],
        "uoms": [vars(u) for u in db.query(UnitOfMeasure).filter(UnitOfMeasure.company_id == company_id).all()]
    }
    
    # Remove SQLAlchemy state
    for k, v in data.items():
        if isinstance(v, list):
            for item in v:
                if isinstance(item, dict):
                    item.pop('_sa_instance_state', None)
        elif isinstance(v, dict):
            v.pop('_sa_instance_state', None)
            
    filename = f"aivion_backup_{date.today().strftime('%Y%m%d')}.json"
    filepath = os.path.join("C:/tmp", filename) # Correct path for Windows tmp
    if not os.path.exists("C:/tmp"):
        os.makedirs("C:/tmp")
    
    with open(filepath, "w") as f:
        json.dump(data, f, cls=AppJSONEncoder, indent=4)
        
    return FileResponse(filepath, media_type='application/json', filename=filename)

@app.get("/api/sync/export-tally-xml")
def export_tally_xml(db: Session = Depends(get_db), current_user: User = Depends(check_admin_access), company_id: int = Depends(get_current_company)):
    """Generates and returns a bulk Tally XML export file."""
    
    from tally_export import generate_bulk_tally_xml
    xml_content = generate_bulk_tally_xml(db, company_id=company_id)
    
    from fastapi import Response
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={
            "Content-Disposition": f"attachment; filename=aivion_to_tally_export_{date.today().strftime('%Y%m%d')}.xml"
        }
    )

@app.post("/api/sync/tally/push-pending")
def push_pending_vouchers(background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(check_admin_access), company_id: int = Depends(get_current_company)):
    """Triggers a background sync for all unsynced vouchers of the company."""
    from .models import Voucher
    from .tally_push import sync_voucher_to_tally
    
    vouchers = db.query(Voucher).filter(Voucher.company_id == company_id, Voucher.is_synced == False).all()
    
    for vch in vouchers:
        background_tasks.add_task(sync_voucher_to_tally, vch.id, db)
        
    return {"message": f"Queued {len(vouchers)} vouchers for Tally synchronization."}

@app.post("/api/sync/upload-app-json")
async def upload_app_json(overwrite: bool = False, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(check_admin_access)):
    """Restores data from an AIVION native JSON backup with optional overwrite."""
    
    content = await file.read()
    try:
        data = json.loads(content)
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    from .models import TallyGroup, Ledger, Voucher, VoucherEntry, StockItem, UnitOfMeasure, Company
    
    try:
        # 1. Company Logic
        target_company_id = current_user.company_id
        if data.get('company'):
            c_data = data['company']
            c_data.pop('_sa_instance_state', None)
            existing_company = db.query(Company).filter(Company.name == c_data['name']).first()
            if not existing_company:
                new_company = Company(**c_data)
                new_company.id = None # Let DB assign ID
                db.add(new_company)
                db.flush()
                target_company_id = new_company.id
            else:
                target_company_id = existing_company.id

        # 2. Import Groups
        for g_data in data.get('groups', []):
            g_data.pop('_sa_instance_state', None)
            existing = db.query(TallyGroup).filter(TallyGroup.name == g_data['name'], TallyGroup.company_id == target_company_id).first()
            if existing:
                if overwrite:
                    for k, v in g_data.items():
                        if k != 'id': setattr(existing, k, v)
            else:
                g_data.pop('id', None)
                g_data['company_id'] = target_company_id
                db.add(TallyGroup(**g_data))
        db.flush()

        # 3. Import Ledgers
        for l_data in data.get('ledgers', []):
            l_data.pop('_sa_instance_state', None)
            existing = db.query(Ledger).filter(Ledger.name == l_data['name'], Ledger.company_id == target_company_id).first()
            if existing:
                if overwrite:
                    for k, v in l_data.items():
                        if k != 'id': setattr(existing, k, v)
            else:
                l_data.pop('id', None)
                l_data['company_id'] = target_company_id
                db.add(Ledger(**l_data))
        db.flush()
        
        # 4. Import Stock Items
        for si_data in data.get('stock_items', []):
            si_data.pop('_sa_instance_state', None)
            existing = db.query(StockItem).filter(StockItem.name == si_data['name'], StockItem.company_id == target_company_id).first()
            if existing:
                if overwrite:
                    for k, v in si_data.items():
                        if k != 'id': setattr(existing, k, v)
            else:
                si_data.pop('id', None)
                si_data['company_id'] = target_company_id
                db.add(StockItem(**si_data))
        db.flush()

        # 5. Import Vouchers & Entries
        for v_data in data.get('vouchers', []):
            v_data.pop('_sa_instance_state', None)
            # Use tally_guid or date+voucher_number as key
            existing = None
            if v_data.get('tally_guid'):
                existing = db.query(Voucher).filter(Voucher.tally_guid == v_data['tally_guid'], Voucher.company_id == target_company_id).first()
            
            if not existing:
                v_data.pop('id', None)
                v_data['company_id'] = target_company_id
                new_vch = Voucher(**v_data)
                db.add(new_vch)
        db.flush()
        
        db.commit()
        return {"message": "Data restored successfully.", "company_id": target_company_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/trial-balance")
def get_trial_balance(db: Session = Depends(get_db), current_user: User = Depends(check_report_access), company_id: int = Depends(get_current_company)):
    """Calls the accounting engine to calculate the real-time hierarchical trial balance."""
    engine = AccountingEngine(db, company_id)
    try:
        tb_data = engine.generate_hierarchical_trial_balance()
        return tb_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/pnl")
def get_pnl(db: Session = Depends(get_db), current_user: User = Depends(check_report_access), company_id: int = Depends(get_current_company)):
    """Generates the Profit and Loss statement."""
    engine = AccountingEngine(db, company_id)
    try:
        pnl_data = engine.generate_pnl()
        return pnl_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/balance-sheet")
def get_balance_sheet(db: Session = Depends(get_db), current_user: User = Depends(check_report_access), company_id: int = Depends(get_current_company)):
    """Generates the Balance Sheet integrating Net Profit."""
    engine = AccountingEngine(db, company_id)
    try:
        bs_data = engine.generate_balance_sheet()
        return bs_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Phase 17: Advanced Pharma Reports ---

@app.get("/api/reports/expiry")
def get_expiry_report(days: int = 90, db: Session = Depends(get_db), current_user: User = Depends(check_report_access), company_id: int = Depends(get_current_company)):
    """Returns batches expiring within the specified number of days."""
    from datetime import date, timedelta
    from .models import StockItem, StockBatch
    
    threshold_date = date.today() + timedelta(days=days)
    
    # Join StockBatch with StockItem to filter by company_id
    batches = db.query(StockBatch, StockItem).join(StockItem).filter(
        StockItem.company_id == company_id,
        StockBatch.expiry_date <= threshold_date,
        StockBatch.expiry_date >= date.today()
    ).all()
    
    return [
        {
            "item_name": item.name,
            "batch_no": batch.batch_no,
            "expiry_date": batch.expiry_date,
            "current_stock": 0 # Placeholder for stock calculation if needed
        } for batch, item in batches
    ]

@app.get("/api/reports/schedule-h")
def get_schedule_h_report(db: Session = Depends(get_db), current_user: User = Depends(check_report_access), company_id: int = Depends(get_current_company)):
    """Returns transactions for Schedule H1 / Narcotic drugs."""
    from .models import StockItem, InventoryEntry, Voucher
    
    # Filter items that are either Narcotic or H1
    items = db.query(StockItem).filter(
        StockItem.company_id == company_id,
        (StockItem.is_narcotic == True) | (StockItem.is_h1 == True)
    ).all()
    
    item_ids = [i.id for i in items]
    
    entries = db.query(InventoryEntry, StockItem, Voucher).join(StockItem).join(Voucher).filter(
        StockItem.id.in_(item_ids),
        Voucher.company_id == company_id
    ).order_by(Voucher.date.desc()).all()
    
    return [
        {
            "date": v.date,
            "item_name": item.name,
            "qty": float(e.quantity),
            "type": "Sale" if not e.is_inward else "Purchase",
            "is_narcotic": item.is_narcotic,
            "is_h1": item.is_h1
        } for e, item, v in entries
    ]

@app.get("/api/reports/reorder")
def get_reorder_report(db: Session = Depends(get_db), current_user: User = Depends(check_report_access), company_id: int = Depends(get_current_company)):
    """Returns items where current stock is below min_stock_level."""
    from .models import StockItem, StockBatch, InventoryEntry, Voucher
    
    # 1. Fetch all items for the company
    items = db.query(StockItem).filter(StockItem.company_id == company_id).all()
    
    reorder_list = []
    for item in items:
        # 2. Calculate current stock (Opening + Inward - Outward) across all batches
        # Simple aggregate calculation
        inward = db.query(InventoryEntry).join(Voucher).filter(
            InventoryEntry.stock_item_id == item.id,
            InventoryEntry.is_inward == True,
            Voucher.company_id == company_id
        ).sum(InventoryEntry.quantity) or 0
        
        outward = db.query(InventoryEntry).join(Voucher).filter(
            InventoryEntry.stock_item_id == item.id,
            InventoryEntry.is_inward == False,
            Voucher.company_id == company_id
        ).sum(InventoryEntry.quantity) or 0
        
        # We also need opening stock from all batches
        total_opening = db.query(StockBatch).filter(StockBatch.stock_item_id == item.id).sum(StockBatch.opening_stock) or 0
        
        current_stock = float(total_opening) + float(inward) - float(outward)
        
        if current_stock < item.min_stock_level:
            reorder_list.append({
                "item_name": item.name,
                "current_stock": current_stock,
                "min_level": item.min_stock_level,
                "suggested_order": item.min_stock_level - current_stock
            })
            
    return reorder_list

@app.post("/api/vouchers")
def create_voucher(voucher: VoucherSchema, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), company_id: int = Depends(get_current_company)):
    """
    Creates a new voucher and validates double-entry logic before commit.
    """
    
    from decimal import Decimal
    
    # Calculate Total Dr and Cr
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
    batch_id: Optional[int] = None
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
    round_off: float = 0.0
    net_amount: float

@app.get("/api/stock-items")
def get_stock_items(db: Session = Depends(get_db), company_id: int = Depends(get_current_company)):
    """Returns a list of all stock items for the company."""
    items = db.query(StockItem).filter(StockItem.company_id == company_id).all()
    return [{
        "id": i.id, 
        "name": i.name, 
        "group_id": i.group_id, 
        "uom_id": i.uom_id, 
        "gst_rate": float(i.gst_rate),
        "salt": i.salt_composition,
        "rack": i.rack_number,
        "main_unit_name": i.main_unit_name,
        "sub_unit_name": i.sub_unit_name,
        "conversion_factor": i.conversion_factor
    } for i in items]

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
        uom_id=item.uom_id,
        salt_composition=item.salt_composition,
        rack_number=item.rack_number,
        main_unit_name=item.main_unit_name,
        sub_unit_name=item.sub_unit_name,
        conversion_factor=item.conversion_factor,
        min_stock_level=item.min_stock_level,
        is_narcotic=item.is_narcotic,
        is_h1=item.is_h1
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@app.patch("/api/inventory/items/{item_id}")
def update_stock_item(item_id: int, item: StockItemCreateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), company_id: int = Depends(get_current_company)):
    """Updates an existing stock item. Partial updates are supported by reusing the schema with optional fields."""
    if not current_user.can_manage_inventory:
         raise HTTPException(status_code=403, detail="Permission denied")
         
    db_item = db.query(StockItem).filter(StockItem.id == item_id, StockItem.company_id == company_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Stock Item not found")
        
    for key, value in item.dict(exclude_unset=True).items():
        if key == 'gst_rate' and value is not None:
            setattr(db_item, key, Decimal(str(value)))
        else:
            setattr(db_item, key, value)
            
    db.commit()
    db.refresh(db_item)
    return db_item

@app.get("/api/uoms")
def get_uoms(db: Session = Depends(get_db), company_id: int = Depends(get_current_company)):
    """Returns all Units of Measure for the active company."""
    from .models import UnitOfMeasure
    uoms = db.query(UnitOfMeasure).filter(UnitOfMeasure.company_id == company_id).all()
    return [{"id": u.id, "symbol": u.symbol, "formal_name": u.formal_name} for u in uoms]

@app.post("/api/uoms")
def create_uom(uom: UOMCreateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), company_id: int = Depends(get_current_company)):
    """Creates a new Unit of Measure."""
    from .models import UnitOfMeasure
    if not current_user.can_manage_masters:
        raise HTTPException(status_code=403, detail="Permission denied to manage masters")
    
    db_uom = db.query(UnitOfMeasure).filter(UnitOfMeasure.symbol == uom.symbol, UnitOfMeasure.company_id == company_id).first()
    if db_uom:
        raise HTTPException(status_code=400, detail="UOM already exists")
    
    new_uom = UnitOfMeasure(
        symbol=uom.symbol,
        formal_name=uom.formal_name,
        company_id=company_id
    )
    db.add(new_uom)
    db.commit()
    db.refresh(new_uom)
    return new_uom

@app.post("/api/sales-invoice")
def create_sales_invoice(invoice: SalesInvoiceSchema, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), company_id: int = Depends(get_current_company)):
    """
    Creates a Sales Invoice partitioned by company.
    """
    from decimal import Decimal
    
    if not current_user.can_manage_vouchers:
        raise HTTPException(status_code=403, detail="Permission denied to manage vouchers")
        
    try:
        # 1. Create main header record in Vouchers (Type 2 = Sales)
        new_voucher = Voucher(
            company_id=company_id,
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
        company = db.query(Company).filter(Company.id == current_user.company_id).first()
        is_pharma_company = company.company_type == 'PHARMA'

        for item in invoice.items:
            qty = Decimal(str(item.quantity))
            rate = Decimal(str(item.rate))
            amount = Decimal(str(item.amount))
            gross_total += amount
            
            # Task 1: Negative Stock Guardrail (Pharma Only)
            if is_pharma_company:
                if not item.batch_id:
                    raise HTTPException(status_code=400, detail=f"Batch selection is mandatory for item ID {item.stock_item_id} in Pharma mode.")
                
                # Calculate available stock for this specific batch
                from .models import StockBatch
                batch = db.query(StockBatch).join(StockItem).filter(
                    StockBatch.id == item.batch_id, 
                    StockItem.company_id == company_id
                ).first()
                if not batch:
                    raise HTTPException(status_code=400, detail="Invalid batch for this company")
                    
                inward = db.query(InventoryEntry).filter(InventoryEntry.batch_id == item.batch_id, InventoryEntry.is_inward == True).join(Voucher).filter(Voucher.company_id == company_id).sum(InventoryEntry.quantity) or 0
                outward = db.query(InventoryEntry).filter(InventoryEntry.batch_id == item.batch_id, InventoryEntry.is_inward == False).join(Voucher).filter(Voucher.company_id == company_id).sum(InventoryEntry.quantity) or 0
                available = float(batch.opening_stock) + float(inward) - float(outward)
                
                if float(qty) > available:
                    raise HTTPException(status_code=400, detail=f"Insufficient stock in Batch {batch.batch_no}. Available: {available}, Required: {qty}")

            # Inventory Outward (Sales)
            inv_entry = InventoryEntry(
                voucher_id=new_voucher.id,
                stock_item_id=item.stock_item_id,
                batch_id=item.batch_id if is_pharma_company else None,
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
        
        round_off = Decimal(str(invoice.round_off))
        net_total = gross_total + total_cgst + total_sgst + total_igst + round_off

        # Create Ledger entries dynamically if tax ledgers don't exist for the sake of the demo
        def get_or_create_ledger(name, group_name="Duties & Taxes", is_debit=False):
            ledger = db.query(Ledger).filter(Ledger.name == name, Ledger.company_id == current_user.company_id).first()
            if not ledger:
                from .models import TallyGroup
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
        round_off_id = get_or_create_ledger("Round Off", group_name="Indirect Expenses")

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
        
        # Round Off Entry
        if round_off != 0:
            is_dr = round_off > 0
            db.add(VoucherEntry(voucher_id=new_voucher.id, ledger_id=round_off_id, amount=abs(round_off), is_debit=is_dr))
                
        db.commit()
        
        # Trigger Tally Sync in Background
        background_tasks.add_task(sync_voucher_to_tally, new_voucher.id, db)
        
        return {"message": "Sales Invoice processed successfully and inventory reduced.", "voucher_id": new_voucher.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to process sales invoice: {str(e)}")

@app.put("/api/sales-invoice/{id}")
def update_sales_invoice(id: int, invoice: SalesInvoiceSchema, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), company_id: int = Depends(get_current_company)):
    """
    Updates an existing Sales Invoice using Delete & Re-insert strategy.
    """
    if not current_user.can_manage_vouchers:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    db_voucher = db.query(Voucher).filter(Voucher.id == id, Voucher.company_id == company_id).first()
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
        company = db.query(Company).filter(Company.id == current_user.company_id).first()
        is_pharma_company = company.company_type == 'PHARMA'

        for item in invoice.items:
            qty = Decimal(str(item.quantity))
            rate = Decimal(str(item.rate))
            amount = Decimal(str(item.amount))
            gross_total += amount
            
            # Task 1: Negative Stock Guardrail (Pharma Only)
            if is_pharma_company:
                if not item.batch_id:
                    raise HTTPException(status_code=400, detail=f"Batch selection is mandatory for item ID {item.stock_item_id} in Pharma mode.")
                
                # Note: In an 'update' scenario, the old quantities were just deleted in Step 1,
                # so the current 'available' stock calculation reflects the actual availability for re-insertion.
                from .models import StockBatch
                batch = db.query(StockBatch).filter(StockBatch.id == item.batch_id).first()
                inward = db.query(InventoryEntry).filter(InventoryEntry.batch_id == item.batch_id, InventoryEntry.is_inward == True).sum(InventoryEntry.quantity) or 0
                outward = db.query(InventoryEntry).filter(InventoryEntry.batch_id == item.batch_id, InventoryEntry.is_inward == False).sum(InventoryEntry.quantity) or 0
                available = float(batch.opening_stock) + float(inward) - float(outward)
                
                if float(qty) > available:
                    raise HTTPException(status_code=400, detail=f"Insufficient stock in Batch {batch.batch_no} during update. Available: {available}, Required: {qty}")

            # Inventory Outward
            inv_entry = InventoryEntry(
                voucher_id=id,
                stock_item_id=item.stock_item_id,
                batch_id=item.batch_id if is_pharma_company else None,
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
        
        round_off = Decimal(str(invoice.round_off))
        net_total = gross_total + total_cgst + total_sgst + total_igst + round_off

        # Reuse tax ledger helper (ensure they exist)
        def get_or_create_ledger(name, group_name="Duties & Taxes", is_debit=False):
            ledger = db.query(Ledger).filter(Ledger.name == name, Ledger.company_id == current_user.company_id).first()
            if not ledger:
                from .models import TallyGroup
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
        round_off_id = get_or_create_ledger("Round Off", group_name="Indirect Expenses")

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
        
        # Round Off Entry
        if round_off != 0:
            is_dr = round_off > 0
            db.add(VoucherEntry(voucher_id=id, ledger_id=round_off_id, amount=abs(round_off), is_debit=is_dr))
                
        db.commit()
        
        # Trigger Tally Sync in Background
        background_tasks.add_task(sync_voucher_to_tally, id, db)
        
        return {"message": "Sales Invoice updated successfully.", "voucher_id": id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update sales invoice: {str(e)}")

@app.get("/api/vouchers/{id}")
def get_voucher(id: int, db: Session = Depends(get_db), company_id: int = Depends(get_current_company)):
    """Returns details for a specific voucher including inventory and entries."""
    from .models import VoucherType, InventoryEntry, StockItem

    voucher = db.query(Voucher).filter(Voucher.id == id, Voucher.company_id == company_id).first()
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
def get_ledger_vouchers(ledger_id: int, start_date: str = None, end_date: str = None, db: Session = Depends(get_db), company_id: int = Depends(get_current_company)):
    """Returns chronological list of Voucher_Entries for a specific ledger."""
    from .models import VoucherType, Ledger

    ledger = db.query(Ledger).filter(Ledger.id == ledger_id, Ledger.company_id == company_id).first()
    if not ledger:
        raise HTTPException(status_code=404, detail="Ledger not found in this company")

    # Base query for opening balance (entries before start_date)
    opening_balance = float(ledger.opening_balance)
    if not ledger.is_debit_balance:
        opening_balance = -opening_balance

    if start_date:
        past_entries = db.query(VoucherEntry).join(Voucher).filter(
            VoucherEntry.ledger_id == ledger_id,
            Voucher.date < start_date,
            Voucher.company_id == company_id
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
    ).filter(
        VoucherEntry.ledger_id == ledger_id,
        Voucher.company_id == company_id
    ).order_by(Voucher.date.asc())

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
            opposite_ledger = db.query(Ledger).filter(Ledger.id == opposite_entries[0].ledger_id, Ledger.company_id == company_id).first()
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
        "ledger_id": ledger_id,
        "ledger_name": ledger.name,
        "address": ledger.address,
        "city": ledger.city,
        "state": ledger.state,
        "pincode": ledger.pincode,
        "gstin": ledger.gstin,
        "drug_license_no": ledger.drug_license_no,
        "fssai_no": ledger.fssai_no,
        "phone": ledger.phone,
        "email": ledger.email,
        "opening_balance": abs(opening_balance),
        "is_opening_debit": opening_balance >= 0,
        "closing_balance": abs(current_balance),
        "is_closing_debit": current_balance >= 0,
        "entries": result_entries
    }

@app.get("/api/daybook")
def get_daybook(date: str = None, start_date: str = None, end_date: str = None, db: Session = Depends(get_db), company_id: int = Depends(get_current_company)):
    """Returns all vouchers for a specific date or date range."""
    from .models import VoucherType, Ledger

    query = db.query(Voucher, VoucherType).join(VoucherType).filter(Voucher.company_id == company_id)
    
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
            first_entry_ledger = db.query(Ledger).filter(Ledger.id == entries[0].ledger_id, Ledger.company_id == company_id).first()
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

# --- Phase 15: Pharma Specific Endpoints ---

@app.get("/api/stock-items/search-by-salt")
def search_by_salt(salt: str, db: Session = Depends(get_db), company_id: int = Depends(get_current_company)):
    """Search for stock items containing a specific salt composition."""
    items = db.query(StockItem).filter(
        StockItem.salt_composition.ilike(f"%{salt}%"),
        StockItem.company_id == company_id
    ).all()
    return [{
        "id": i.id, 
        "name": i.name, 
        "salt": i.salt_composition, 
        "rack": i.rack_number,
        "main_unit_name": i.main_unit_name,
        "sub_unit_name": i.sub_unit_name,
        "conversion_factor": i.conversion_factor
    } for i in items]

@app.get("/api/stock-items/{item_id}/batches")
def get_item_batches(item_id: int, db: Session = Depends(get_db), company_id: int = Depends(get_current_company)):
    """Returns batches for a specific stock item, sorted by expiry date (FEFO)."""
    from .models import StockBatch
    
    # Ensure item belongs to company
    item = db.query(StockItem).filter(StockItem.id == item_id, StockItem.company_id == company_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    batches = db.query(StockBatch).filter(StockBatch.stock_item_id == item_id).order_by(StockBatch.expiry_date.asc()).all()
    
    result = []
    for b in batches:
        # Calculate current stock for the batch
        inward = db.query(InventoryEntry).filter(InventoryEntry.batch_id == b.id, InventoryEntry.is_inward == True).sum(InventoryEntry.quantity) or 0
        outward = db.query(InventoryEntry).filter(InventoryEntry.batch_id == b.id, InventoryEntry.is_inward == False).sum(InventoryEntry.quantity) or 0
        current_qty = float(b.opening_stock) + float(inward) - float(outward)
        
        result.append({
            "id": b.id,
            "batch_no": b.batch_no,
            "expiry_date": b.expiry_date,
            "current_stock": current_qty
        })
    return result

@app.post("/api/stock-items/{item_id}/batches")
def create_batch(item_id: int, batch: StockBatchSchema, db: Session = Depends(get_db), company_id: int = Depends(get_current_company)):
    """Creates a new batch for a stock item."""
    from .models import StockBatch
    
    item = db.query(StockItem).filter(StockItem.id == item_id, StockItem.company_id == company_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    new_batch = StockBatch(
        stock_item_id=item_id,
        batch_no=batch.batch_no,
        expiry_date=batch.expiry_date,
        opening_stock=Decimal(str(batch.opening_stock))
    )
    db.add(new_batch)
    db.commit()
    db.refresh(new_batch)
    return new_batch

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
