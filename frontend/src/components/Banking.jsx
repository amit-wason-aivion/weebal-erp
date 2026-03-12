import React, { useState, useEffect } from 'react';
import { Row, Col, Typography, Card, Select, Table, Button, DatePicker, message, Tabs, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined } from '@ant-design/icons';
import axios from '../api/axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const Banking = () => {
  const [banks, setBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clearingDates, setClearingDates] = useState({}); // {id: date_str}
  const navigate = useNavigate();

  // Tally Aesthetic Styles
  const theme = {
    bg: '#fdfadd',
    teal: '#008080',
    border: '#a0a0a0',
    panelBg: '#ffffff',
    hotkey: '#ff0000',
    headerBg: '#002140'
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  useEffect(() => {
    if (selectedBank) {
      fetchReconciliationData(selectedBank);
    }
  }, [selectedBank]);

  const fetchBanks = async () => {
    try {
      const res = await axios.get('/api/banking/bank-ledgers');
      setBanks(res.data);
      if (res.data.length > 0) {
        setSelectedBank(res.data[0].id);
      }
    } catch (err) {
      message.error("Failed to load bank ledgers");
    }
  };

  const fetchReconciliationData = async (ledgerId) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/banking/reconciliation/${ledgerId}`);
      setEntries(res.data);
      // Reset clearing dates
      setClearingDates({});
    } catch (err) {
      message.error("Failed to load reconciliation data");
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (id, dateStr) => {
    setClearingDates(prev => ({ ...prev, [id]: dateStr }));
  };

  const handleSaveReconciliation = async () => {
    const items = Object.entries(clearingDates).map(([id, date]) => ({
      id: parseInt(id),
      bank_date: date
    }));

    if (items.length === 0) {
      message.warning("No changes to save");
      return;
    }

    try {
      await axios.post('/api/banking/reconcile', { items });
      message.success("Reconciliation saved successfully");
      fetchReconciliationData(selectedBank);
    } catch (err) {
      message.error("Failed to save reconciliation");
    }
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: '100px',
      render: d => dayjs(d).format('DD-MMM-YYYY')
    },
    {
      title: 'Voucher No.',
      dataIndex: 'voucher_number',
      key: 'vch_no',
      width: '120px',
    },
    {
      title: 'Particulars',
      dataIndex: 'narration',
      key: 'narration',
      render: (n, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.is_debit ? 'Deposit' : 'Withdrawal'}</div>
          <div style={{ fontSize: '11px', color: '#666' }}>{n}</div>
        </div>
      )
    },
    {
      title: 'Debit (₹)',
      dataIndex: 'amount',
      key: 'debit',
      align: 'right',
      width: '120px',
      render: (amt, record) => record.is_debit ? amt.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''
    },
    {
      title: 'Credit (₹)',
      dataIndex: 'amount',
      key: 'credit',
      align: 'right',
      width: '120px',
      render: (amt, record) => !record.is_debit ? amt.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''
    },
    {
      title: 'Instrument Details',
      key: 'instrument',
      width: '200px',
      render: (_, record) => (
        <div style={{ fontSize: '11px' }}>
          <div>No: {record.instrument_no || '-'}</div>
          <div>Date: {record.instrument_date ? dayjs(record.instrument_date).format('DD-MMM-YYYY') : '-'}</div>
        </div>
      )
    },
    {
      title: 'Bank Date',
      key: 'bank_date',
      width: '150px',
      render: (_, record) => (
        <DatePicker 
          size="small" 
          format="DD-MMM-YYYY"
          placeholder="Cleared Date"
          onChange={(date, dateStr) => handleDateChange(record.id, date ? date.format('YYYY-MM-DD') : null)}
        />
      )
    }
  ];

  return (
    <div style={{ height: '100vh', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.headerBg, color: 'white', padding: '10px 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} type="text" style={{ color: 'white', marginRight: '10px' }} />
          <img src="/logo.png" alt="" style={{ height: '30px', marginRight: '15px', filter: 'brightness(0) invert(1)' }} />
          <Title level={4} style={{ color: 'white', margin: 0 }}>Banking Dashboard</Title>
        </div>
        <Space>
           <Text style={{ color: '#008080', fontWeight: 'bold', background: '#fff', padding: '2px 8px', borderRadius: '4px' }}>Bank Reconciliation</Text>
           <Button icon={<SaveOutlined />} type="primary" onClick={handleSaveReconciliation} style={{ backgroundColor: theme.teal, borderColor: theme.teal }}>Save Reconcile</Button>
        </Space>
      </div>

      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        <Card style={{ marginBottom: '20px', borderRadius: 0, border: `1px solid ${theme.border}` }}>
          <Row gutter={24} align="middle">
            <Col span={8}>
              <Text strong>Select Bank Ledger: </Text>
              <Select 
                style={{ width: '100%', marginTop: '5px' }} 
                value={selectedBank} 
                onChange={setSelectedBank}
                placeholder="Choose a bank..."
              >
                {banks.map(b => <Option key={b.id} value={b.id}>{b.name} (Bal: ₹{b.opening_balance})</Option>)}
              </Select>
            </Col>
            <Col span={16} style={{ textAlign: 'right' }}>
               <Text type="secondary">Press <Text strong style={{ color: theme.hotkey }}>Esc</Text> to return to Gateway</Text>
            </Col>
          </Row>
        </Card>

        <Tabs 
          defaultActiveKey="1" 
          type="card"
          items={[
            {
              key: '1',
              label: 'Bank Reconciliation',
              children: (
                <Table 
                  dataSource={entries} 
                  columns={columns} 
                  loading={loading}
                  pagination={false}
                  size="small"
                  bordered
                  scroll={{ y: 'calc(100vh - 400px)' }}
                  rowKey="id"
                  summary={pageData => {
                    let totalDr = 0;
                    let totalCr = 0;
                    pageData.forEach(({ amount, is_debit }) => {
                      if (is_debit) totalDr += amount;
                      else totalCr += amount;
                    });
                    return (
                      <Table.Summary.Row style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}>
                        <Table.Summary.Cell index={0} colSpan={3} style={{ textAlign: 'right' }}>Total Uncleared</Table.Summary.Cell>
                        <Table.Summary.Cell index={1} style={{ textAlign: 'right' }}>{totalDr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Table.Summary.Cell>
                        <Table.Summary.Cell index={2} style={{ textAlign: 'right' }}>{totalCr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Table.Summary.Cell>
                        <Table.Summary.Cell index={3} colSpan={2} />
                      </Table.Summary.Row>
                    );
                  }}
                />
              )
            },
            {
              key: '2',
              label: 'Cheque Register',
              children: <div style={{ padding: '40px', textAlign: 'center' }}><Title level={4} type="secondary">Cheque Register feature coming in next update</Title></div>
            },
            {
              key: '3',
              label: 'Deposit Slip',
              children: <div style={{ padding: '40px', textAlign: 'center' }}><Title level={4} type="secondary">Deposit Slip generation coming in next update</Title></div>
            }
          ]}
        />
      </div>

      <div style={{ height: '24px', backgroundColor: '#a0d0d0', borderTop: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '11px' }}>
        <Text strong>WEEBAL ERP v1.2 | Banking Active | Reconciliation Mode</Text>
      </div>

    </div>
  );
};

export default Banking;
