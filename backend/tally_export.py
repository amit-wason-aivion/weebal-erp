import xml.etree.ElementTree as ET
from sqlalchemy.orm import Session
from models import Ledger, Voucher, VoucherEntry, VoucherType, TallyGroup, StockItem, UnitOfMeasure
from datetime import datetime

def generate_bulk_tally_xml(db: Session):
    """
    Generates a single Tally-compliant XML file containing all Masters and Vouchers.
    """
    root = ET.Element("ENVELOPE")
    
    header = ET.SubElement(root, "HEADER")
    ET.SubElement(header, "TALLYREQUEST").text = "Import Data"
    
    body = ET.SubElement(root, "BODY")
    import_data = ET.SubElement(body, "IMPORTDATA")
    
    request_desc = ET.SubElement(import_data, "REQUESTDESC")
    ET.SubElement(request_desc, "REPORTNAME").text = "All Masters"
    
    request_data = ET.SubElement(import_data, "REQUESTDATA")

    # 1. Export Groups
    groups = db.query(TallyGroup).all()
    for group in groups:
        tm = ET.SubElement(request_data, "TALLYMESSAGE", {"xmlns:UDF": "TallyUDF"})
        grp = ET.SubElement(tm, "GROUP", {"NAME": group.name, "ACTION": "Create"})
        ET.SubElement(grp, "NAME").text = group.name
        if group.parent_id:
            parent = db.query(TallyGroup).filter(TallyGroup.id == group.parent_id).first()
            if parent:
                ET.SubElement(grp, "PARENT").text = parent.name

    # 2. Export Ledgers
    ledgers = db.query(Ledger).all()
    for ledger in ledgers:
        tm = ET.SubElement(request_data, "TALLYMESSAGE", {"xmlns:UDF": "TallyUDF"})
        led = ET.SubElement(tm, "LEDGER", {"NAME": ledger.name, "ACTION": "Create"})
        ET.SubElement(led, "NAME").text = ledger.name
        
        group = db.query(TallyGroup).filter(TallyGroup.id == ledger.group_id).first()
        ET.SubElement(led, "PARENT").text = group.name if group else "Suspense A/c"
        
        ET.SubElement(led, "OPENINGBALANCE").text = str(ledger.opening_balance if not ledger.is_debit_balance else -ledger.opening_balance)
        ET.SubElement(led, "ISBILLWISEON").text = "No"

    # 3. Export Stock Items
    stock_items = db.query(StockItem).all()
    for item in stock_items:
        tm = ET.SubElement(request_data, "TALLYMESSAGE", {"xmlns:UDF": "TallyUDF"})
        si = ET.SubElement(tm, "STOCKITEM", {"NAME": item.name, "ACTION": "Create"})
        ET.SubElement(si, "NAME").text = item.name
        
        uom = db.query(UnitOfMeasure).filter(UnitOfMeasure.id == item.uom_id).first()
        ET.SubElement(si, "BASEUNITS").text = uom.symbol if uom else "nos"
        
        ET.SubElement(si, "GSTDETAILS.LIST") # Placeholder for GST compliance

    # 4. Export Vouchers
    vouchers = db.query(Voucher).all()
    for voucher in vouchers:
        vtype = db.query(VoucherType).filter(VoucherType.id == voucher.voucher_type_id).first()
        vtype_name = vtype.name if vtype else "Journal"
        
        tm = ET.SubElement(request_data, "TALLYMESSAGE", {"xmlns:UDF": "TallyUDF"})
        vch = ET.SubElement(tm, "VOUCHER", {
            "ACTION": "Create",
            "VCHTYPE": vtype_name
        })
        
        ET.SubElement(vch, "DATE").text = voucher.date.strftime("%Y%m%d")
        ET.SubElement(vch, "VOUCHERTYPENAME").text = vtype_name
        ET.SubElement(vch, "VOUCHERNUMBER").text = voucher.voucher_number
        ET.SubElement(vch, "NARRATION").text = voucher.narration or ""
        
        entries = db.query(VoucherEntry).filter(VoucherEntry.voucher_id == voucher.id).all()
        for entry in entries:
            led_obj = db.query(Ledger).filter(Ledger.id == entry.ledger_id).first()
            if not led_obj: continue
            
            le = ET.SubElement(vch, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(le, "LEDGERNAME").text = led_obj.name
            ET.SubElement(le, "ISDEEMEDPOSITIVE").text = "Yes" if entry.is_debit else "No"
            # Tally logic: Debit is negative, Credit is positive for amount field
            amount = float(entry.amount)
            ET.SubElement(le, "AMOUNT").text = f"-{amount}" if entry.is_debit else f"{amount}"

    return ET.tostring(root, encoding="unicode")
