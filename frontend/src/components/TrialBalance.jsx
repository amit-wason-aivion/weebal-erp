import React, { useEffect } from 'react';
import { Table, Typography, Spin, Alert, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchTrialBalance } from '../store/accountingSlice';

const { Title } = Typography;

const TrialBalance = () => {
  const dispatch = useDispatch();
  const { trialBalanceData, loading, error } = useSelector((state) => state.accounting);

  const navigate = useNavigate();

  useEffect(() => {
    dispatch(fetchTrialBalance());
    
    // Tally-style keyboard listener (Esc to go back)
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        navigate('/');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  const columns = [
    {
      title: 'Particulars',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <span style={{ fontWeight: record.is_group ? 'bold' : 'normal' }}>
          {text}
        </span>
      )
    },
    {
      title: 'Debit Balance',
      dataIndex: 'debit',
      key: 'debit',
      align: 'right',
      render: (val) => val ? Number(val).toFixed(2) : '',
    },
    {
      title: 'Credit Balance',
      dataIndex: 'credit',
      key: 'credit',
      align: 'right',
      render: (val) => val ? Number(val).toFixed(2) : '',
    },
  ];

  if (loading) return <Spin style={{ marginTop: '50px' }} size="large" />;
  if (error) return <Alert message="Error fetching data" type="error" />;

  return (
    <div style={{ height: '100%', padding: '20px', backgroundColor: '#fdfadd' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <Title level={2} style={{ margin: 0, color: '#008080' }}>Trial Balance</Title>
        <Button danger onClick={() => navigate('/')}>[Esc] Quit</Button>
      </div>
      <Table 
        columns={columns} 
        dataSource={trialBalanceData?.tree || []} 
        size="small" 
        pagination={false}
        bordered
        scroll={{ y: 'calc(100vh - 160px)' }}
        expandable={{
          defaultExpandAllRows: true, // Auto expand all like Tally
        }}
        onRow={(record) => ({
          onClick: () => {
             const cleanId = record.key.replace('ledger_', '');
             if (!record.is_group) {
                navigate(`/ledger-vouchers/${cleanId}`);
             }
          },
          style: { cursor: record.is_group ? 'default' : 'pointer' }
        })}
        footer={() => (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>Total</span>
            <div style={{ display: 'flex', gap: '80px' }}>
              <span>{trialBalanceData?.total_debit?.toFixed(2)}</span>
              <span>{trialBalanceData?.total_credit?.toFixed(2)}</span>
            </div>
          </div>
        )}
      />
    </div>
  );
};

export default TrialBalance;
