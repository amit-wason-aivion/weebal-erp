import React, { useState, useEffect } from 'react';
import { Form, Input, Select, DatePicker, Button, Table, Typography, message, Row, Col, Divider, Switch, Modal, Badge, Tag, Space } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import axios from '../api/axios';
import dayjs from 'dayjs';
import LedgerDrawer from './LedgerDrawer';
import { PlusOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const formatStock = (total, mainUnit, subUnit, factor) => {
    if (!mainUnit || !subUnit || !factor || factor <= 1) return `${total} ${mainUnit || 'Units'}`;
    const mainQty = Math.floor(total);
    const subQty = Math.round((total % 1) * factor);
    return `${mainQty} ${mainUnit}${mainQty !== 1 ? 'es' : ''}, ${subQty} ${subUnit}${subQty !== 1 ? 's' : ''}`;
};

const numberToWords = (num) => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const inWords = (n) => {
        if ((n = n.toString()).length > 9) return 'overflow';
        let n_array = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n_array) return '';
        let str = '';
        str += (n_array[1] != 0) ? (a[Number(n_array[1])] || b[n_array[1][0]] + ' ' + a[n_array[1][1]]) + 'Crore ' : '';
        str += (n_array[2] != 0) ? (a[Number(n_array[2])] || b[n_array[2][0]] + ' ' + a[n_array[2][1]]) + 'Lakh ' : '';
        str += (n_array[3] != 0) ? (a[Number(n_array[3])] || b[n_array[3][0]] + ' ' + a[n_array[3][1]]) + 'Thousand ' : '';
        str += (n_array[4] != 0) ? (a[Number(n_array[4])] || b[n_array[4][0]] + ' ' + a[n_array[4][1]]) + 'Hundred ' : '';
        str += (n_array[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n_array[5])] || b[n_array[5][0]] + ' ' + a[n_array[5][1]]) : '';
        return str;
    };
    
    const splitNum = num.toString().split('.');
    const whole = inWords(splitNum[0]);
    const fraction = splitNum[1] ? inWords(splitNum[1]) : '';
    
    return `Rupees ${whole}${fraction ? 'and ' + fraction + 'Paise ' : ''}Only`;
};

const normalizeLedgerId = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const normalized = Number(value);
    return Number.isNaN(normalized) ? value : normalized;
};

const toSelectLedgerValue = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    return String(value);
};

const SalesInvoice = () => {
  const [form] = Form.useForm();
  const { companyType, activeCompany } = useCompany();
  const isPharma = companyType === 'PHARMA';
  
  const [ledgers, setLedgers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [batchesMap, setBatchesMap] = useState({}); // {stock_item_id: [batches]}
  const [ledgerDrawerVisible, setLedgerDrawerVisible] = useState(false);
  const [initialGroupId, setInitialGroupId] = useState(null);
  const [items, setItems] = useState([
    { key: 0, stock_item_id: null, batch_id: null, quantity: 1, unit_type: 'main', rate: 0, amount: 0, gst_rate: 0 }
  ]);
  const [isInterstate, setIsInterstate] = useState(false);
  const [isLUT, setIsLUT] = useState(false);
  
  // Substitute Search Modal
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [currentSalt, setCurrentSalt] = useState('');
  const [substitutes, setSubstitutes] = useState([]);

  // Watch party selection for address info
  const selectedPartyId = Form.useWatch('party_ledger_id', form);
  const selectedParty = ledgers.find(l => String(l.id) === String(selectedPartyId));
  
  const navigate = useNavigate();
  const { id } = useParams();

  // GST Calculation Logic
  const taxSummary = React.useMemo(() => {
    const summary = {};
    // Pure calculation without side-effects
    const isInter = selectedParty && activeCompany && (
                    selectedParty.state?.toLowerCase().trim() !== activeCompany.state?.toLowerCase().trim() ||
                    (selectedParty.country && selectedParty.country !== 'India')
    );

    items.forEach(item => {
      const stockItem = stockItems.find(s => s.id === item.stock_item_id);
      if (!stockItem || !item.amount) return;

      const hsn = stockItem.hsn_sac || 'N/A';
      const rate = item.gst_rate || 0;
      const taxable = item.amount;
      
      if (!summary[hsn]) {
        summary[hsn] = { hsn, taxable: 0, cgst: 0, sgst: 0, igst: 0, rate };
      }

      summary[hsn].taxable += taxable;
      if (isInter) {
        summary[hsn].igst += (taxable * rate) / 100;
      } else {
        summary[hsn].cgst += (taxable * (rate / 2)) / 100;
        summary[hsn].sgst += (taxable * (rate / 2)) / 100;
      }
    });

    return Object.values(summary);
  }, [items, selectedParty, activeCompany, stockItems, isLUT]);

  // Dedicated Effect for taxation state sync based on party selection
  useEffect(() => {
    if (selectedParty && activeCompany) {
        const isInter = selectedParty.state?.toLowerCase().trim() !== activeCompany.state?.toLowerCase().trim() ||
                        (selectedParty.country && selectedParty.country !== 'India');
        if (isInter !== isInterstate) {
            setIsInterstate(isInter);
        }
        
        // Auto-set LUT for foreign companies if no tax accounts are present normally
        // But respect the state if already loaded from voucher
        if (selectedParty.country && selectedParty.country !== 'India' && !id) {
            setIsLUT(true);
        }
    }
  }, [selectedPartyId, activeCompany?.id, id]);

  const grandTotal = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0) + 
                     taxSummary.reduce((sum, t) => sum + t.cgst + t.sgst + t.igst, 0);

  const fetchBatches = async (itemId) => {
    if (!itemId) return;
    try {
        const res = await axios.get(`/api/stock-items/${itemId}/batches`);
        setBatchesMap(prev => ({ ...prev, [itemId]: res.data }));
    } catch (err) {
        console.error("Failed to load batches", err);
    }
  };

  useEffect(() => {
    // Fetch ledgers and groups
    const fetchMasters = async () => {
      try {
        const [ledgerRes, groupRes] = await Promise.all([
          axios.get('/api/ledgers'),
          axios.get('/api/groups')
        ]);
        setLedgers(ledgerRes.data);
        setGroups(groupRes.data);
      } catch (err) {
        message.error("Failed to load masters");
      }
    };

    fetchMasters();

    // Fetch stock items
    axios.get('/api/stock-items')
      .then(res => setStockItems(res.data))
      .catch(err => console.error("Failed to load stock items")); // Reduced noise

    // If ID exists, fetch existing invoice details
    if (id) {
       axios.get(`/api/vouchers/${id}`)
         .then(res => {
             const v = res.data;
             // Identify Ledgers
             let partyEntry = v.entries.find(e => e.group_name?.toLowerCase().includes('sundry debtors'));
             let salesEntry = v.entries.find(e => e.group_name?.toLowerCase().includes('sales accounts'));

             if (!partyEntry) partyEntry = v.entries.find(e => e.is_debit);
             if (!salesEntry) salesEntry = v.entries.find(e => !e.is_debit && e.ledger_id !== partyEntry?.ledger_id);
             
             const taxEntries = v.entries.filter(e => e.group_name?.toLowerCase().includes('duties & taxes'));

             const isExport = partyEntry?.country && partyEntry.country !== 'India';
             setIsInterstate(taxEntries.some(e => e.ledger_name?.toUpperCase().includes('IGST')) || !!isExport);
             setIsLUT(isExport && taxEntries.length === 0);
             
             // Initial form value setup
             form.setFieldsValue({
               invoice_number: v.voucher_number || "",
               date: dayjs(v.date),
               party_ledger_id: toSelectLedgerValue(partyEntry?.ledger_id),
               sales_ledger_id: toSelectLedgerValue(salesEntry?.ledger_id),
               place_of_supply: partyEntry?.state || partyEntry?.country || "",
               narration: v.narration || ""
             });

             setItems(v.inventory.map((i, idx) => ({
               key: idx,
               stock_item_id: i.stock_item_id,
               quantity: i.quantity,
               rate: i.rate,
               amount: i.amount,
               gst_rate: i.gst_rate
             })))
         })
         .catch(err => message.error("Failed to load invoice"));
    }
  }, [id, form]);

  // Sync effect to ensure Select labels appear once ledgers reach the frontend
  useEffect(() => {
    if (id && ledgers.length > 0) {
        // Use a small timeout to allow Antd internal state to settle after masters load
        const timer = setTimeout(() => {
            const pId = form.getFieldValue('party_ledger_id');
            const sId = form.getFieldValue('sales_ledger_id');
            if (pId || sId) {
                form.setFieldsValue({
                    party_ledger_id: toSelectLedgerValue(pId),
                    sales_ledger_id: toSelectLedgerValue(sId)
                });
            }
        }, 150);
        return () => clearTimeout(timer);
    }
  }, [ledgers.length, id, form]);

  const handleItemChange = (key, field, value) => {
    const newItems = [...items];
    const index = newItems.findIndex(i => i.key === key);
    newItems[index][field] = value;

    // Auto-fill rate based on stock item selection
    if (field === 'stock_item_id') {
      const selectedItem = stockItems.find(s => s.id === value);
      if (selectedItem) {
        newItems[index].gst_rate = selectedItem.gst_rate;
        newItems[index].rate = 1200; // Mock rate logic or pull from item
        fetchBatches(value);
      }
    }

    if (field === 'quantity' || field === 'rate' || field === 'unit_type') {
      const item = stockItems.find(s => s.id === newItems[index].stock_item_id);
      let qty = Number(newItems[index].quantity) || 0;
      
      // If sub-unit, divide by conversion factor for internal storage (though UI usually shows base amt)
      // For this UI, we assume 'amount' is what's displayed.
      newItems[index].amount = qty * (Number(newItems[index].rate) || 0);
    }

    // Auto add row
    if (index === newItems.length - 1 && field === 'rate' && value > 0) {
      newItems.push({ key: newItems.length, stock_item_id: null, batch_id: null, quantity: 1, unit_type: 'main', rate: 0, amount: 0, gst_rate: 0 });
    }

    setItems(newItems);
  };

  const openSubstituteSearch = async (salt) => {
    if (!salt) return;
    setCurrentSalt(salt);
    try {
        const res = await axios.get(`/api/stock-items/search-by-salt?salt=${salt}`);
        setSubstitutes(res.data);
        setSubModalVisible(true);
    } catch (err) {
        message.error("Failed to find substitutes");
    }
  };

  const removeRow = (key) => {
    if (items.length > 1) {
      setItems(items.filter(i => i.key !== key));
    }
  };

  // Calculations
  const subTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalTax = taxSummary.reduce((sum, t) => sum + t.cgst + t.sgst + t.igst, 0);
  const rawTotal = subTotal + totalTax;
  const roundedTotal = Math.round(rawTotal);
  const roundOff = (roundedTotal - rawTotal).toFixed(2);

  // Filtering Logic
  const allowedBuyerGroups = ['sundry debtors', 'cash-in-hand', 'bank accounts', 'branch / divisions'];
  const blockedGroups = ['salary expenses', 'duties & taxes', 'capital account', 'indirect expenses', 'indirect incomes', 'fixed assets'];

   const filteredParties = React.useMemo(() => {
    return ledgers.filter(l => {
      // Always include currently selected value to ensure label display even if group doesn't match
      if (l.id == selectedPartyId) return true;

      const group = groups.find(g => g.id === l.group_id);
      const groupName = group?.name?.toLowerCase() || "";
      
      const isAllowed = allowedBuyerGroups.some(ag => groupName.includes(ag));
      const isBlocked = blockedGroups.some(bg => groupName.includes(bg));
      return isAllowed && !isBlocked;
    });
   }, [ledgers, groups, selectedPartyId]);

  const selectedSalesLedgerId = Form.useWatch('sales_ledger_id', form);
  const filteredSalesLedgers = React.useMemo(() => {
    return ledgers.filter(l => {
        if (l.id == selectedSalesLedgerId) return true;
        const group = groups.find(g => g.id === l.group_id);
        const groupName = group?.name?.toLowerCase() || "";
        return groupName.includes('sales accounts');
    });
  }, [ledgers, groups, selectedSalesLedgerId]);

  const handleAddNewCustomer = () => {
    const debtorGroup = groups.find(g => g.name.toLowerCase().includes('sundry debtors'));
    if (debtorGroup) {
      setInitialGroupId(debtorGroup.id);
    }
    setLedgerDrawerVisible(true);
  };

  const handleLedgerSuccess = async () => {
    const res = await axios.get('/api/ledgers');
    setLedgers(res.data);
  };

  const handleSubmit = async (values) => {
    const validItems = items.filter(i => i.stock_item_id && i.amount > 0);
    if (validItems.length === 0) {
      message.error("Please add at least one valid item.");
      return;
    }

    const payload = {
      party_ledger_id: normalizeLedgerId(values.party_ledger_id),
      sales_ledger_id: normalizeLedgerId(values.sales_ledger_id),
      is_interstate: isInterstate,
      is_lut: isLUT,
      date: values.date.format('YYYY-MM-DD'),
      voucher_number: values.invoice_number || 'AUTO',
      place_of_supply: values.place_of_supply,
      narration: values.narration,
      items: validItems.map(i => {
        if (isPharma && !i.batch_id) {
            throw new Error(`Please select a batch for all items.`);
        }
        const selectedItem = stockItems.find(s => s.id === i.stock_item_id);
        let finalQty = parseFloat(i.quantity);
        if (i.unit_type === 'sub' && selectedItem?.conversion_factor > 1) {
            finalQty = finalQty / selectedItem.conversion_factor;
        }

        return {
            stock_item_id: i.stock_item_id,
            batch_id: i.batch_id,
            quantity: finalQty,
            rate: parseFloat(i.rate),
            amount: parseFloat(i.amount),
            gst_rate: parseFloat(i.gst_rate)
        };
      }),
      total_tax_amount: totalTax,
      round_off: parseFloat(roundOff),
      net_amount: roundedTotal
    };

    try {
      const url = id ? `/api/sales-invoice/${id}` : '/api/sales-invoice';
      const method = id ? 'put' : 'post';
      const res = await axios[method](url, payload);
      
      message.success(res.data.message);
      
      if (id) {
        navigate('/daybook');
      } else {
        form.resetFields();
        setItems([{ key: 0, stock_item_id: null, quantity: 1, rate: 0, amount: 0, gst_rate: 0 }]);
      }
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to save invoice.");
    }
  };

  const handlePrint = () => {
    const values = form.getFieldsValue();
    const subTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalTax = taxSummary.reduce((sum, t) => sum + t.cgst + t.sgst + t.igst, 0);
    const grandTotal = Math.round(subTotal + totalTax);
    const roundOff = (grandTotal - (subTotal + totalTax)).toFixed(2);

    const printWindow = window.open('', '_blank');
    const html = `
      <html>
        <head>
          <title>Tax Invoice - ${values.invoice_number}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #333; margin: 0; padding: 0; }
            .invoice-container { border: 1px solid #000; padding: 20px; min-height: 277mm; position: relative; }
            .invoice-header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
            .company-brand h1 { margin: 0; font-size: 22px; color: #008080; text-transform: uppercase; }
            .company-details { font-size: 10px; line-height: 1.2; }
            .document-title { text-align: right; }
            .document-title h2 { margin: 0; font-size: 18px; color: #333; }
            .address-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px; border-bottom: 1px solid #000; padding-bottom: 10px; }
            .address-box h3 { margin: 0 0 5px 0; font-size: 11px; text-decoration: underline; }
            .address-box p { margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            table th { background: #f0f0f0; border: 1px solid #000; padding: 6px; text-align: left; font-size: 10px; }
            table td { border: 1px solid #000; padding: 6px; vertical-align: top; }
            .text-right { text-align: right; }
            .tax-summary-section { margin-top: 10px; }
            .summary-table { width: 60%; float: left; }
            .totals-table { width: 35%; float: right; }
            .footer-section { clear: both; margin-top: 20px; border-top: 1px solid #000; padding-top: 10px; display: flex; justify-content: space-between; }
            .terms { width: 65%; font-size: 9px; line-height: 1.3; }
            .signature-box { width: 30%; text-align: center; border-top: 1px solid #000; margin-top: 40px; padding-top: 5px; }
            .words { font-style: italic; font-weight: bold; margin-bottom: 10px; display: block; }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="invoice-header">
              <div class="company-brand">
                <h1>${activeCompany?.name || 'WEEBAL ERP'}</h1>
                <div class="company-details">
                  <p>${activeCompany?.address || ''}, ${activeCompany?.city || ''}, ${activeCompany?.state || ''} - ${activeCompany?.pin_code || ''}</p>
                  <p><b>GSTIN:</b> ${activeCompany?.gstin || 'N/A'} | <b>Drug License:</b> ${activeCompany?.drug_license_no || 'N/A'}</p>
                  <p><b>Email:</b> ${activeCompany?.email || ''} | <b>Phone:</b> ${activeCompany?.telephone || ''}</p>
                </div>
              </div>
              <div class="document-title">
                <h2>TAX INVOICE</h2>
                <p><b>Invoice No:</b> ${values.invoice_number}</p>
                <p><b>Date:</b> ${values.date?.format('DD-MMM-YYYY')}</p>
                <p><b>Place of Supply:</b> ${values.place_of_supply || activeCompany?.state || 'Local'}</p>
                ${isLUT ? '<p><b style="color: blue;">[Export under LUT]</b></p>' : ''}
              </div>
            </div>

            <div class="address-section">
              <div class="address-box">
                <h3>Billed To (Party Details):</h3>
                <p><b>${selectedParty?.name || 'Cash Sales'}</b></p>
                <p>${selectedParty?.address || ''}</p>
                <p>${selectedParty?.city || ''}, ${selectedParty?.state || ''} - ${selectedParty?.pincode || ''}</p>
                <p><b>GSTIN:</b> ${selectedParty?.gstin || 'Unregistered'}</p>
                <p><b>DL No:</b> ${selectedParty?.drug_license_no || 'N/A'}</p>
              </div>
              <div class="address-box text-right">
                <h3>Consignee / Shipping Address:</h3>
                <p>${values.place_of_supply || 'Same as Billing'}</p>
                <p><b>Narration:</b> ${values.narration || 'N/A'}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 5%">Sr.</th>
                  <th style="width: 35%">Product Description</th>
                  <th style="width: 10%">HSN/SAC</th>
                  ${isPharma ? '<th style="width: 15%">Batch & Expiry</th>' : ''}
                  <th style="width: 10%" class="text-right">Qty</th>
                  <th style="width: 10%" class="text-right">Rate</th>
                  <th style="width: 15%" class="text-right">Taxable Amt</th>
                </tr>
              </thead>
              <tbody>
                ${items.filter(i => i.stock_item_id).map((item, idx) => {
                  const s = stockItems.find(si => si.id === item.stock_item_id);
                  const b = batchesMap[item.stock_item_id]?.find(bt => bt.id === item.batch_id);
                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><b>${s?.name || '-'}</b><br/><small>Salt: ${s?.salt_composition || 'N/A'}</small></td>
                      <td>${s?.hsn_sac || '-'}</td>
                      ${isPharma ? `<td>${b?.batch_no || '-'}<br/><small>Exp: ${b?.expiry_date || '-'}</small></td>` : ''}
                      <td class="text-right">${item.quantity} ${item.unit_type === 'sub' ? s?.sub_unit_name : s?.main_unit_name}</td>
                      <td class="text-right">${parseFloat(item.rate).toFixed(2)}</td>
                      <td class="text-right">${parseFloat(item.amount).toFixed(2)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div class="tax-summary-section">
              <table class="summary-table">
                <thead>
                  <tr>
                    <th>HSN</th>
                    <th>Taxable</th>
                    ${!isInterstate ? '<th>CGST</th><th>SGST</th>' : '<th>IGST</th>'}
                    <th>Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  ${taxSummary.map(t => `
                    <tr>
                      <td>${t.hsn}</td>
                      <td>${t.taxable.toFixed(2)}</td>
                      ${!isInterstate ? `<td>${t.cgst.toFixed(2)}</td><td>${t.sgst.toFixed(2)}</td>` : `<td>${t.igst.toFixed(2)}</td>`}
                      <td>${(t.cgst + t.sgst + t.igst).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <table class="totals-table">
                <tr><td>Taxable Total</td><td class="text-right">₹ ${subTotal.toFixed(2)}</td></tr>
                <tr><td>Add: Output GST</td><td class="text-right">₹ ${totalTax.toFixed(2)}</td></tr>
                ${parseFloat(roundOff) !== 0 ? `<tr><td>Round Off</td><td class="text-right">₹ ${roundOff}</td></tr>` : ''}
                <tr style="background: #f0f0f0; font-size: 13px;"><td><b>Grand Total</b></td><td class="text-right"><b>₹ ${grandTotal.toFixed(2)}</b></td></tr>
              </table>
            </div>

            <div style="clear: both; padding-top: 20px;">
              <span class="words">Amount in words: ${numberToWords(grandTotal)}</span>
            </div>

            <div class="footer-section">
              <div class="terms">
                <h3>Terms & Conditions:</h3>
                <p>1. Certified that the particulars given above are true and correct.<br/>
                2. Goods once sold will not be taken back or exchanged.<br/>
                3. Interest @18% p.a. will be charged if payment is not made within due date.<br/>
                4. Subject to local jurisdiction only.</p>
                <div style="margin-top: 10px; border: 1px dashed #ccc; padding: 5px; width: fit-content;">
                  <b>Bank Details:</b><br/>
                  A/c: 000012345678 | IFSC: HDFC0001234<br/>
                  Branch: ${activeCompany?.city || 'Main Branch'}
                </div>
              </div>
              <div class="signature-box">
                <p>For, <b>${activeCompany?.name || 'WEEBAL ERP'}</b></p>
                <p style="margin-top: 50px;">Authorized Signatory</p>
              </div>
            </div>
          </div>
          <script>window.print(); setTimeout(() => window.close(), 500);</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const columns = [
    {
      title: 'Name of Item',
      dataIndex: 'stock_item_id',
      width: '30%',
      render: (text, record) => {
        const selectedItem = stockItems.find(s => s.id === record.stock_item_id);
        return (
            <div>
                <Select
                    showSearch
                    optionFilterProp="children"
                    value={record.stock_item_id}
                    onChange={(val) => handleItemChange(record.key, 'stock_item_id', val)}
                    style={{ width: '100%' }}
                    placeholder="Select item..."
                >
                    {stockItems.map(s => (
                        <Option key={s.id} value={s.id}>
                            {s.name} (GST: {s.gst_rate}%)
                        </Option>
                    ))}
                </Select>
                {isPharma && selectedItem?.salt_composition && (
                    <Button 
                        type="link" 
                        size="small" 
                        style={{ fontSize: '11px', padding: 0 }}
                        onClick={() => openSubstituteSearch(selectedItem.salt_composition)}
                    >
                        Substitute (Salt: {selectedItem.salt_composition})
                    </Button>
                )}
            </div>
        );
      }
    },
    ...(isPharma ? [{
        title: 'Batch',
        dataIndex: 'batch_id',
        width: '20%',
        render: (text, record) => {
            const itemBatches = batchesMap[record.stock_item_id] || [];
            return (
                <Select
                    value={record.batch_id}
                    onChange={(val) => handleItemChange(record.key, 'batch_id', val)}
                    style={{ width: '100%' }}
                    placeholder="Select Batch"
                    status={record.stock_item_id && !record.batch_id ? 'error' : ''}
                >
                    {itemBatches.map(b => {
                        const isExpired = dayjs(b.expiry_date).isBefore(dayjs());
                        const isNearExpiry = dayjs(b.expiry_date).isBefore(dayjs().add(3, 'month'));
                        return (
                            <Option key={b.id} value={b.id} disabled={b.current_stock <= 0}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{b.batch_no}</span>
                                    <span>
                                        {isExpired ? <Tag color="error">Expired</Tag> : isNearExpiry ? <Tag color="warning">Near Exp</Tag> : null}
                                        <Badge 
                                            count={formatStock(b.current_stock, selectedItem?.main_unit_name, selectedItem?.sub_unit_name, selectedItem?.conversion_factor)} 
                                            style={{ backgroundColor: b.current_stock <= 0 ? '#f5222d' : '#52c41a' }} 
                                        />
                                    </span>
                                </div>
                            </Option>
                        );
                    })}
                </Select>
            );
        }
    }] : []),
    {
        title: 'Unit',
        dataIndex: 'unit_type',
        width: '12%',
        render: (text, record) => {
            const item = stockItems.find(s => s.id === record.stock_item_id);
            if (!item || !item.sub_unit_name) return <Text type="secondary">Primary</Text>;
            return (
                <Select 
                    value={record.unit_type} 
                    onChange={(val) => handleItemChange(record.key, 'unit_type', val)}
                    style={{ width: '100%' }}
                >
                    <Option value="main">{item.main_unit_name || 'Main'}</Option>
                    <Option value="sub">{item.sub_unit_name || 'Sub'}</Option>
                </Select>
            );
        }
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      width: '10%',
      render: (text, record) => (
         <Input 
          type="number" 
          value={record.quantity} 
          onChange={(e) => handleItemChange(record.key, 'quantity', e.target.value)}
        />
      )
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      width: '15%',
      render: (text, record) => (
         <Input 
          type="number" 
          value={record.rate} 
          onChange={(e) => handleItemChange(record.key, 'rate', e.target.value)}
        />
      )
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      width: '15%',
      render: (text, record) => <Text>{record.amount.toFixed(2)}</Text>
    },
    {
      title: '',
      key: 'action',
      render: (_, record) => <Button type="link" danger onClick={() => removeRow(record.key)}>X</Button>
    }
  ];

  return (
    <div style={{ height: '100%', padding: '20px', backgroundColor: '#fdfadd', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', backgroundColor: '#87d068', color: 'white', padding: '10px', borderRadius: '4px' }}>
        <Title level={4} style={{ color: 'white', margin: 0 }}>Sales {id ? 'Alteration' : 'Invoice'}</Title>
        <Space>
            {id && <Button type="default" onClick={() => handlePrint()}>[P] Print Invoice</Button>}
            <Button danger size="small" onClick={() => navigate('/')}>[Esc] Quit</Button>
        </Space>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#fff', padding: '20px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ date: dayjs() }}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="invoice_number" label="Invoice No.">
                <Input placeholder="Auto Generated" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Party A/c Name" required>
                <Form.Item
                  name="party_ledger_id"
                  noStyle
                  rules={[
                    { required: true, message: 'Please select Party' },
                    {
                      validator: (_, value) => {
                        if (!value) return Promise.resolve();
                        const isValid = filteredParties.some(p => String(p.id) === String(value));
                        if (!isValid) return Promise.reject(new Error('Selected ledger is not a valid Buyer account'));
                        return Promise.resolve();
                      }
                    }
                  ]}
                >
                  <Select 
                    showSearch 
                    optionFilterProp="children" 
                    placeholder="Select Customer/Party" 
                    onChange={() => form.validateFields(['party_ledger_id'])}
                    notFoundContent={
                      <div style={{ padding: '8px', textAlign: 'center' }}>
                        <Text type="secondary" style={{ display: 'block', marginBottom: '8px' }}>No customer found</Text>
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddNewCustomer} style={{ backgroundColor: '#008080' }}>
                          Add New Customer
                        </Button>
                      </div>
                    }
                    dropdownRender={(menu) => (
                      <>
                        {menu}
                        <Divider style={{ margin: '8px 0' }} />
                        <Space style={{ padding: '0 8px 4px' }}>
                          <Button type="link" size="small" icon={<PlusOutlined />} onClick={handleAddNewCustomer}>
                            Add New Customer
                          </Button>
                        </Space>
                      </>
                    )}
                  >
                    {filteredParties.map(l => <Option key={l.id} value={String(l.id)}>{l.name}</Option>)}
                  </Select>
                </Form.Item>
                {selectedParty && (selectedParty.address || selectedParty.gstin || (selectedParty.country && selectedParty.country !== 'India')) && (
                  <div style={{ marginTop: '5px', padding: '10px', backgroundColor: '#f9f9f9', border: '1px dotted #008080', borderRadius: '4px', fontSize: '12px' }}>
                    <Row gutter={8}>
                      <Col span={24}>
                        <Text type="secondary">Address:</Text> {selectedParty.address || 'N/A'}, {selectedParty.city || ''}
                      </Col>
                      <Col span={12}>
                        {selectedParty.country && selectedParty.country !== 'India' ? (
                          <Tag color="purple">Export: {selectedParty.country}</Tag>
                        ) : (
                          <Tag color="blue">Local: {selectedParty.state || activeCompany?.state}</Tag>
                        )}
                      </Col>
                      <Col span={12} style={{ textAlign: 'right' }}>
                        {selectedParty.gstin ? (
                          <div><Text type="secondary">GSTIN:</Text> <Text strong style={{ color: '#1890ff' }}>{selectedParty.gstin}</Text></div>
                        ) : selectedParty.iec_code ? (
                          <div><Tag color="gold">IEC: {selectedParty.iec_code}</Tag></div>
                        ) : null}
                      </Col>
                    </Row>
                  </div>
                )}
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item 
                name="sales_ledger_id" 
                label="Sales Ledger" 
                rules={[{ required: true, message: 'Please select Sales Ledger' }]}
              >
                <Select 
                  showSearch 
                  optionFilterProp="children" 
                  placeholder="Select Sales Account"
                >
                  {filteredSalesLedgers.map(l => <Option key={l.id} value={String(l.id)}>{l.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="place_of_supply" label="Place of Supply">
                <Input placeholder={selectedParty?.country !== 'India' ? "Country / Port" : "State"} />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="narration" label="Narration / Remarks">
                <Input placeholder="Invoice details..." />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginBottom: '15px' }}>
            <Text strong>Taxation Type: </Text>
            <Switch 
               checkedChildren="Interstate (IGST)" 
               unCheckedChildren="Intrastate (CGST/SGST)" 
               checked={isInterstate} 
               onChange={setIsInterstate} 
            />
            <span style={{ marginLeft: '20px' }}>
                <Text strong>Export Type: </Text>
                <Switch 
                   checkedChildren="Export under LUT (Zero GST)" 
                   unCheckedChildren="Normal Export" 
                   checked={isLUT} 
                   onChange={setIsLUT}
                   disabled={!isInterstate}
                />
            </span>
          </div>

          <Table 
            dataSource={items} 
            columns={columns} 
            pagination={false} 
            size="small"
            bordered
            scroll={{ y: 'calc(100vh - 550px)' }}
            summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={isPharma ? 5 : 4} style={{ textAlign: 'right' }}>
                      <Text strong>Sub Total</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>
                      <Text strong>₹ {items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0).toFixed(2)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
          />

            {taxSummary.length > 0 && (
              <div style={{ marginTop: '20px', border: '1px solid #d9d9d9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ padding: '8px', backgroundColor: '#fafafa', borderBottom: '1px solid #d9d9d9' }}>
                  <Text strong>Tax Summary</Text>
                </div>
                <Table 
                  size="small"
                  pagination={false}
                  dataSource={taxSummary}
                  rowKey="hsn"
                  columns={[
                    { title: 'HSN/SAC', dataIndex: 'hsn', key: 'hsn' },
                    { title: 'Taxable Value', dataIndex: 'taxable', render: (val) => val.toFixed(2) },
                    { title: 'CGST', dataIndex: 'cgst', render: (val) => val > 0 ? val.toFixed(2) : '-' },
                    { title: 'SGST', dataIndex: 'sgst', render: (val) => val > 0 ? val.toFixed(2) : '-' },
                    { title: 'IGST', dataIndex: 'igst', render: (val) => val > 0 ? val.toFixed(2) : '-' },
                    { title: 'Total Tax', render: (record) => (record.cgst + record.sgst + record.igst).toFixed(2) }
                  ]}
                />
              </div>
            )}

            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #d9d9d9', borderRadius: '4px', textAlign: 'right' }}>
               <div style={{ marginBottom: '5px' }}>
                  <Text type="secondary">Sub Total: ₹ {subTotal.toFixed(2)}</Text>
               </div>
               <div style={{ marginBottom: '5px' }}>
                  <Text type="secondary">Total Tax: ₹ {totalTax.toFixed(2)}</Text>
               </div>
               {parseFloat(roundOff) !== 0 && (
                 <div style={{ marginBottom: '5px' }}>
                    <Text type="secondary">Rounding: ₹ {roundOff}</Text>
                 </div>
               )}
               <Title level={4} style={{ margin: 0 }}>Grand Total: <span style={{ color: '#008080' }}>₹ {roundedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></Title>
               <Text type="secondary" style={{ fontStyle: 'italic' }}>{numberToWords(roundedTotal)}</Text>
            </div>

            <Form.Item style={{ marginTop: '20px' }}>
              <Button type="primary" htmlType="submit" style={{ width: '100%', height: '40px', fontSize: '16px' }}>
                {id ? 'Update Invoice' : 'Save Invoice'}
              </Button>
            </Form.Item>
        </Form>
      </div>

      <Modal
        title={<span>Substitutes for <Text strong>{currentSalt}</Text></span>}
        open={subModalVisible}
        onCancel={() => setSubModalVisible(false)}
        footer={null}
        width={600}
      >
        <Table 
            dataSource={substitutes} 
            pagination={false}
            size="small"
            columns={[
                { title: 'Item Name', dataIndex: 'name' },
                { title: 'Rack', dataIndex: 'rack' },
                { 
                  title: 'Action', 
                  render: (_, record) => (
                    <Button type="primary" size="small" onClick={() => {
                        const newKey = items.length;
                        setItems([...items, { key: newKey, stock_item_id: record.id, batch_id: null, quantity: 1, unit_type: 'main', rate: 0, amount: 0, gst_rate: 0 }]);
                        fetchBatches(record.id);
                        setSubModalVisible(false);
                        message.info(`Added ${record.name} to invoice`);
                    }}>Select</Button>
                  )
                }
            ]}
        />
      </Modal>

      <LedgerDrawer
        visible={ledgerDrawerVisible}
        onClose={() => setLedgerDrawerVisible(false)}
        onSuccess={handleLedgerSuccess}
        groups={groups}
        initialGroupId={initialGroupId}
      />
    </div>
  );
};

export default SalesInvoice;
