from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Date, Boolean
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class TallyGroup(Base):
    """
    Hierarchical tree structure for Groups (e.g., Primary -> Current Assets -> Sundry Debtors).
    """
    __tablename__ = 'tally_groups'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey('tally_groups.id'), nullable=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    
    # Tally Sync Columns
    tally_guid = Column(String, unique=True, index=True)
    alterid = Column(Integer, index=True)
    
    # Relationships
    parent = relationship("TallyGroup", remote_side=[id], backref="children")
    ledgers = relationship("Ledger", back_populates="group")

class Ledger(Base):
    """
    Ledgers tied to Groups, representing individual accounts.
    """
    __tablename__ = 'ledgers'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    group_id = Column(Integer, ForeignKey('tally_groups.id'), nullable=False)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    
    # Financial Details
    opening_balance = Column(Numeric(15, 4), default=0.00)
    is_debit_balance = Column(Boolean, default=True) # True = Dr, False = Cr
    bill_by_bill_enabled = Column(Boolean, default=False)
    
    # Tally Sync Columns
    tally_guid = Column(String, unique=True, index=True)
    alterid = Column(Integer, index=True)
    
    # Relationships
    group = relationship("TallyGroup", back_populates="ledgers")
    entries = relationship("VoucherEntry", back_populates="ledger")

class VoucherType(Base):
    """
    Types of Vouchers (Sales, Purchase, Contra, Payment, Receipt, Journal).
    """
    __tablename__ = 'voucher_types'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    parent_type = Column(String, nullable=True) # e.g., 'Sales', 'Receipt' internal tally type
    
    is_accounting_voucher = Column(Boolean, default=True)
    is_inventory_voucher = Column(Boolean, default=False)
    
    # Tally Sync Columns
    tally_guid = Column(String, unique=True, index=True)
    alterid = Column(Integer, index=True)

class Voucher(Base):
    """
    Voucher Header data.
    """
    __tablename__ = 'vouchers'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    voucher_type_id = Column(Integer, ForeignKey('voucher_types.id'), nullable=False)
    voucher_number = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    narration = Column(String, nullable=True)
    
    # Tally Sync Columns
    tally_guid = Column(String, unique=True, index=True)
    alterid = Column(Integer, index=True)
    is_synced = Column(Boolean, default=False)
    
    # Relationships
    type = relationship("VoucherType")
    entries = relationship("VoucherEntry", back_populates="voucher", cascade="all, delete-orphan")

class VoucherEntry(Base):
    """
    Line items within a Voucher (The debits and credits).
    """
    __tablename__ = 'voucher_entries'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    voucher_id = Column(Integer, ForeignKey('vouchers.id'), nullable=False)
    ledger_id = Column(Integer, ForeignKey('ledgers.id'), nullable=False)
    
    # Financial Details
    amount = Column(Numeric(15, 4), nullable=False)
    is_debit = Column(Boolean, nullable=False) # True = Dr, False = Cr
    
    # Relationships
    voucher = relationship("Voucher", back_populates="entries")
    ledger = relationship("Ledger", back_populates="entries")

# --- Phase 8: Inventory Masters ---

class UnitOfMeasure(Base):
    __tablename__ = 'units_of_measure'
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    symbol = Column(String, nullable=False)
    formal_name = Column(String, nullable=True)

class StockGroup(Base):
    __tablename__ = 'stock_groups'
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey('stock_groups.id'), nullable=True)

class Godown(Base):
    __tablename__ = 'godowns'
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    name = Column(String, nullable=False)

class StockItem(Base):
    __tablename__ = 'stock_items'
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    name = Column(String, nullable=False)
    group_id = Column(Integer, ForeignKey('stock_groups.id'), nullable=True)
    uom_id = Column(Integer, ForeignKey('units_of_measure.id'), nullable=False)
    hsn_sac = Column(String, nullable=True)
    gst_rate = Column(Numeric(5, 2), default=0.00) # GST Percentage
    
class InventoryEntry(Base):
    """
    Line items mapping to a voucher for inventory items.
    """
    __tablename__ = 'inventory_entries'
    id = Column(Integer, primary_key=True, autoincrement=True)
    voucher_id = Column(Integer, ForeignKey('vouchers.id'), nullable=False)
    stock_item_id = Column(Integer, ForeignKey('stock_items.id'), nullable=False)
    godown_id = Column(Integer, ForeignKey('godowns.id'), nullable=True)
    
    quantity = Column(Numeric(15, 4), nullable=False)
    rate = Column(Numeric(15, 4), nullable=False)
    amount = Column(Numeric(15, 4), nullable=False)
    is_inward = Column(Boolean, nullable=False) # True = Purchase/Inward, False = Sales/Outward

class User(Base):
    """
    User model for authentication and Multi-Tenant RBAC.
    """
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user") # 'superadmin', 'admin', 'user'
    
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=True) # Null for superadmin
    
    # Granular Permissions
    can_view_reports = Column(Boolean, default=True)
    can_manage_vouchers = Column(Boolean, default=True)
    can_manage_inventory = Column(Boolean, default=True)
    can_manage_masters = Column(Boolean, default=True)

class Company(Base):
    """
    Company model for multi-entity management.
    """
    __tablename__ = 'companies'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    address = Column(String, nullable=True)
    state = Column(String, nullable=True)
    pin_code = Column(String, nullable=True)
    telephone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    
    financial_year_from = Column(Date, nullable=False)
    books_beginning_from = Column(Date, nullable=False)

