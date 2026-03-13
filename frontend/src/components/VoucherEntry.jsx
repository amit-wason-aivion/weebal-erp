import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Select, DatePicker, Button, Table, Typography, message, Row, Col } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '../api/axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const VOUCHER_TYPE_NAMES = {
  '1': 'Journal',
  '2': 'Sales',
  '3': 'Purchase',
  '4': 'Contra',
  '5': 'Payment',
  '6': 'Receipt'
};

const VoucherEntry = () => {
  const [form] = Form.useForm();
  const [ledgers, setLedgers] = useState([]);
  const [entries, setEntries] = useState([
    { key: 0, ledger_id: null, is_debit: true, amount: null, instrument_no: '', instrument_date: null },
    { key: 1, ledger_id: null, is_debit: false, amount: null, instrument_no: '', instrument_date: null }
  ]);
  const [voucherType, setVoucherType] = useState('1'); 
  const navigate = useNavigate();
  const { id } = useParams();
  
  // Refs for focusing
  const inputRefs = useRef({});

  // Tally hotkey listeners
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Always prevent browser default for F4-F9
      if (['F4', 'F5', 'F6', 'F7', 'F8', 'F9'].includes(e.key)) {
        e.preventDefault();
      }

      // Handle specific keys
      if (e.key === 'F4') setVoucherType('4'); // Contra
      if (e.key === 'F5') setVoucherType('5'); // Payment
      if (e.key === 'F6') setVoucherType('6'); // Receipt
      if (e.key === 'F7') setVoucherType('1'); // Journal
      if (e.key === 'F8') setVoucherType('2'); // Sales
      if (e.key === 'F9') setVoucherType('3'); // Purchase
      
      if (e.key === 'Escape') {
          // Only navigate if NOT in an input (standard Tally behavior)
          if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
              navigate('/');
          }
      }

      // Handle Ctrl+A for Save
      if (e.ctrlKey && e.key.toLowerCase() === 'a') {
          e.preventDefault();
          form.submit();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [form, navigate]);

  useEffect(() => {
    // Fetch ledgers
    axios.get('/api/ledgers')
      .then(res => setLedgers(res.data))
      .catch(err => message.error("Failed to load ledgers"));

    if (id) {
      axios.get(`/api/vouchers/${id}`)
        .then(res => {
          const v = res.data;
          // Ensure voucherType is a string for state matching
          setVoucherType(v.voucher_type_id.toString());
          form.setFieldsValue({
            date: dayjs(v.date),
            voucher_number: v.voucher_number,
            narration: v.narration
          });
          setEntries(v.entries.map((e, idx) => ({
            key: idx,
            ...e
          })));
        })
        .catch(err => message.error("Failed to load voucher details"));
    }
  }, [id, form]);

  const totalDr = entries.filter(e => e.is_debit).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalCr = entries.filter(e => !e.is_debit).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const isValid = totalDr > 0 && totalDr === totalCr;

  const handleEntryChange = (key, field, value) => {
    const newEntries = [...entries];
    const index = newEntries.findIndex(e => e.key === key);
    newEntries[index][field] = value;
    setEntries(newEntries);
  };

  const addRowAndBalance = (currentIndex) => {
    const diff = Math.abs(totalDr - totalCr);
    const nextIsDebit = totalDr < totalCr;
    
    // Create new row
    const newKey = Math.max(...entries.map(e => e.key)) + 1;
    const newEntries = [...entries];
    newEntries.push({ 
        key: newKey, 
        ledger_id: null, 
        is_debit: nextIsDebit, 
        amount: diff > 0 ? diff : null,
        instrument_no: '',
        instrument_date: null
    });
    setEntries(newEntries);

    // Focus next row's Dr/Cr dropdown after React renders it
    setTimeout(() => {
        const nextId = `type-${newKey}`;
        const el = document.getElementById(nextId);
        if (el) el.focus();
    }, 50);
  };

  const removeEntry = (key) => {
    if (entries.length <= 1) return; 
    setEntries(entries.filter(e => e.key !== key));
  };

  const handleSubmit = async (values) => {
    if (!isValid) {
      message.error("Total Debits must equal Total Credits!");
      return;
    }

    const validEntries = entries.filter(e => e.ledger_id && e.amount > 0);

    const payload = {
      voucher_type_id: parseInt(voucherType),
      voucher_number: values.voucher_number || 'AUTO',
      date: values.date.format('YYYY-MM-DD'),
      narration: values.narration,
      entries: validEntries.map(e => ({
        ledger_id: e.ledger_id,
        amount: parseFloat(e.amount),
        is_debit: e.is_debit,
        instrument_no: e.instrument_no,
        instrument_date: e.instrument_date
      }))
    };

    try {
      const url = id ? `/api/vouchers/${id}` : '/api/vouchers';
      const method = id ? 'put' : 'post';
      const res = await axios[method](url, payload);
      
      message.success(res.data.message);
      
      if (id) {
        navigate('/daybook');
      } else {
        form.resetFields();
        setEntries([
          { key: 0, ledger_id: null, is_debit: true, amount: null, instrument_no: '', instrument_date: null },
          { key: 1, ledger_id: null, is_debit: false, amount: null, instrument_no: '', instrument_date: null }
        ]);
      }
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to save voucher");
    }
  };

  const columns = [
    {
      title: 'Dr/Cr',
      dataIndex: 'is_debit',
      width: '10%',
      render: (is_debit, record) => (
        <Select 
          id={`type-${record.key}`}
          value={is_debit ? 'Dr' : 'Cr'} 
          onChange={(val) => handleEntryChange(record.key, 'is_debit', val === 'Dr')}
          style={{ width: '100%' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
                const particularEl = document.getElementById(`particular-${record.key}`);
                if (particularEl) particularEl.focus();
            }
          }}
        >
          <Option value="Dr">Dr</Option>
          <Option value="Cr">Cr</Option>
        </Select>
      )
    },
    {
      title: 'Particulars (Ledger)',
      dataIndex: 'ledger_id',
      width: '40%',
      render: (text, record) => {
        const selectedLedger = ledgers.find(l => l.id === record.ledger_id);
        const balanceText = selectedLedger 
            ? `Current Bal: ₹ ${Math.abs(selectedLedger.opening_balance).toLocaleString()} ${selectedLedger.is_debit_balance ? 'Dr' : 'Cr'}`
            : '';
        const detailText = selectedLedger && (selectedLedger.city || selectedLedger.gstin)
            ? `${selectedLedger.city ? selectedLedger.city : ''}${selectedLedger.city && selectedLedger.gstin ? ' | ' : ''}${selectedLedger.gstin ? 'GST: ' + selectedLedger.gstin : ''}`
            : '';

        return (
            <div>
                <Select
                    id={`particular-${record.key}`}
                    showSearch
                    optionFilterProp="children"
                    value={record.ledger_id}
                    onChange={(val) => handleEntryChange(record.key, 'ledger_id', val)}
                    style={{ width: '100%' }}
                    placeholder="Select or type ledger..."
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && record.ledger_id) {
                            const amountId = record.is_debit ? `dr-${record.key}` : `cr-${record.key}`;
                            const el = document.getElementById(amountId);
                            if (el) el.focus();
                        }
                    }}
                >
                    {ledgers.map(l => <Option key={l.id} value={l.id}>{l.name}</Option>)}
                </Select>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px', fontStyle: 'italic', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{balanceText}</span>
                    <span style={{ color: '#008080' }}>{detailText}</span>
                </div>
            </div>
        );
      }
    },
    {
      "title": 'Inst. No',
      "dataIndex": 'instrument_no',
      "width": '10%',
      "render": (text, record) => {
        const selectedLedger = ledgers.find(l => l.id === record.ledger_id);
        const isBank = selectedLedger?.group_name === 'Bank Accounts';
        return (
          <Input 
            value={record.instrument_no} 
            onChange={(e) => handleEntryChange(record.key, 'instrument_no', e.target.value)}
            size="small"
            disabled={!isBank}
            placeholder={isBank ? "Chq No" : ""}
          />
        );
      }
    },
    {
      "title": 'Inst. Date',
      "dataIndex": 'instrument_date',
      "width": '12%',
      "render": (text, record) => {
        const selectedLedger = ledgers.find(l => l.id === record.ledger_id);
        const isBank = selectedLedger?.group_name === 'Bank Accounts';
        return (
          <DatePicker 
            value={record.instrument_date ? dayjs(record.instrument_date) : null}
            onChange={(date, dateStr) => handleEntryChange(record.key, 'instrument_date', dateStr)}
            size="small"
            style={{ width: '100%' }}
            disabled={!isBank}
          />
        );
      }
    },
    {
      title: 'Debit Amount',
      dataIndex: 'debit_amount',
      width: '20%',
      render: (text, record) => (
        <Input 
          id={`dr-${record.key}`}
          type="number" 
          disabled={!record.is_debit}
          value={record.is_debit ? record.amount : ''} 
          onChange={(e) => handleEntryChange(record.key, 'amount', e.target.value)}
          style={{ width: '100%', textAlign: 'right', backgroundColor: record.is_debit ? '#fff' : '#f5f5f5' }}
          onPressEnter={(e) => {
            if (record.amount > 0) {
                if (isValid) {
                    form.getFieldInstance('narration').focus();
                } else {
                    addRowAndBalance(record.key);
                }
            }
          }}
        />
      )
    },
    {
      title: 'Credit Amount',
      dataIndex: 'credit_amount',
      width: '20%',
      render: (text, record) => (
        <Input 
          id={`cr-${record.key}`}
          type="number" 
          disabled={record.is_debit}
          value={!record.is_debit ? record.amount : ''} 
          onChange={(e) => handleEntryChange(record.key, 'amount', e.target.value)}
          style={{ width: '100%', textAlign: 'right', backgroundColor: !record.is_debit ? '#fff' : '#f5f5f5' }}
          onPressEnter={(e) => {
            if (record.amount > 0) {
                if (isValid) {
                    form.getFieldInstance('narration').focus();
                } else {
                    addRowAndBalance(record.key);
                }
            }
          }}
        />
      )
    },
    {
      title: '',
      key: 'action',
      width: '5%',
      render: (_, record) => <Button type="link" danger onClick={() => removeEntry(record.key)}>X</Button>
    }
  ];

  return (
    <div style={{ height: '100%', padding: '20px', backgroundColor: '#fdfadd', display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', backgroundColor: '#002140', color: 'white', padding: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/logo.png" alt="WEEBAL Logo" style={{ height: '30px', marginRight: '15px', filter: 'brightness(0) invert(1)' }} />
          <Title level={4} style={{ color: 'white', margin: 0 }}>Voucher {id ? 'Alteration' : 'Creation'}</Title>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#008080', padding: '2px 10px', marginRight: '20px', fontSize: '13px', fontWeight: 'bold' }}>
            Type: {VOUCHER_TYPE_NAMES[voucherType] || 'Journal'}
          </div>
          <Text style={{ color: 'white', marginRight: '15px', fontSize: '12px' }}>Hotkeys: F4 Contra, F5 Pmt, F6 Recpt, F7 Jrnl</Text>
          <Button danger size="small" onClick={() => navigate('/')}>[Esc] Quit</Button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#fff', padding: '20px', border: '1px solid #d9d9d9', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)' }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ date: dayjs() }}>
          <Row gutter={16} style={{ borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '15px' }}>
            <Col span={6}>
              <Form.Item name="date" label={<Text strong style={{ fontSize: '12px' }}>Voucher Date</Text>} rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" size="small" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="voucher_number" label={<Text strong style={{ fontSize: '12px' }}>Voucher No.</Text>} style={{ marginBottom: 0 }}>
                <Input placeholder="Auto Generated" size="small" />
              </Form.Item>
            </Col>
          </Row>

          <Table 
            dataSource={entries} 
            columns={columns} 
            pagination={false} 
            size="small"
            bordered
            rowClassName="editable-row"
            scroll={{ y: 'calc(100vh - 480px)' }}
            style={{ border: '1px solid #f0f0f0' }}
            summary={() => (
              <Table.Summary.Row style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}>
                <Table.Summary.Cell index={0} colSpan={2} style={{ textAlign: 'right' }}>Total</Table.Summary.Cell>
                <Table.Summary.Cell index={1} style={{ textAlign: 'right' }}>
                  <Text type={totalDr !== totalCr ? "danger" : ""} style={{ fontSize: '14px' }}>{totalDr.toFixed(2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} style={{ textAlign: 'right' }}>
                  <Text type={totalDr !== totalCr ? "danger" : ""} style={{ fontSize: '14px' }}>{totalCr.toFixed(2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} />
              </Table.Summary.Row>
            )}
          />

          <Row gutter={16} style={{ marginTop: '20px' }}>
            <Col span={24}>
              <Form.Item name="narration" label={<Text strong style={{ fontSize: '12px' }}>Narration</Text>} style={{ marginBottom: '10px' }}>
                <Input.TextArea rows={2} onPressEnter={(e) => {
                    // Do nothing on Enter here to allow multiline if needed, or just let form submit on Tab -> Button
                }} />
              </Form.Item>
            </Col>
          </Row>

          <Row>
            <Col span={24}>
              <Button type="primary" htmlType="submit" disabled={!isValid} style={{ width: '100%', height: '40px', fontWeight: 'bold', backgroundColor: isValid ? '#008080' : '#d9d9d9', border: 'none' }}>
                {id ? 'Update Voucher' : 'Save Voucher (Ctrl+A)'}
              </Button>
            </Col>
          </Row>
        </Form>
      </div>
    </div>
  );
};

export default VoucherEntry;
