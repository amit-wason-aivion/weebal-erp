import requests
import xml.etree.ElementTree as ET
import json
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    filename='tally_import.log',
    filemode='a'
)

import os

TALLY_URL = os.getenv("TALLY_URL", "http://localhost:9000")

def parse_tally_amount(amt_text: str):
    """
    Parses Tally amount strings which can be '1000.00 Dr', '2000.00 Cr', or simply '-2000'
    Returns (abs_amount, is_debit)
    In Tally XML: 
    - Master balances: positive is usually target, but suffixes Dr/Cr are explicit.
    - Transaction amounts: usually negative is Debit, positive is Credit.
    """
    if not amt_text:
        return 0.0, True
    
    clean_text = amt_text.strip()
    is_debit = True
    
    # Handle suffixes
    if clean_text.lower().endswith('dr'):
        is_debit = True
        clean_text = clean_text[:-2].strip()
    elif clean_text.lower().endswith('cr'):
        is_debit = False
        clean_text = clean_text[:-2].strip()
        
    try:
        val = float(clean_text)
        # If it was a simple number without suffix:
        # In Tally transactions, -ve is Debit.
        # In some contexts, masters might use -ve for Credit.
        # We will assume if suffix was present, it takes precedence.
        # If no suffix and negative, we'll treat it as standard Tally logic (Debit = -ve for transactions)
        # However, for Masters, it depends on the export style.
        # Let's check for sign if no suffix was found above
        if amt_text.strip() == clean_text: # No suffix was removed
            if val < 0:
                is_debit = True # Standard Tally XML transaction logic
                val = abs(val)
            else:
                is_debit = False
        
        return abs(val), is_debit
    except ValueError:
        return 0.0, True
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

def sync_ledgers_to_db(db, company_id: int, xml_content=None):
    """
    High-level function to sync ledgers from Tally to PostgreSQL.
    Accepts optional xml_content for file-based uploads.
    """
    from .models import Ledger, TallyGroup
    from sqlalchemy.orm import Session
    from decimal import Decimal
    
    if not xml_content:
        xml_content = fetch_ledgers_from_tally()
        
    if not xml_content:
        return {"error": "Could not connect to Tally or no content provided"}
    
    logging.info(f"sync_ledgers_to_db started. Company ID: {company_id}. XML size: {len(xml_content)}")
    root = ET.fromstring(xml_content)
    count = 0
    all_ledgers = list(root.iter('LEDGER'))
    logging.info(f"Found {len(all_ledgers)} LEDGER elements in XML.")
    
    for ledger_elem in all_ledgers:
        name = ledger_elem.attrib.get('NAME')
        if not name: 
            name = ledger_elem.findtext('NAME')
        if not name: continue
        
        logging.info(f"Processing ledger: {name}")
        
        guid = ledger_elem.findtext('GUID')
        alterid = ledger_elem.findtext('ALTERID')
        parent_group_name = ledger_elem.findtext('PARENT')
        # 1. Get or Create Group
        if not parent_group_name:
            parent_group_name = "Primary" # Default for root groups
            
        group = db.query(TallyGroup).filter(TallyGroup.name == parent_group_name, TallyGroup.company_id == company_id).first()
        if not group:
            group = TallyGroup(name=parent_group_name, company_id=company_id)
            db.add(group)
            db.flush()
        
        # 2. Extract Balance
        opening_bal_elem = ledger_elem.find('OPENINGBALANCE')
        bal_text = opening_bal_elem.text if opening_bal_elem is not None else ""
        opening_bal, is_debit = parse_tally_amount(bal_text)
        
        # Override logic for Masters: Usually in masters, positive is Debit unless Cr suffix
        # Actually Tally XML Masters: <OPENINGBALANCE>1000.00</OPENINGBALANCE> is Debit
        # <OPENINGBALANCE>-1000.00</OPENINGBALANCE> is Credit
        # But if it has " Cr", that's better.
        # My parse_tally_amount handles suffixes.
        
        # 3. Extract Additional Info
        address = ""
        # Try finding ADDRESS.LIST directly under LEDGER or under LEDMAILINGDETAILS.LIST
        address_list = ledger_elem.find('ADDRESS.LIST')
        if address_list is None:
            mailing_details = ledger_elem.find('LEDMAILINGDETAILS.LIST')
            if mailing_details is not None:
                address_list = mailing_details.find('ADDRESS.LIST')
        
        if address_list is not None:
            address_parts = [addr.text for addr in address_list.findall('ADDRESS') if addr.text]
            address = ", ".join(address_parts)
            
        city = ledger_elem.findtext('CITY') or ""
        state = ledger_elem.findtext('STATENAME') or ""
        # Check in mailing details if not at root
        if not state:
            mailing_details = ledger_elem.find('LEDMAILINGDETAILS.LIST')
            if mailing_details is not None:
                state = mailing_details.findtext('STATE') or ""
        
        pincode = ledger_elem.findtext('PINCODE') or ""
        gstin = ledger_elem.findtext('GNPANNO') or ""
        # Sometimes in GNPANNO or PARTYGSTIN
        if not gstin:
            gstin = ledger_elem.findtext('PARTYGSTIN') or ""
        
        # New: Phone, Email, PAN/Income Tax No
        phone = ledger_elem.findtext('PHONENUMBER') or ""
        email = ledger_elem.findtext('EMAIL') or ""
        pan_no = ledger_elem.findtext('INCOMETAXNUMBER') or ""
        drug_license = ledger_elem.findtext('DRUGLICENSENO') or ""
        
        # If not at root, check mailing details
        if not (phone and email):
            mailing_details = ledger_elem.find('LEDMAILINGDETAILS.LIST')
            if mailing_details is not None:
                if not phone: phone = mailing_details.findtext('PHONENUMBER') or ""
                if not email: email = mailing_details.findtext('EMAIL') or ""

        # 4. UPSERT Ledger
        db_ledger = db.query(Ledger).filter(Ledger.name == name, Ledger.company_id == company_id).first()
        if not db_ledger:
            db_ledger = Ledger(name=name, company_id=company_id)
            db.add(db_ledger)
        
        db_ledger.group_id = group.id
        db_ledger.tally_guid = guid
        db_ledger.alterid = int(alterid) if alterid else 0
        db_ledger.opening_balance = Decimal(str(opening_bal))
        db_ledger.is_debit_balance = is_debit
        db_ledger.address = address
        db_ledger.city = city
        db_ledger.state = state
        db_ledger.pincode = pincode
        db_ledger.gstin = gstin
        db_ledger.phone = phone
        db_ledger.email = email
        db_ledger.pan_no = pan_no
        db_ledger.drug_license_no = drug_license
        count += 1

    db.commit()
    return {"message": f"Successfully synced {count} ledgers from Tally."}

def sync_vouchers_to_db(db, company_id: int, xml_content=None):
    """
    High-level function to sync vouchers from Tally to PostgreSQL.
    Accepts optional xml_content for file-based uploads.
    """
    from .models import Voucher, VoucherEntry, Ledger, VoucherType
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
    
    logging.info(f"sync_vouchers_to_db started. Company ID: {company_id}. XML size: {len(xml_content)}")
    all_vouchers = list(root.iter('VOUCHER'))
    logging.info(f"Found {len(all_vouchers)} VOUCHER elements in XML.")
    
    count = 0
    for vch_elem in all_vouchers:
        vch_number = vch_elem.findtext('VOUCHERNUMBER')
        guid = vch_elem.findtext('GUID')
        logging.info(f"Processing voucher: {vch_number} (GUID: {guid})")
        alterid = int(vch_elem.findtext('ALTERID') or 0)
        vch_type_name = vch_elem.findtext('VOUCHERTYPENAME')
        vch_date_str = vch_elem.findtext('DATE') # YYYYMMDD
        narration = vch_elem.findtext('NARRATION')
        
        # Skip if already synced by alterid
        existing = db.query(Voucher).filter(Voucher.tally_guid == guid, Voucher.company_id == company_id).first()
        if existing and existing.alterid == alterid:
            continue
            
        # 1. Get Voucher Type
        vtype = db.query(VoucherType).filter(VoucherType.name == vch_type_name, VoucherType.company_id == company_id).first()
        if not vtype:
            vtype = VoucherType(name=vch_type_name, company_id=company_id)
            db.add(vtype)
            db.flush()
            
        # 2. Parse Date
        try:
            vch_date = datetime.strptime(vch_date_str, "%Y%m%d").date()
        except (ValueError, TypeError):
            # Fallback to current date or skip? Let's skip if date is invalid for an import
            continue
        
        # 3. Create/Update Voucher
        if not existing:
            existing = Voucher(company_id=company_id)
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
            ledger = db.query(Ledger).filter(Ledger.name == ledger_name, Ledger.company_id == company_id).first()
            if not ledger:
                # Create a placeholder ledger if not found
                # It's better to sync masters first, but this handles partial syncs
                from .models import TallyGroup
                suspense_group = db.query(TallyGroup).filter(TallyGroup.name == 'Suspense Accounts', TallyGroup.company_id == company_id).first()
                if not suspense_group:
                    suspense_group = TallyGroup(name='Suspense Accounts', company_id=company_id)
                    db.add(suspense_group)
                    db.flush()
                ledger = Ledger(name=ledger_name, group_id=suspense_group.id, company_id=company_id)
                db.add(ledger)
                db.flush()
            
            amt_val, is_debit = parse_tally_amount(amount_str)
            if amt_val != 0:
                vch_entry = VoucherEntry(
                    voucher_id=existing.id,
                    ledger_id=ledger.id,
                    amount=Decimal(str(amt_val)),
                    is_debit=is_debit
                )
                db.add(vch_entry)
        
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
