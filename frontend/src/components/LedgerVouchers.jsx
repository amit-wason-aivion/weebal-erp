import React, { useState, useEffect } from 'react';
import { Table, Typography, message, Button } from 'antd';
import axios from '../api/axios';
import { useNavigate, useParams } from 'react-router-dom';

const { Title, Text } = Typography;

const LedgerVouchers = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ledgerData, setLedgerData] = useState(null);

  useEffect(() => {
    fetchLedgerVouchers();
  }, [id]);

  const fetchLedgerVouchers = async () => {
    try {
      const res = await axios.get(`/api/ledgers/${id}/vouchers`);
      setLedgerData(res.data);
    } catch (err) {
      message.error("Failed to load Ledger Vouchers.");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'Date', dataIndex: 'date', key: 'date', width: '12%' },
    { title: 'Particulars', dataIndex: 'particulars', key: 'particulars', width: '38%', render: text => <Text strong>{text}</Text> },
    { title: 'Vch Type', dataIndex: 'voucher_type', key: 'voucher_type', width: '15%' },
    { title: 'Vch No.', dataIndex: 'voucher_number', key: 'voucher_number', width: '15%' },
    { title: 'Debit', dataIndex: 'debit', key: 'debit', width: '10%', align: 'right', render: val => val ? Number(val).toFixed(2) : '' },
    { title: 'Credit', dataIndex: 'credit', key: 'credit', width: '10%', align: 'right', render: val => val ? Number(val).toFixed(2) : '' }
  ];

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;
  if (!ledgerData) return <div style={{ padding: '20px' }}>No Data</div>;

  const totalDr = ledgerData.entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCr = ledgerData.entries.reduce((sum, e) => sum + e.credit, 0);

  return (
    <div style={{ height: '100%', padding: '20px', backgroundColor: '#fdfadd', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
        <div style={{ flex: 1 }}>
          <Title level={3} style={{ margin: 0, color: '#008080' }}>Ledger: {ledgerData.ledger_name}</Title>
          <div style={{ marginTop: '5px' }}>
            {ledgerData.address && <Text block style={{ fontSize: '12px' }}>{ledgerData.address}</Text>}
            {ledgerData.city && <Text style={{ fontSize: '12px' }}>{ledgerData.city}, </Text>}
            {ledgerData.state && <Text style={{ fontSize: '12px' }}>{ledgerData.state} </Text>}
            {ledgerData.pincode && <Text style={{ fontSize: '12px' }}>- {ledgerData.pincode}</Text>}
            {(ledgerData.gstin || ledgerData.phone) && (
              <div style={{ marginTop: '2px' }}>
                {ledgerData.gstin && <Text strong style={{ fontSize: '11px', marginRight: '15px' }}>GSTIN: {ledgerData.gstin}</Text>}
                {ledgerData.phone && <Text style={{ fontSize: '11px' }}>Ph: {ledgerData.phone}</Text>}
              </div>
            )}
            {(ledgerData.drug_license_no || ledgerData.fssai_no) && (
              <div style={{ marginTop: '2px' }}>
                {ledgerData.drug_license_no && <Text style={{ fontSize: '11px', marginRight: '15px' }}>DL No: {ledgerData.drug_license_no}</Text>}
                {ledgerData.fssai_no && <Text style={{ fontSize: '11px' }}>FSSAI: {ledgerData.fssai_no}</Text>}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          <Button onClick={() => navigate(-1)} style={{ marginRight: '10px' }}>[Esc] Back</Button>
          <Button danger onClick={() => navigate('/')}>Quit</Button>
        </div>
      </div>

      <Table 
        columns={columns} 
        dataSource={ledgerData.entries} 
        rowKey="id"
        size="small"
        pagination={false}
        bordered
        scroll={{ y: 'calc(100vh - 220px)' }}
        onRow={(record) => ({
          onClick: () => {
             if (record.voucher_type === 'Sales') {
                navigate(`/sales/${record.voucher_id}`);
             } else {
                navigate(`/voucher/${record.voucher_id}`);
             }
          },
          style: { cursor: 'pointer' }
        })}
        summary={() => (
          <Table.Summary>
            <Table.Summary.Row style={{ backgroundColor: '#fafafa' }}>
              <Table.Summary.Cell colSpan={4} align="right"><Text strong>Opening Balance</Text></Table.Summary.Cell>
              <Table.Summary.Cell align="right"><Text strong>{ledgerData.is_opening_debit ? ledgerData.opening_balance.toFixed(2) : ''}</Text></Table.Summary.Cell>
              <Table.Summary.Cell align="right"><Text strong>{!ledgerData.is_opening_debit ? ledgerData.opening_balance.toFixed(2) : ''}</Text></Table.Summary.Cell>
            </Table.Summary.Row>
            
            <Table.Summary.Row>
              <Table.Summary.Cell colSpan={4} align="right"><Text strong>Current Total</Text></Table.Summary.Cell>
              <Table.Summary.Cell align="right"><Text strong>{totalDr.toFixed(2)}</Text></Table.Summary.Cell>
              <Table.Summary.Cell align="right"><Text strong>{totalCr.toFixed(2)}</Text></Table.Summary.Cell>
            </Table.Summary.Row>

            <Table.Summary.Row style={{ backgroundColor: '#fafafa' }}>
              <Table.Summary.Cell colSpan={4} align="right"><Text strong>Closing Balance</Text></Table.Summary.Cell>
              <Table.Summary.Cell align="right"><Text strong>{ledgerData.is_closing_debit ? ledgerData.closing_balance.toFixed(2) : ''}</Text></Table.Summary.Cell>
              <Table.Summary.Cell align="right"><Text strong>{!ledgerData.is_closing_debit ? ledgerData.closing_balance.toFixed(2) : ''}</Text></Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </div>
  );
};

export default LedgerVouchers;
