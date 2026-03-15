import sys
import os
import logging

# Ensure the script can find local modules when run directly
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

try:
    from database import SessionLocal
    from models import Voucher, VoucherEntry, InventoryEntry, VoucherType, TallyGroup, Ledger, StockItem, Company, UnitOfMeasure
except ImportError:
    from .database import SessionLocal
    from .models import Voucher, VoucherEntry, InventoryEntry, VoucherType, TallyGroup, Ledger, StockItem, Company, UnitOfMeasure

logging.basicConfig(level=logging.INFO)

def repair_vouchers():
    db = SessionLocal()
    try:
        def get_or_create_dummy_item(company_id, name="Service Item (Tally Import)"):
            item = db.query(StockItem).filter(StockItem.name == name, StockItem.company_id == company_id).first()
            if not item:
                uom = db.query(UnitOfMeasure).filter(UnitOfMeasure.company_id == company_id).first()
                if not uom:
                    uom = UnitOfMeasure(company_id=company_id, symbol="Nos", formal_name="Numbers")
                    db.add(uom)
                    db.commit()
                    db.refresh(uom)
                
                item = StockItem(
                    name=name,
                    company_id=company_id,
                    uom_id=uom.id,
                    gst_rate=0
                )
                db.add(item)
                db.commit()
                db.refresh(item)
                logging.info(f"Created stock item '{name}' ID {item.id} for company {company_id}")
            return item

        vouchers = db.query(Voucher).all()
        repaired_count = 0
        
        for v in vouchers:
            vtype = db.query(VoucherType).filter(VoucherType.id == v.voucher_type_id).first()
            if not vtype: continue
            
            vtype_name = vtype.name.upper()
            if 'SALES' in vtype_name or 'PURCHASE' in vtype_name:
                # Look for revenue/expense ledgers to get a good name
                entries = db.query(VoucherEntry, Ledger).join(Ledger).filter(VoucherEntry.voucher_id == v.id).all()
                target_entry = None
                for ve, l in entries:
                    group = db.query(TallyGroup).filter(TallyGroup.id == l.group_id).first()
                    group_name = group.name.lower() if group else ""
                    is_revenue = ('SALES' in vtype_name and not ve.is_debit and 'sales accounts' in group_name)
                    is_expense = ('PURCHASE' in vtype_name and ve.is_debit and 'purchase accounts' in group_name)
                    if is_revenue or is_expense:
                        target_entry = (ve, l)
                        break

                if not target_entry: continue
                ve, l = target_entry
                item_name = f"Service: {l.name}"
                new_item = get_or_create_dummy_item(v.company_id, item_name)

                # 1. Fix mismatched or generic company items
                inv_entries = db.query(InventoryEntry).filter(InventoryEntry.voucher_id == v.id).all()
                if inv_entries:
                    for inv in inv_entries:
                        # If it points to an old generic item OR wrong company
                        s = db.query(StockItem).get(inv.stock_item_id)
                        if s.company_id != v.company_id or s.name == "Service Item (Tally Import)":
                            inv.stock_item_id = new_item.id
                            logging.info(f"Updated Voucher {v.id}: Switched item to '{item_name}'")
                else:
                    # 2. Create if missing
                    inv = InventoryEntry(
                        voucher_id=v.id,
                        stock_item_id=new_item.id,
                        quantity=1,
                        rate=ve.amount,
                        amount=ve.amount,
                        is_inward=('PURCHASE' in vtype_name)
                    )
                    db.add(inv)
                    repaired_count += 1
                    logging.info(f"Repaired Voucher {v.id} ({v.voucher_number}) - Added virtual item '{item_name}'")
        
        db.commit()
        logging.info(f"Repair complete. Total vouchers fixed/updated: {repaired_count}")
        
    finally:
        db.close()

if __name__ == "__main__":
    repair_vouchers()
