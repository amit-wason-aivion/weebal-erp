import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Select, DatePicker, Button, Table, Typography, message, Row, Col } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const VoucherEntry = () => {
  const [form] = Form.useForm();
  const [ledgers, setLedgers] = useState([]);
  const [entries, setEntries] = useState([
    { key: 0, ledger_id: null, is_debit: true, amount: null },
    { key: 1, ledger_id: null, is_debit: false, amount: null }
  ]);
  const [voucherType, setVoucherType] = useState('1'); // Default to 1 (Assuming 1 is Journal or similar)
  const navigate = useNavigate();
  const { id } = useParams();
  
  // Tally hotkey listeners
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'F4') setVoucherType('4'); // Contra
      if (e.key === 'F5') setVoucherType('5'); // Payment
      if (e.key === 'F6') setVoucherType('6'); // Receipt
      if (e.key === 'F7') setVoucherType('1'); // Journal
      if (e.key === 'F8') setVoucherType('2'); // Sales
      if (e.key === 'F9') setVoucherType('3'); // Purchase
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    // Fetch ledgers for combobox
    axios.get('http://localhost:8000/api/ledgers')
      .then(res => setLedgers(res.data))
      .catch(err => message.error("Failed to load ledgers"));

    // If ID exists, fetch existing voucher details
    if (id) {
      axios.get(`http://localhost:8000/api/vouchers/${id}`)
        .then(res => {
          const v = res.data;
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

  const handleEntryChange = (key, field, value) => {
    const newEntries = [...entries];
    const index = newEntries.findIndex(e => e.key === key);
    newEntries[index][field] = value;
    
    // Automatically add a new row if we're filling the last one
    if (index === newEntries.length - 1 && field === 'amount' && value > 0) {
      newEntries.push({ key: newEntries.length, ledger_id: null, is_debit: !newEntries[index].is_debit, amount: null });
    }
    setEntries(newEntries);
  };

  const removeEntry = (key) => {
    if (entries.length <= 2) return; // Keep at least 2
    setEntries(entries.filter(e => e.key !== key));
  };

  const totalDr = entries.filter(e => e.is_debit).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalCr = entries.filter(e => !e.is_debit).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const isValid = totalDr > 0 && totalDr === totalCr;

  const handleSubmit = async (values) => {
    if (!isValid) {
      message.error("Total Debits must equal Total Credits!");
      return;
    }

    // Filter out empty rows
    const validEntries = entries.filter(e => e.ledger_id && e.amount > 0);

    const payload = {
      voucher_type_id: parseInt(voucherType),
      voucher_number: values.voucher_number || 'AUTO',
      date: values.date.format('YYYY-MM-DD'),
      narration: values.narration,
      entries: validEntries.map(e => ({
        ledger_id: e.ledger_id,
        amount: parseFloat(e.amount),
        is_debit: e.is_debit
      }))
    };

    try {
      const url = id ? `http://localhost:8000/api/vouchers/${id}` : 'http://localhost:8000/api/vouchers';
      const method = id ? 'put' : 'post';
      const res = await axios[method](url, payload);
      
      message.success(res.data.message);
      
      if (id) {
        navigate('/daybook');
      } else {
        form.resetFields();
        setEntries([
          { key: 0, ledger_id: null, is_debit: true, amount: null },
          { key: 1, ledger_id: null, is_debit: false, amount: null }
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
          value={is_debit ? 'Dr' : 'Cr'} 
          onChange={(val) => handleEntryChange(record.key, 'is_debit', val === 'Dr')}
          style={{ width: '100%' }}
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
      render: (text, record) => (
        <Select
          showSearch
          optionFilterProp="children"
          value={record.ledger_id}
          onChange={(val) => handleEntryChange(record.key, 'ledger_id', val)}
          style={{ width: '100%' }}
          placeholder="Select or type ledger..."
        >
          {ledgers.map(l => <Option key={l.id} value={l.id}>{l.name}</Option>)}
        </Select>
      )
    },
    {
      title: 'Debit Amount',
      dataIndex: 'debit_amount',
      width: '20%',
      render: (text, record) => record.is_debit ? (
        <Input 
          type="number" 
          value={record.amount} 
          onChange={(e) => handleEntryChange(record.key, 'amount', e.target.value)}
          onPressEnter={(e) => {
            // Tally Enter behavior: move to next
            const form = e.target.form;
            const index = Array.prototype.indexOf.call(form, e.target);
            form.elements[index + 1]?.focus();
            e.preventDefault();
          }}
        />
      ) : null
    },
    {
      title: 'Credit Amount',
      dataIndex: 'credit_amount',
      width: '20%',
      render: (text, record) => !record.is_debit ? (
        <Input 
          type="number" 
          value={record.amount} 
          onChange={(e) => handleEntryChange(record.key, 'amount', e.target.value)}
          onPressEnter={(e) => {
             // Tally Enter behavior
            const form = e.target.form;
            const index = Array.prototype.indexOf.call(form, e.target);
            form.elements[index + 1]?.focus();
            e.preventDefault();
          }}
        />
      ) : null
    },
    {
      title: '',
      key: 'action',
      render: (_, record) => <Button type="link" danger onClick={() => removeEntry(record.key)}>X</Button>
    }
  ];

  return (
    <div style={{ height: '100%', padding: '20px', backgroundColor: '#fdfadd', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', backgroundColor: '#002140', color: 'white', padding: '10px' }}>
        <Title level={4} style={{ color: 'white', margin: 0 }}>Voucher {id ? 'Alteration' : 'Creation'}</Title>
        <div>
          <Text style={{ color: 'white', marginRight: '15px' }}>Type: {voucherType} | Hotkeys: F4 Contra, F5 Pmt, F7 Jrnl</Text>
          <Button danger size="small" onClick={() => navigate('/')}>[Esc] Quit</Button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#fff', padding: '20px', border: '1px solid #d9d9d9' }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ date: dayjs() }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="date" label="Voucher Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="voucher_number" label="Voucher No.">
                <Input placeholder="Auto Generated" />
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
            scroll={{ y: 'calc(100vh - 450px)' }}
            summary={() => (
              <Table.Summary.Row style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}>
                <Table.Summary.Cell index={0} colSpan={2}>Total</Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <Text type={totalDr !== totalCr ? "danger" : ""}>{totalDr.toFixed(2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  <Text type={totalDr !== totalCr ? "danger" : ""}>{totalCr.toFixed(2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} />
              </Table.Summary.Row>
            )}
          />

          <Form.Item name="narration" label="Narration" style={{ marginTop: '20px' }}>
            <Input.TextArea rows={2} onPressEnter={(e) => e.preventDefault()} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" disabled={!isValid} style={{ width: '100%' }}>
              {id ? 'Update Voucher' : 'Save Voucher (Ctrl+A)'}
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};

export default VoucherEntry;
