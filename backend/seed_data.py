import os
import sys
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from decimal import Decimal

# Ensure relative imports resolve if run independently
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from .models import Base, TallyGroup, Ledger, VoucherType, Voucher, VoucherEntry, UnitOfMeasure, StockGroup, StockItem, Godown, InventoryEntry

from database import engine, SessionLocal, init_db

# Only drop and recreate tables if safe to do so. For the demo, we will recreate them.
Base.metadata.drop_all(bind=engine)
init_db()
db = SessionLocal()

print("Database initialized.")

def seed():
    try:
        # --- 1. Masters Creation ---
        print("Creating Masters (Groups, Ledgers, UOM, Items)...")
        
        # Core Groups
        g_capital = TallyGroup(name="Capital Account", parent_id=None)
        g_bank = TallyGroup(name="Bank Accounts", parent_id=None)
        g_sundry_creditors = TallyGroup(name="Sundry Creditors", parent_id=None)
        g_sundry_debtors = TallyGroup(name="Sundry Debtors", parent_id=None)
        g_sales = TallyGroup(name="Sales Accounts", parent_id=None)
        g_purchases = TallyGroup(name="Purchase Accounts", parent_id=None)
        g_indirect_exp = TallyGroup(name="Indirect Expenses", parent_id=None)
        g_duties = TallyGroup(name="Duties & Taxes", parent_id=None)
        
        db.add_all([g_capital, g_bank, g_sundry_creditors, g_sundry_debtors, g_sales, g_purchases, g_indirect_exp, g_duties])
        db.flush()

        # Ledgers
        l_capital = Ledger(name="Owner Capital A/c", group_id=g_capital.id, is_debit_balance=False)
        l_hdfc = Ledger(name="HDFC Bank", group_id=g_bank.id, is_debit_balance=True)
        
        l_supplier = Ledger(name="Interstate Pharma Supplier", group_id=g_sundry_creditors.id, is_debit_balance=False)
        l_customer = Ledger(name="Local Pharmacy", group_id=g_sundry_debtors.id, is_debit_balance=True)
        l_customer2 = Ledger(name="Tech Client", group_id=g_sundry_debtors.id, is_debit_balance=True)
        
        l_sales = Ledger(name="Sales A/c", group_id=g_sales.id, is_debit_balance=False)
        l_purchases = Ledger(name="Purchase A/c", group_id=g_purchases.id, is_debit_balance=True)
        
        l_marketing = Ledger(name="Marketing & Banner Design", group_id=g_indirect_exp.id, is_debit_balance=True)
        
        l_cgst = Ledger(name="CGST", group_id=g_duties.id, is_debit_balance=False)
        l_sgst = Ledger(name="SGST", group_id=g_duties.id, is_debit_balance=False)
        l_igst = Ledger(name="IGST", group_id=g_duties.id, is_debit_balance=False)

        db.add_all([l_capital, l_hdfc, l_supplier, l_customer, l_customer2, l_sales, l_purchases, l_marketing, l_cgst, l_sgst, l_igst])
        db.flush()

        # Voucher Types
        vt_receipt = VoucherType(name="Receipt", is_accounting_voucher=True, is_inventory_voucher=False)
        vt_payment = VoucherType(name="Payment", is_accounting_voucher=True, is_inventory_voucher=False)
        vt_sales = VoucherType(name="Sales", is_accounting_voucher=True, is_inventory_voucher=True)
        vt_purchase = VoucherType(name="Purchase", is_accounting_voucher=True, is_inventory_voucher=True)
        vt_journal = VoucherType(name="Journal", is_accounting_voucher=True, is_inventory_voucher=False)
        db.add_all([vt_receipt, vt_payment, vt_sales, vt_purchase, vt_journal])
        db.flush()

        # Inventory Masters
        uom_nos = UnitOfMeasure(symbol="NOS", formal_name="Numbers")
        uom_lic = UnitOfMeasure(symbol="LIC", formal_name="Licenses")
        db.add_all([uom_nos, uom_lic])
        db.flush()

        godown_main = Godown(name="Main Location")
        db.add(godown_main)
        db.flush()

        item_zink = StockItem(name="Zink2-Win Tablets", uom_id=uom_nos.id, hsn_sac="3004", gst_rate=12.0)
        item_sehzyme = StockItem(name="Sehzyme Drops", uom_id=uom_nos.id, hsn_sac="3004", gst_rate=12.0)
        item_erp = StockItem(name="AI ERP License", uom_id=uom_lic.id, hsn_sac="9973", gst_rate=18.0)
        db.add_all([item_zink, item_sehzyme, item_erp])
        db.flush()

        # --- 2. Transactions ---
        print("Inserting Transactions...")

        # Transaction 1: Capital Injection (Receipt)
        v1 = Voucher(voucher_type_id=vt_receipt.id, voucher_number="RCPT-01", date=date.today(), narration="Capital Injection")
        db.add(v1)
        db.flush()
        db.add_all([
            VoucherEntry(voucher_id=v1.id, ledger_id=l_hdfc.id, amount=Decimal('500000'), is_debit=True),
            VoucherEntry(voucher_id=v1.id, ledger_id=l_capital.id, amount=Decimal('500000'), is_debit=False)
        ])

        # Transaction 2: Purchases (Interstate -> IGST)
        v2 = Voucher(voucher_type_id=vt_purchase.id, voucher_number="PUR-01", date=date.today(), narration="Purchase of medicines")
        db.add(v2)
        db.flush()
        
        # Stock: 1000 Zink @ 50 = 50,000 + 500 Sehzyme @ 120 = 60,000. Total = 110,000
        zink_amt = Decimal('50000')
        sehzyme_amt = Decimal('60000')
        taxable_val = zink_amt + sehzyme_amt
        igst_amt = taxable_val * Decimal('0.12')
        net_purch = taxable_val + igst_amt

        db.add_all([
            InventoryEntry(voucher_id=v2.id, stock_item_id=item_zink.id, godown_id=godown_main.id, quantity=1000, rate=50, amount=50000, is_inward=True),
            InventoryEntry(voucher_id=v2.id, stock_item_id=item_sehzyme.id, godown_id=godown_main.id, quantity=500, rate=120, amount=60000, is_inward=True)
        ])
        db.add_all([
            VoucherEntry(voucher_id=v2.id, ledger_id=l_purchases.id, amount=taxable_val, is_debit=True),
            VoucherEntry(voucher_id=v2.id, ledger_id=l_igst.id, amount=igst_amt, is_debit=True),
            VoucherEntry(voucher_id=v2.id, ledger_id=l_supplier.id, amount=net_purch, is_debit=False)
        ])

        # Transaction 3: Sales Zink2-Win (Intrastate -> CGST/SGST)
        v3 = Voucher(voucher_type_id=vt_sales.id, voucher_number="SAL-01", date=date.today(), narration="Sales to Local Pharmacy")
        db.add(v3)
        db.flush()
        
        # Stock: 200 Zink @ 150 = 30,000
        z_sales_amt = Decimal('30000')
        z_cgst = z_sales_amt * Decimal('0.06')
        z_sgst = z_sales_amt * Decimal('0.06')
        z_net = z_sales_amt + z_cgst + z_sgst

        db.add_all([
            InventoryEntry(voucher_id=v3.id, stock_item_id=item_zink.id, godown_id=godown_main.id, quantity=200, rate=150, amount=30000, is_inward=False)
        ])
        db.add_all([
            VoucherEntry(voucher_id=v3.id, ledger_id=l_customer.id, amount=z_net, is_debit=True),
            VoucherEntry(voucher_id=v3.id, ledger_id=l_sales.id, amount=z_sales_amt, is_debit=False),
            VoucherEntry(voucher_id=v3.id, ledger_id=l_cgst.id, amount=z_cgst, is_debit=False),
            VoucherEntry(voucher_id=v3.id, ledger_id=l_sgst.id, amount=z_sgst, is_debit=False)
        ])

        # Transaction 4: Sales AI ERP License (Intrastate -> CGST/SGST)
        v4 = Voucher(voucher_type_id=vt_sales.id, voucher_number="SAL-02", date=date.today(), narration="ERP Software License Sale")
        db.add(v4)
        db.flush()
        
        # Stock: 1 License @ 25,000
        erp_amt = Decimal('25000')
        erp_cgst = erp_amt * Decimal('0.09')
        erp_sgst = erp_amt * Decimal('0.09')
        erp_net = erp_amt + erp_cgst + erp_sgst

        db.add_all([
            InventoryEntry(voucher_id=v4.id, stock_item_id=item_erp.id, godown_id=godown_main.id, quantity=1, rate=25000, amount=25000, is_inward=False)
        ])
        db.add_all([
            VoucherEntry(voucher_id=v4.id, ledger_id=l_customer2.id, amount=erp_net, is_debit=True),
            VoucherEntry(voucher_id=v4.id, ledger_id=l_sales.id, amount=erp_amt, is_debit=False),
            VoucherEntry(voucher_id=v4.id, ledger_id=l_cgst.id, amount=erp_cgst, is_debit=False),
            VoucherEntry(voucher_id=v4.id, ledger_id=l_sgst.id, amount=erp_sgst, is_debit=False)
        ])

        # Transaction 5: Expenses (Payment)
        v5 = Voucher(voucher_type_id=vt_payment.id, voucher_number="PAY-01", date=date.today(), narration="Paid for Marketing Banners")
        db.add(v5)
        db.flush()
        
        mkt_amt = Decimal('15000')
        db.add_all([
            VoucherEntry(voucher_id=v5.id, ledger_id=l_marketing.id, amount=mkt_amt, is_debit=True),
            VoucherEntry(voucher_id=v5.id, ledger_id=l_hdfc.id, amount=mkt_amt, is_debit=False)
        ])

        db.commit()
        print("Success! Database populated with realistic transactions.")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
