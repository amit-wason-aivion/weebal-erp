import requests
import xml.etree.ElementTree as ET
import json
import logging
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

import os

TALLY_URL = os.getenv("TALLY_URL", "http://localhost:9000")

def get_tally_ledgers_xml():
    """
    Constructs the Tally XML request to fetch all Ledgers.
    """
    request_xml = """<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Export Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <EXPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>List of Accounts</REPORTNAME>
                <STATICVARIABLES>
                    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    <ACCOUNTTYPE>Ledgers</ACCOUNTTYPE>
                </STATICVARIABLES>
            </REQUESTDESC>
        </EXPORTDATA>
    </BODY>
</ENVELOPE>"""
    return request_xml

def get_tally_vouchers_xml():
    """
    Constructs the Tally XML request to fetch all Vouchers.
    """
    request_xml = """<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Export Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <EXPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Voucher Register</REPORTNAME>
                <STATICVARIABLES>
                    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                </STATICVARIABLES>
            </REQUESTDESC>
        </EXPORTDATA>
    </BODY>
</ENVELOPE>"""
    return request_xml

def fetch_ledgers_from_tally():
    """
    Sends the XML request to Tally and returns the raw XML response.
    """
    xml_data = get_tally_ledgers_xml()
    headers = {'Content-Type': 'text/xml'}
    
    try:
        logging.info(f"Sending request to Tally at {TALLY_URL}...")
        response = requests.post(TALLY_URL, data=xml_data, headers=headers)
        response.raise_for_status() # Raise an exception for bad status codes
        return response.text
    except requests.exceptions.RequestException as e:
        logging.error(f"Error communicating with Tally: {e}")
        return None

def parse_tally_ledger_xml_to_json(xml_content):
    """
    Parses the Tally XML response for Ledgers and converts it into a list of JSON-serializable dictionaries.
    """
    if not xml_content:
        return json.dumps({"error": "No XML content provided"})

    try:
        root = ET.fromstring(xml_content)
        ledgers = []
        
        for ledger_elem in root.iter('LEDGER'):
            ledger_data = {}
            
            # Extract common properties
            ledger_data['name'] = ledger_elem.attrib.get('NAME', '')
            ledger_data['tally_guid'] = ledger_elem.findtext('GUID', default='')
            ledger_data['alterid'] = ledger_elem.findtext('ALTERID', default='')
            ledger_data['parent_group'] = ledger_elem.findtext('PARENT', default='')
            
            # Opening Balance (Tally typically stores Debit as positive, Credit as negative)
            opening_bal_elem = ledger_elem.find('OPENINGBALANCE')
            if opening_bal_elem is not None and opening_bal_elem.text:
                bal_text = opening_bal_elem.text.strip()
                # If negative, it's usually Credit. If positive, Debit.
                try:
                    amount = float(bal_text)
                    ledger_data['opening_balance'] = abs(amount)
                    ledger_data['is_debit'] = amount > 0
                except ValueError:
                    ledger_data['opening_balance'] = 0.0
                    ledger_data['is_debit'] = True
            else:
                ledger_data['opening_balance'] = 0.0
                ledger_data['is_debit'] = True
                
            # Bill by Bill enabled
            bill_by_bill_elem = ledger_elem.find('ISBILLWISEON')
            ledger_data['bill_by_bill_enabled'] = bill_by_bill_elem is not None and bill_by_bill_elem.text is not None and bill_by_bill_elem.text.strip().upper() == 'YES'

            ledgers.append(ledger_data)
            
        return json.dumps(ledgers, indent=4)
        
    except ET.ParseError as e:
        logging.error(f"Failed to parse XML from Tally: {e}")
        return json.dumps({"error": "XML Parse Error"})

def sync_ledgers_to_db(db, xml_content=None):
    """
    High-level function to sync ledgers from Tally to PostgreSQL.
    Accepts optional xml_content for file-based uploads.
    """
    from models import Ledger, TallyGroup
    from sqlalchemy.orm import Session
    from decimal import Decimal
    
    if not xml_content:
        xml_content = fetch_ledgers_from_tally()
        
    if not xml_content:
        return {"error": "Could not connect to Tally or no content provided"}
    
    root = ET.fromstring(xml_content)
    count = 0
    for ledger_elem in root.iter('LEDGER'):
        name = ledger_elem.attrib.get('NAME')
        if not name: continue
        
        guid = ledger_elem.findtext('GUID')
        alterid = ledger_elem.findtext('ALTERID')
        parent_group_name = ledger_elem.findtext('PARENT')
        
        # 1. Get or Create Group
        group = db.query(TallyGroup).filter(TallyGroup.name == parent_group_name).first()
        if not group:
            group = TallyGroup(name=parent_group_name)
            db.add(group)
            db.flush()
        
        # 2. Extract Balance
        opening_bal = 0.0
        is_debit = True
        opening_bal_elem = ledger_elem.find('OPENINGBALANCE')
        if opening_bal_elem is not None and opening_bal_elem.text:
            bal_text = opening_bal_elem.text.strip()
            try:
                amount = float(bal_text)
                opening_bal = abs(amount)
                is_debit = amount > 0
            except: pass

        # 3. UPSERT Ledger
        db_ledger = db.query(Ledger).filter(Ledger.name == name).first()
        if not db_ledger:
            db_ledger = Ledger(name=name)
            db.add(db_ledger)
        
        db_ledger.group_id = group.id
        db_ledger.tally_guid = guid
        db_ledger.alterid = int(alterid) if alterid else 0
        db_ledger.opening_balance = Decimal(str(opening_bal))
        db_ledger.is_debit_balance = is_debit
        count += 1

    db.commit()
    return {"message": f"Successfully synced {count} ledgers from Tally."}

def sync_vouchers_to_db(db, xml_content=None):
    """
    High-level function to sync vouchers from Tally to PostgreSQL.
    Accepts optional xml_content for file-based uploads.
    """
    from models import Voucher, VoucherEntry, Ledger, VoucherType
    from sqlalchemy.orm import Session
    from decimal import Decimal
    from datetime import datetime
    
    if not xml_content:
        xml_request = get_tally_vouchers_xml()
        headers = {'Content-Type': 'text/xml'}
        response = requests.post(TALLY_URL, data=xml_request, headers=headers)
        if response.status_code != 200:
            return {"error": "Could not connect to Tally"}
        xml_content = response.text
    
    try:
        root = ET.fromstring(xml_content)
    except Exception as e:
        return {"error": f"Invalid XML format: {str(e)}"}
    count = 0
    for vch_elem in root.iter('VOUCHER'):
        vch_number = vch_elem.findtext('VOUCHERNUMBER')
        guid = vch_elem.findtext('GUID')
        alterid = int(vch_elem.findtext('ALTERID') or 0)
        vch_type_name = vch_elem.findtext('VOUCHERTYPENAME')
        vch_date_str = vch_elem.findtext('DATE') # YYYYMMDD
        narration = vch_elem.findtext('NARRATION')
        
        # Skip if already synced by alterid
        existing = db.query(Voucher).filter(Voucher.tally_guid == guid).first()
        if existing and existing.alterid == alterid:
            continue
            
        # 1. Get Voucher Type
        vtype = db.query(VoucherType).filter(VoucherType.name == vch_type_name).first()
        if not vtype:
            vtype = VoucherType(name=vch_type_name)
            db.add(vtype)
            db.flush()
            
        # 2. Parse Date
        vch_date = datetime.strptime(vch_date_str, "%Y%m%d").date()
        
        # 3. Create/Update Voucher
        if not existing:
            existing = Voucher()
            db.add(existing)
        
        existing.voucher_type_id = vtype.id
        existing.voucher_number = vch_number
        existing.date = vch_date
        existing.narration = narration
        existing.tally_guid = guid
        existing.alterid = alterid
        existing.is_synced = True
        db.flush()
        
        # 4. Handle Entries (All Ledgers list)
        # Clear existing entries for this voucher if we are re-syncing
        db.query(VoucherEntry).filter(VoucherEntry.voucher_id == existing.id).delete()
        
        for ledger_entry in vch_elem.findall('ALLLEDGERENTRIES.LIST'):
            ledger_name = ledger_entry.findtext('LEDGERNAME')
            amount_str = ledger_entry.findtext('AMOUNT')
            
            # Find Ledger
            ledger = db.query(Ledger).filter(Ledger.name == ledger_name).first()
            if not ledger:
                # Create a placeholder ledger if not found
                # It's better to sync masters first, but this handles partial syncs
                from models import TallyGroup
                suspense_group = db.query(TallyGroup).filter(TallyGroup.name == 'Suspense Accounts').first()
                if not suspense_group:
                    suspense_group = TallyGroup(name='Suspense Accounts')
                    db.add(suspense_group)
                    db.flush()
                ledger = Ledger(name=ledger_name, group_id=suspense_group.id)
                db.add(ledger)
                db.flush()
            
            try:
                amt_val = float(amount_str)
                is_debit = amt_val < 0 # Tally XML: -ve for Debit, +ve for Credit
                vch_entry = VoucherEntry(
                    voucher_id=existing.id,
                    ledger_id=ledger.id,
                    amount=Decimal(str(abs(amt_val))),
                    is_debit=is_debit
                )
                db.add(vch_entry)
            except: continue
        
        count += 1
        
    db.commit()
    return {"message": f"Successfully imported {count} transactions from Tally."}

if __name__ == "__main__":
    # Test execution flow
    logging.info("Starting Tally Ledger Extraction...")
    xml_response = fetch_ledgers_from_tally()
    
    if xml_response:
        logging.info("Successfully fetched XML from Tally. Parsing...")
        json_output = parse_tally_ledger_xml_to_json(xml_response)
        
        # Print a small sample or the whole thing
        # For demonstration, we'll print the first 500 characters
        print("\n--- Parsed JSON Output ---")
        print(json_output[:1000] + ("\n..." if len(json_output) > 1000 else ""))
    else:
        logging.error("Failed to retrieve data. Make sure Tally is running and accessible on port 9000.")
        sys.exit(1)
