import React, { useState, useEffect } from 'react';
import { Table, Typography, message, Row, Col, Card, Button } from 'antd';
import axios from '../api/axios';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const BalanceSheet = () => {
  const [loading, setLoading] = useState(true);
  const [bsData, setBsData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBalanceSheet();
  }, []);

  const fetchBalanceSheet = async () => {
    try {
      const res = await axios.get('/api/reports/balance-sheet');
      setBsData(res.data);
    } catch (err) {
      message.error("Failed to load Balance Sheet.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading Balance Sheet...</div>;

  const { liabilities, assets, net_profit, total_liabilities, total_assets } = bsData;

  const liabilityColumns = [
    { 
      title: 'Liabilities', 
      dataIndex: 'name', 
      key: 'name',
      render: (text, record) => (
        <span style={{ fontWeight: (record.is_group || record.key === 'np') ? 'bold' : 'normal' }}>
          {text}
        </span>
      )
    },
    { title: '', dataIndex: 'credit', key: 'credit', align: 'right', render: (val) => val ? Number(val).toFixed(2) : '' }
  ];

  const assetColumns = [
    { 
      title: 'Assets', 
      dataIndex: 'name', 
      key: 'name',
      render: (text, record) => (
        <span style={{ fontWeight: (record.is_group || record.key === 'np') ? 'bold' : 'normal' }}>
          {text}
        </span>
      )
    },
    { title: '', dataIndex: 'debit', key: 'debit', align: 'right', render: (val) => val ? Number(val).toFixed(2) : '' }
  ];

  // Append Net Profit to displaying data logic
  const displayLiabilities = [...liabilities];
  const displayAssets = [...assets];
  
  if (net_profit >= 0) {
      displayLiabilities.push({ key: 'np', name: 'Profit & Loss A/c', credit: net_profit });
  } else {
      displayAssets.push({ key: 'np', name: 'Profit & Loss A/c', debit: Math.abs(net_profit) });
  }

  // Tally totals
  const grandTotal = Math.max(total_liabilities, total_assets);

  return (
    <div style={{ height: '100%', padding: '20px', backgroundColor: '#fdfadd', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <Title level={3} style={{ margin: 0, color: '#008080' }}>{localStorage.getItem('activeCompanyName') || 'WEEBAL ERP'}</Title>
          <Title level={4} style={{ margin: 0, fontWeight: 400 }}>Balance Sheet</Title>
          <Text type="secondary">As of current period end</Text>
        </div>
        <Button danger onClick={() => navigate('/')}>[Esc] Quit</Button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Card size="small" style={{ height: '100%' }} bodyStyle={{ height: '100%', padding: 0 }}>
          <Row gutter={0} style={{ border: '1px solid #f0f0f0', height: '100%' }}>
            {/* LEFT SIDE: Liabilities */}
            <Col span={12} style={{ borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <Table 
                  columns={liabilityColumns} 
                  dataSource={displayLiabilities} 
                  pagination={false} 
                  size="small" 
                  expandable={{ defaultExpandAllRows: true }}
                  rowKey="key"
                  onRow={(record) => ({
                    onClick: () => {
                      if (record.id && record.key !== 'np') {
                        navigate(`/ledger-vouchers/${record.id}`);
                      }
                    },
                    style: { cursor: (record.key === 'np' || !record.id) ? 'default' : 'pointer' }
                  })}
                />
              </div>
              <div style={{ padding: '10px 16px', borderTop: '2px solid #000', borderBottom: '2px solid #000', display: 'flex', justifyContent: 'space-between', backgroundColor: '#fff' }}>
                <Text strong>Total</Text>
                <Text strong>{grandTotal.toFixed(2)}</Text>
              </div>
            </Col>

            {/* RIGHT SIDE: Assets */}
            <Col span={12} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <Table 
                  columns={assetColumns} 
                  dataSource={displayAssets} 
                  pagination={false} 
                  size="small" 
                  expandable={{ defaultExpandAllRows: true }}
                  rowKey="key"
                  onRow={(record) => ({
                    onClick: () => {
                      if (record.id && record.key !== 'np') {
                        navigate(`/ledger-vouchers/${record.id}`);
                      }
                    },
                    style: { cursor: (record.key === 'np' || !record.id) ? 'default' : 'pointer' }
                  })}
                />
              </div>
              <div style={{ padding: '10px 16px', borderTop: '2px solid #000', borderBottom: '2px solid #000', display: 'flex', justifyContent: 'space-between', backgroundColor: '#fff' }}>
                <Text strong>Total</Text>
                <Text strong>{grandTotal.toFixed(2)}</Text>
              </div>
            </Col>
          </Row>
        </Card>
      </div>
    </div>
  );
};

export default BalanceSheet;
