import React, { useState, useEffect } from 'react';
import { Form as AntForm, Input as AntInput, Select as AntSelect, DatePicker as AntDatePicker, Button as AntButton, Table as AntTable, Typography as AntTypography, message as antMessage, Row as AntRow, Col as AntCol, Divider as AntDivider, Switch as AntSwitch, Upload as AntUpload, Spin as AntSpin } from 'antd';
import { RobotOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title, Text } = AntTypography;
const { Option } = AntSelect;

const PurchaseInvoice = () => {
  const [form] = AntForm.useForm();
  const [ledgers, setLedgers] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [items, setItems] = useState([
    { key: 0, stock_item_id: null, quantity: 1, rate: 0, amount: 0, gst_rate: 0 }
  ]);
  const [isInterstate, setIsInterstate] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    // Fetch ledgers for Party (Suppliers)
    axios.get('http://localhost:8000/api/ledgers')
      .then(res => setLedgers(res.data))
      .catch(err => antMessage.error("Failed to load ledgers"));

    // Fetch stock items
    axios.get('http://localhost:8000/api/stock-items')
      .then(res => setStockItems(res.data))
      .catch(err => antMessage.error("Failed to load stock items"));

    if (id) {
       setLoading(true);
       axios.get(`http://localhost:8000/api/vouchers/${id}`)
         .then(res => {
            const v = res.data;
            const partyEntry = v.entries.find(e => !e.is_debit); // Credit for Purchase
            
            form.setFieldsValue({
              invoice_number: v.voucher_number,
              date: dayjs(v.date),
              party_ledger_id: partyEntry?.ledger_id,
            });

            setItems(v.inventory.map((i, idx) => ({
              key: idx,
              stock_item_id: i.stock_item_id,
              quantity: i.quantity,
              rate: i.rate,
              amount: i.amount,
              gst_rate: i.gst_rate || 18
            })));
         })
         .finally(() => setLoading(false));
    }
  }, [id, form]);

  const handleAIUpload = async (file) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('http://localhost:8000/api/ai/extract-invoice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const data = res.data;
      
      // 1. Map Party Name to Ledger ID
      const matchedLedger = ledgers.find(l => 
        l.name.toLowerCase().includes(data.party_name.toLowerCase()) || 
        data.party_name.toLowerCase().includes(l.name.toLowerCase())
      );

      form.setFieldsValue({
        invoice_number: data.invoice_number,
        date: data.date ? dayjs(data.date) : dayjs(),
        party_ledger_id: matchedLedger?.id
      });

      // 2. Map Items
      if (data.line_items && data.line_items.length > 0) {
        const newItems = data.line_items.map((item, idx) => {
          const matchedStockItem = stockItems.find(s => 
            s.name.toLowerCase().includes(item.item_name.toLowerCase()) || 
            item.item_name.toLowerCase().includes(s.name.toLowerCase())
          );

          return {
            key: idx,
            stock_item_id: matchedStockItem?.id,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.total_amount || (item.quantity * item.rate),
            gst_rate: item.tax_percentage || 18
          };
        });
        setItems(newItems);
      }

      antMessage.success("AI extraction successful!");
    } catch (err) {
      antMessage.error(err.response?.data?.detail || "AI Extraction failed.");
    } finally {
      setLoading(false);
    }
    return false; // Prevent internal antd upload
  };

  const handleItemChange = (key, field, value) => {
    const newItems = [...items];
    const index = newItems.findIndex(i => i.key === key);
    newItems[index][field] = value;

    if (field === 'stock_item_id') {
      const selectedItem = stockItems.find(s => s.id === value);
      if (selectedItem) newItems[index].gst_rate = selectedItem.gst_rate;
    }

    if (['quantity', 'rate', 'stock_item_id'].includes(field)) {
      newItems[index].amount = (Number(newItems[index].quantity) || 0) * (Number(newItems[index].rate) || 0);
    }

    if (index === newItems.length - 1 && field === 'rate' && value > 0) {
      newItems.push({ key: newItems.length, stock_item_id: null, quantity: 1, rate: 0, amount: 0, gst_rate: 0 });
    }
    setItems(newItems);
  };

  const removeRow = (key) => {
    if (items.length > 1) setItems(items.filter(i => i.key !== key));
  };

  // Calculations
  const grossTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  let totalTax = items.reduce((sum, item) => sum + (Number(item.amount) || 0) * ((item.gst_rate || 0) / 100), 0);
  const netTotal = grossTotal + totalTax;

  const handleSubmit = async (values) => {
    const purchaseLedger = ledgers.find(l => l.name.toLowerCase().includes('purchase'));
    if (!purchaseLedger) {
       antMessage.error("Could not find a 'Purchase' ledger.");
       return;
    }

    const payload = {
      party_ledger_id: values.party_ledger_id,
      purchase_ledger_id: purchaseLedger.id, // Using generic mapping for demo
      is_interstate: isInterstate,
      date: values.date.format('YYYY-MM-DD'),
      voucher_number: values.invoice_number,
      items: items.filter(i => i.stock_item_id && i.amount > 0).map(i => ({
        stock_item_id: i.stock_item_id,
        quantity: parseFloat(i.quantity),
        rate: parseFloat(i.rate),
        amount: parseFloat(i.amount),
        gst_rate: parseFloat(i.gst_rate)
      })),
      total_tax_amount: totalTax,
      net_amount: netTotal
    };

    try {
      // For now using sales API logic or dedicated purchase API if built
      // Assuming we need a POST /api/purchase-invoice or using vouchers
      // Since Phase 14 focus is AI, we'll try to use a generic voucher post for Purchase Type
      const res = await axios.post('http://localhost:8000/api/vouchers', {
        voucher_type_id: 4, // Purchase usually 4 in Tally
        voucher_number: values.invoice_number,
        date: values.date.format('YYYY-MM-DD'),
        narration: `Purchase Invoice from AI Extraction`,
        entries: [
          { ledger_id: values.party_ledger_id, amount: netTotal, is_debit: false }, // Credit Supplier
          { ledger_id: purchaseLedger.id, amount: grossTotal, is_debit: true }, // Debit Purchase
          // Simplified Tax entry
          { ledger_id: 1, amount: totalTax, is_debit: true } // Debit Tax (Assuming ID 1)
        ]
      });
      antMessage.success("Purchase Invoice saved!");
      navigate('/daybook');
    } catch (err) {
      antMessage.error("Failed to save purchase.");
    }
  };

  const columns = [
    { title: 'Name of Item', dataIndex: 'stock_item_id', width: '35%', render: (val, record) => (
      <AntSelect showSearch value={val} onChange={(v) => handleItemChange(record.key, 'stock_item_id', v)} style={{ width: '100%' }}>
        {stockItems.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
      </AntSelect>
    )},
    { title: 'Qty', dataIndex: 'quantity', width: '15%', render: (val, record) => (
      <AntInput type="number" value={val} onChange={(e) => handleItemChange(record.key, 'quantity', e.target.value)} />
    )},
    { title: 'Rate', dataIndex: 'rate', width: '20%', render: (val, record) => (
      <AntInput type="number" value={val} onChange={(e) => handleItemChange(record.key, 'rate', e.target.value)} />
    )},
    { title: 'Amount', dataIndex: 'amount', width: '20%', render: (val) => <Text>{val.toFixed(2)}</Text> },
    { title: '', key: 'action', render: (_, record) => <AntButton type="link" danger onClick={() => removeRow(record.key)}>X</AntButton> }
  ];

  return (
    <AntSpin spinning={loading} tip="Processing with Gemini AI...">
      <div style={{ padding: '20px', maxWidth: '1000px', margin: 'auto', backgroundColor: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', backgroundColor: '#001529', color: 'white', padding: '10px' }}>
          <Title level={4} style={{ color: 'white', margin: 0 }}>Purchase Invoice (AI Enhanced)</Title>
          <AntUpload beforeUpload={handleAIUpload} showUploadList={false}>
            <AntButton icon={<RobotOutlined />} type="primary" style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}>Auto-Fill with AI</AntButton>
          </AntUpload>
        </div>

        <AntForm form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ date: dayjs() }}>
          <AntRow gutter={16}>
            <AntCol span={6}><AntForm.Item name="invoice_number" label="Supplier Invoice No."><AntInput /></AntForm.Item></AntCol>
            <AntCol span={6}><AntForm.Item name="date" label="Date"><AntDatePicker style={{ width: '100%' }} /></AntForm.Item></AntCol>
            <AntCol span={12}><AntForm.Item name="party_ledger_id" label="Supplier Name"><AntSelect showSearch>{ledgers.map(l => <Option key={l.id} value={l.id}>{l.name}</Option>)}</AntSelect></AntForm.Item></AntCol>
          </AntRow>

          <AntTable dataSource={items} columns={columns} pagination={false} size="small" bordered />

          <AntDivider />
          <AntRow justify="end">
            <AntCol span={8}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Gross Total:</Text><Text>{grossTotal.toFixed(2)}</Text></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>GST:</Text><Text>{totalTax.toFixed(2)}</Text></div>
              <AntDivider style={{ margin: '10px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text strong>Net Total:</Text><Text strong>{netTotal.toFixed(2)}</Text></div>
            </AntCol>
          </AntRow>
          <AntButton type="primary" htmlType="submit" style={{ width: '100%', marginTop: '20px', height: '40px' }}>Save Purchase Invoice</AntButton>
        </AntForm>
      </div>
    </AntSpin>
  );
};

export default PurchaseInvoice;
