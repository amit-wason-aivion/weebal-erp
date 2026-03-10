from sqlalchemy.orm import Session
from .models import TallyGroup, Ledger, VoucherType, UnitOfMeasure, Godown

def seed_default_accounts(db: Session, company_id: int):
    """
    Seeds standard 28 Tally Groups, 6 Voucher Types, and 2 default Ledgers.
    Everything is expected to be within a transaction from the caller.
    """
    
    # 1. Seed Voucher Types
    voucher_types = [
        {"name": "Contra", "parent_type": "Contra"},
        {"name": "Payment", "parent_type": "Payment"},
        {"name": "Receipt", "parent_type": "Receipt"},
        {"name": "Journal", "parent_type": "Journal"},
        {"name": "Sales", "parent_type": "Sales"},
        {"name": "Purchase", "parent_type": "Purchase"},
    ]
    for vt in voucher_types:
        db.add(VoucherType(company_id=company_id, **vt))
    db.flush()

    # 2. Seed Groups
    # Primary Groups
    primary_groups = [
        "Capital Account", "Loans (Liability)", "Current Liabilities", "Fixed Assets",
        "Investments", "Current Assets", "Branch / Divisions", "Misc. Expenses (ASSET)",
        "Suspense A/c", "Sales Accounts", "Purchase Accounts", "Direct Incomes",
        "Indirect Incomes", "Direct Expenses", "Indirect Expenses"
    ]
    
    group_map = {} # name -> id
    for name in primary_groups:
        grp = TallyGroup(name=name, company_id=company_id, parent_id=None)
        db.add(grp)
        db.flush()
        group_map[name] = grp.id
        
    # Sub Groups
    sub_groups = [
        ("Reserves & Surplus", "Capital Account"),
        ("Bank OD A/c", "Loans (Liability)"),
        ("Secured Loans", "Loans (Liability)"),
        ("Unsecured Loans", "Loans (Liability)"),
        ("Duties & Taxes", "Current Liabilities"),
        ("Provisions", "Current Liabilities"),
        ("Sundry Creditors", "Current Liabilities"),
        ("Stock-in-Hand", "Current Assets"),
        ("Deposits (Asset)", "Current Assets"),
        ("Loans & Advances (Asset)", "Current Assets"),
        ("Sundry Debtors", "Current Assets"),
        ("Cash-in-Hand", "Current Assets"),
        ("Bank Accounts", "Current Assets"),
    ]
    
    for name, parent_name in sub_groups:
        grp = TallyGroup(name=name, company_id=company_id, parent_id=group_map[parent_name])
        db.add(grp)
        db.flush()
        group_map[name] = grp.id

    # 3. Seed Default Ledgers
    # Cash Ledger
    cash_ledger = Ledger(
        name="Cash",
        group_id=group_map["Cash-in-Hand"],
        company_id=company_id,
        opening_balance=0.0,
        is_debit_balance=True
    )
    db.add(cash_ledger)
    
    # Profit & Loss A/c
    # In Tally, P&L is a special ledger. We map it to Primary or a hidden system group.
    # For simplicity, we'll put it under a Primary-level entry if possible or Indirect Expenses.
    # Tally usually lists it separately.
    pl_ledger = Ledger(
        name="Profit & Loss A/c",
        group_id=group_map["Indirect Expenses"], # Common fallback
        company_id=company_id,
        opening_balance=0.0,
        is_debit_balance=False
    )
    db.add(pl_ledger)
    
    db.flush()
    
    # 4. Seed Default Inventory (Godown & UOM)
    # The user requested this to run right after accounts are seeded.
    seed_default_inventory(db, company_id)

def seed_default_inventory(db: Session, company_id: int):
    """
    Seeds standard Unit of Measure (NOS) and default Godown (Main Location).
    """
    # 1. Seed Default UOM (NOS)
    uom_nos = db.query(UnitOfMeasure).filter(UnitOfMeasure.symbol == "NOS", UnitOfMeasure.company_id == company_id).first()
    if not uom_nos:
        uom_nos = UnitOfMeasure(
            company_id=company_id,
            symbol="NOS",
            formal_name="Numbers"
        )
        db.add(uom_nos)
    
    # 2. Seed Default Godown (Main Location)
    godown_main = db.query(Godown).filter(Godown.name == "Main Location", Godown.company_id == company_id).first()
    if not godown_main:
        godown_main = Godown(
            company_id=company_id,
            name="Main Location"
        )
        db.add(godown_main)
    
    db.flush()
