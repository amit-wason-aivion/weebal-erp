import requests
import xml.etree.ElementTree as ET
from sqlalchemy.orm import Session
from models import Voucher, VoucherEntry, Ledger, VoucherType, InventoryEntry, StockItem
import datetime

import os

TALLY_URL = os.getenv("TALLY_URL", "http://localhost:9000")

def generate_voucher_xml(voucher_id: int, db: Session):
    """
    Translates a PostgreSQL voucher into Tally ERP 9 XML format.
    """
    voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
    if not voucher:
        return None

    vtype = db.query(VoucherType).filter(VoucherType.id == voucher.voucher_type_id).first()
    entries = db.query(VoucherEntry).filter(VoucherEntry.voucher_id == voucher_id).all()
    inventory = db.query(InventoryEntry, StockItem).join(StockItem).filter(InventoryEntry.voucher_id == voucher_id).all()

    # Tally Date format: YYYYMMDD
    tally_date = voucher.date.strftime("%Y%m%d")
    vtype_name = vtype.name if vtype else "Journal"

    # XML Construction
    xml_root = ET.Element("ENVELOPE")
    
    header = ET.SubElement(xml_root, "HEADER")
    ET.SubElement(header, "TALLYREQUEST").text = "Import Data"
    
    body = ET.SubElement(xml_root, "BODY")
    import_data = ET.SubElement(body, "IMPORTDATA")
    
    request_desc = ET.SubElement(import_data, "REQUESTDESC")
    ET.SubElement(request_desc, "REPORTNAME").text = "Vouchers"
    
    request_data = ET.SubElement(import_data, "REQUESTDATA")
    tally_msg = ET.SubElement(request_data, "TALLYMESSAGE", {"xmlns:UDF": "TallyUDF"})
    
    vch = ET.SubElement(tally_msg, "VOUCHER", {
        "VCHTYPE": vtype_name,
        "ACTION": "Create",
        "OBJVIEW": "Accounting Voucher View"
    })

    ET.SubElement(vch, "DATE").text = tally_date
    ET.SubElement(vch, "VOUCHERTYPENAME").text = vtype_name
    ET.SubElement(vch, "VOUCHERNUMBER").text = voucher.voucher_number
    ET.SubElement(vch, "NARRATION").text = voucher.narration or ""
    ET.SubElement(vch, "ISOPTIONAL").text = "No"
    
    # Accounting Entries
    for entry in entries:
        ledger = db.query(Ledger).filter(Ledger.id == entry.ledger_id).first()
        if not ledger: continue

        led_entry = ET.SubElement(vch, "ALLLEDGERENTRIES.LIST")
        ET.SubElement(led_entry, "LEDGERNAME").text = ledger.name
        ET.SubElement(led_entry, "ISDEEMEDPOSITIVE").text = "Yes" if entry.is_debit else "No"
        
        # Tally treats Credits as positive and Debits as negative in its internal logic for ISDEEMEDPOSITIVE=No
        # But for XML import, we usually send the amount as negative if it's a Credit? 
        # Actually, Tally XML import: Debit is negative, Credit is positive.
        amount = float(entry.amount)
        ET.SubElement(led_entry, "AMOUNT").text = f"-{amount}" if entry.is_debit else f"{amount}"

    # Inventory Entries (for Sales Invoices)
    for inv_item, stock_item in inventory:
        # Note: In Tally, inventory entries are sub-lists under a ledger entry 
        # (usually the Sales or Purchase ledger).
        # For simplicity in this demo, we'll focus on the accounting entries sync.
        # But if we were to do full inventory sync:
        pass

    return ET.tostring(xml_root, encoding="unicode")

def sync_voucher_to_tally(voucher_id: int, db: Session):
    """
    Sends the generated XML to Tally and updates the database with results.
    """
    xml_payload = generate_voucher_xml(voucher_id, db)
    if not xml_payload:
        print(f"Failed to generate XML for voucher {voucher_id}")
        return

    try:
        response = requests.post(TALLY_URL, data=xml_payload, headers={'Content-Type': 'text/xml'})
        if response.status_code == 200:
            resp_xml = response.text
            print(f"Tally Response: {resp_xml}")
            
            # Simple parsing for success
            if "<CREATED>1</CREATED>" in resp_xml or "<ALTERED>1</ALTERED>" in resp_xml:
                voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
                if voucher:
                    voucher.is_synced = True
                    # Try to extract ALTERID if possible
                    try:
                        root = ET.fromstring(resp_xml)
                        alterid_tag = root.find(".//ALTERID")
                        if alterid_tag is not None:
                            voucher.alterid = int(alterid_tag.text)
                    except:
                        pass
                    db.commit()
                    print(f"Voucher {voucher_id} synced successfully.")
            else:
                print(f"Tally rejected Voucher {voucher_id}: {resp_xml}")
        else:
            print(f"Tally Server Error: {response.status_code}")
    except Exception as e:
        print(f"Sync Error: {str(e)}")
