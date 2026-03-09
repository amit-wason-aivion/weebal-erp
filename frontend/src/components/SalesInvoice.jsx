import React, { useState, useEffect } from 'react';
import { Form, Input, Select, DatePicker, Button, Table, Typography, message, Row, Col, Divider, Switch } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '../api/axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const SalesInvoice = () => {
  const [form] = Form.useForm();
  const [ledgers, setLedgers] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [items, setItems] = useState([
    { key: 0, stock_item_id: null, quantity: 1, rate: 0, amount: 0, gst_rate: 0 }
  ]);
  const [isInterstate, setIsInterstate] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    // Fetch ledgers for Party
    axios.get('/api/ledgers')
      .then(res => setLedgers(res.data))
      .catch(err => message.error("Failed to load ledgers"));

    // Fetch stock items
    axios.get('/api/stock-items')
      .then(res => setStockItems(res.data))
      .catch(err => message.error("Failed to load stock items"));

    // If ID exists, fetch existing invoice details
    if (id) {
       axios.get(`/api/vouchers/${id}`)
         .then(res => {
            const v = res.data;
            setIsInterstate(v.inventory.some(i => i.is_interstate) || false); // Simplify for now or check tax ledgers
            // In a real app we'd explicitly store is_interstate in the voucher or metadata
            // For now, we'll try to find the party ledger and place of supply
            const partyEntry = v.entries.find(e => e.is_debit);
            
            form.setFieldsValue({
              invoice_number: v.voucher_number,
              date: dayjs(v.date),
              party_ledger_id: partyEntry?.ledger_id,
              place_of_supply: v.narration.replace("Sales Invoice to ", "")
            });

            setItems(v.inventory.map((i, idx) => ({
              key: idx,
              stock_item_id: i.stock_item_id,
              quantity: i.quantity,
              rate: i.rate,
              amount: i.amount,
              gst_rate: i.gst_rate || 18 // Fallback
            })));
         })
         .catch(err => message.error("Failed to load sales invoice details"));
    }
  }, [id, form]);

  const handleItemChange = (key, field, value) => {
    const newItems = [...items];
    const index = newItems.findIndex(i => i.key === key);
    newItems[index][field] = value;

    // Auto-fill rate based on stock item selection
    if (field === 'stock_item_id') {
      const selectedItem = stockItems.find(s => s.id === value);
      if (selectedItem) {
        newItems[index].gst_rate = selectedItem.gst_rate;
        // Mock a default rate if none exists
        newItems[index].rate = 1000; 
      }
    }

    // Auto calculate amount
    if (['quantity', 'rate', 'stock_item_id'].includes(field)) {
      newItems[index].amount = (Number(newItems[index].quantity) || 0) * (Number(newItems[index].rate) || 0);
    }

    // Auto add row
    if (index === newItems.length - 1 && field === 'rate' && value > 0) {
      newItems.push({ key: newItems.length, stock_item_id: null, quantity: 1, rate: 0, amount: 0, gst_rate: 0 });
    }

    setItems(newItems);
  };

  const removeRow = (key) => {
    if (items.length > 1) {
      setItems(items.filter(i => i.key !== key));
    }
  };

  // Calculations
  const grossTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;

  items.forEach(item => {
    const taxAmount = (Number(item.amount) || 0) * ((item.gst_rate || 0) / 100);
    if (isInterstate) {
      totalIGST += taxAmount;
    } else {
      totalCGST += taxAmount / 2;
      totalSGST += taxAmount / 2;
    }
  });

  const netTotal = grossTotal + totalCGST + totalSGST + totalIGST;

  const handleSubmit = async (values) => {
    const validItems = items.filter(i => i.stock_item_id && i.amount > 0);
    if (validItems.length === 0) {
      message.error("Please add at least one valid item.");
      return;
    }

    // Attempt to find a Sales Ledger ID, assuming it usually exists
    const salesLedger = ledgers.find(l => l.name.toLowerCase().includes('sales'));
    if (!salesLedger) {
       message.error("Could not find a 'Sales' ledger. Please ensure one exists in the masters.");
       return;
    }

    const payload = {
      party_ledger_id: values.party_ledger_id,
      sales_ledger_id: salesLedger.id,
      is_interstate: isInterstate,
      date: values.date.format('YYYY-MM-DD'),
      voucher_number: values.invoice_number || 'AUTO',
      place_of_supply: values.place_of_supply,
      items: validItems.map(i => ({
        stock_item_id: i.stock_item_id,
        quantity: parseFloat(i.quantity),
        rate: parseFloat(i.rate),
        amount: parseFloat(i.amount),
        gst_rate: parseFloat(i.gst_rate)
      })),
      total_tax_amount: totalCGST + totalSGST + totalIGST,
      net_amount: netTotal
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

  const columns = [
    {
      title: 'Name of Item',
      dataIndex: 'stock_item_id',
      width: '35%',
      render: (text, record) => (
        <Select
          showSearch
          optionFilterProp="children"
          value={record.stock_item_id}
          onChange={(val) => handleItemChange(record.key, 'stock_item_id', val)}
          style={{ width: '100%' }}
          placeholder="Select item..."
        >
          {stockItems.map(s => <Option key={s.id} value={s.id}>{s.name} (GST: {s.gst_rate}%)</Option>)}
        </Select>
      )
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      width: '15%',
      render: (text, record) => (
         <Input 
          type="number" 
          value={record.quantity} 
          onChange={(e) => handleItemChange(record.key, 'quantity', e.target.value)}
          onPressEnter={(e) => {
            const form = e.target.form;
             const index = Array.prototype.indexOf.call(form, e.target);
             form.elements[index + 1]?.focus();
             e.preventDefault();
          }}
        />
      )
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      width: '20%',
      render: (text, record) => (
         <Input 
          type="number" 
          value={record.rate} 
          onChange={(e) => handleItemChange(record.key, 'rate', e.target.value)}
          onPressEnter={(e) => {
            const form = e.target.form;
             const index = Array.prototype.indexOf.call(form, e.target);
             form.elements[index + 1]?.focus();
             e.preventDefault();
          }}
        />
      )
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      width: '20%',
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
        <Button danger size="small" onClick={() => navigate('/')}>[Esc] Quit</Button>
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
              <Form.Item name="party_ledger_id" label="Party A/c Name" rules={[{ required: true, message: 'Please select Party' }]}>
                <Select showSearch optionFilterProp="children" placeholder="Select Customer/Party">
                  {ledgers.map(l => <Option key={l.id} value={l.id}>{l.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="place_of_supply" label="Place of Supply">
                <Input placeholder="State" />
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
          </div>

          <Table 
            dataSource={items} 
            columns={columns} 
            pagination={false} 
            size="small"
            bordered
            scroll={{ y: 'calc(100vh - 550px)' }}
          />

          <Divider />
          
          {/* Footer Summary */}
          <Row justify="end">
            <Col span={8}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <Text>Total Gross Amount:</Text>
                <Text>{grossTotal.toFixed(2)}</Text>
              </div>
              {!isInterstate && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <Text>Add: CGST:</Text>
                    <Text>{totalCGST.toFixed(2)}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <Text>Add: SGST:</Text>
                    <Text>{totalSGST.toFixed(2)}</Text>
                  </div>
                </>
              )}
              {isInterstate && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <Text>Add: IGST:</Text>
                  <Text>{totalIGST.toFixed(2)}</Text>
                </div>
              )}
              <Divider style={{ margin: '10px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <Text strong>Net Invoice Value:</Text>
                <Text strong>{netTotal.toFixed(2)}</Text>
              </div>
            </Col>
          </Row>

          <Form.Item style={{ marginTop: '20px' }}>
            <Button type="primary" htmlType="submit" style={{ width: '100%', height: '40px', fontSize: '16px' }}>
              {id ? 'Update Invoice' : 'Save Invoice'}
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};

export default SalesInvoice;
