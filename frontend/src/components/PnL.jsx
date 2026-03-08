import React, { useState, useEffect } from 'react';
import { Table, Typography, message, Row, Col, Card, Button } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const PnL = () => {
  const [loading, setLoading] = useState(true);
  const [pnlData, setPnlData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPnL();
  }, []);

  const fetchPnL = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/reports/pnl');
      setPnlData(res.data);
    } catch (err) {
      message.error("Failed to load Profit & Loss Statement.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading Profit & Loss...</div>;

  const { trading_account, pnl_account } = pnlData;

  // Flatten tree for simple Tally-like display using expandable tables
  const expenseColumns = [
    { title: 'Particulars', dataIndex: 'name', key: 'name' },
    { title: '', dataIndex: 'debit', key: 'debit', align: 'right', render: (val) => val ? Number(val).toFixed(2) : '' }
  ];

  const incomeColumns = [
    { title: 'Particulars', dataIndex: 'name', key: 'name' },
    { title: '', dataIndex: 'credit', key: 'credit', align: 'right', render: (val) => val ? Number(val).toFixed(2) : '' }
  ];

  const RenderAccountRow = ({ title, leftNodes, rightNodes, leftTotal, rightTotal, balancingLabel, balancingValue, leftIsBalancing }) => {
    // Balance the two sides for the bottom total
    const grandTotal = Math.max(leftTotal + (leftIsBalancing ? balancingValue : 0), rightTotal + (!leftIsBalancing ? balancingValue : 0));

    return (
      <Card title={title} style={{ marginBottom: '20px' }} size="small">
        <Row gutter={0} style={{ border: '1px solid #f0f0f0' }}>
          {/* LEFT SIDE: Expenses */}
          <Col span={12} style={{ borderRight: '1px solid #f0f0f0' }}>
            <Table 
              columns={expenseColumns} 
              dataSource={leftNodes} 
              pagination={false} 
              size="small" 
              expandable={{ defaultExpandAllRows: true }}
              showHeader={false}
              rowKey="id"
              onRow={(record) => ({
                onClick: () => {
                  if (record.id && record.id !== 'gp' && record.id !== 'np') {
                    navigate(`/ledger-vouchers/${record.id}`);
                  }
                },
                style: { cursor: (!record.id || record.id === 'gp' || record.id === 'np') ? 'default' : 'pointer' }
              })}
              summary={() => (
                <Table.Summary>
                  <Table.Summary.Row>
                    <Table.Summary.Cell><Text strong>{leftIsBalancing ? balancingLabel : ''}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell align="right"><Text strong>{leftIsBalancing ? balancingValue.toFixed(2) : ''}</Text></Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
            <div style={{ padding: '10px 16px', borderTop: '2px solid #000', borderBottom: '2px solid #000', display: 'flex', justifyContent: 'space-between' }}>
              <Text strong>Total</Text>
              <Text strong>{grandTotal.toFixed(2)}</Text>
            </div>
          </Col>

          {/* RIGHT SIDE: Incomes */}
          <Col span={12}>
            <Table 
              columns={incomeColumns} 
              dataSource={rightNodes} 
              pagination={false} 
              size="small" 
              expandable={{ defaultExpandAllRows: true }}
              showHeader={false}
              rowKey="id"
              onRow={(record) => ({
                onClick: () => {
                  if (record.id && record.id !== 'gp' && record.id !== 'np') {
                    navigate(`/ledger-vouchers/${record.id}`);
                  }
                },
                style: { cursor: (!record.id || record.id === 'gp' || record.id === 'np') ? 'default' : 'pointer' }
              })}
              summary={() => (
                <Table.Summary>
                  <Table.Summary.Row>
                    <Table.Summary.Cell><Text strong>{!leftIsBalancing ? balancingLabel : ''}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell align="right"><Text strong>{!leftIsBalancing ? balancingValue.toFixed(2) : ''}</Text></Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
            <div style={{ padding: '10px 16px', borderTop: '2px solid #000', borderBottom: '2px solid #000', display: 'flex', justifyContent: 'space-between' }}>
              <Text strong>Total</Text>
              <Text strong>{grandTotal.toFixed(2)}</Text>
            </div>
          </Col>
        </Row>
      </Card>
    );
  };

  return (
    <div style={{ height: '100%', padding: '20px', backgroundColor: '#fdfadd', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <Title level={3} style={{ margin: 0, color: '#008080' }}>{localStorage.getItem('activeCompanyName') || 'WEEBAL ERP'}</Title>
          <Title level={4} style={{ margin: 0, fontWeight: 400 }}>Profit & Loss A/c</Title>
          <Text type="secondary">For the current period</Text>
        </div>
        <Button danger onClick={() => navigate('/')}>[Esc] Quit</Button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
        <RenderAccountRow 
          title="Trading Account"
          leftNodes={trading_account.direct_expenses}
          rightNodes={trading_account.direct_incomes}
          leftTotal={Number(trading_account.total_direct_exp)}
          rightTotal={Number(trading_account.total_direct_inc)}
          balancingLabel="Gross Profit c/o"
          balancingValue={Number(trading_account.gross_profit)}
          leftIsBalancing={Number(trading_account.gross_profit) >= 0}
        />

        <RenderAccountRow 
          title="Profit & Loss Account"
          leftNodes={pnl_account.indirect_expenses}
          rightNodes={[
             ...(Number(trading_account.gross_profit) >= 0 ? [{ id: 'gp', name: 'Gross Profit b/d', credit: Number(trading_account.gross_profit) }] : []),
             ...pnl_account.indirect_incomes
          ]}
          leftTotal={Number(pnl_account.total_indirect_exp)}
          rightTotal={Number(pnl_account.total_indirect_inc) + (Number(trading_account.gross_profit) >= 0 ? Number(trading_account.gross_profit) : 0)}
          balancingLabel="Net Profit"
          balancingValue={Math.abs(Number(pnl_account.net_profit))}
          leftIsBalancing={Number(pnl_account.net_profit) >= 0}
        />
      </div>
    </div>
  );
};

export default PnL;
