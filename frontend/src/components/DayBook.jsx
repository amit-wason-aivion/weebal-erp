import React, { useState, useEffect } from 'react';
import { Table, Typography, message, Button } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const DayBook = () => {
  const [loading, setLoading] = useState(true);
  const [vouchers, setVouchers] = useState([]);
  const navigate = useNavigate();
  // We can default to today's date, or no date (fetch all) for demo purposes.
  // For now, let's fetch all to show the full log.
  const [currentDate, setCurrentDate] = useState(dayjs().format('YYYY-MM-DD'));

  useEffect(() => {
    fetchDayBook();
  }, []);

  const fetchDayBook = async () => {
    try {
      // For demo, we are fetching all by omitting date params, but you can pass ?date=${currentDate}
      const res = await axios.get(`http://localhost:8000/api/daybook`);
      setVouchers(res.data);
    } catch (err) {
      message.error("Failed to load Day Book.");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'Date', dataIndex: 'date', key: 'date', width: '15%' },
    { title: 'Particulars', dataIndex: 'particulars', key: 'particulars', width: '35%', render: text => <Text strong>{text}</Text> },
    { title: 'Vch Type', dataIndex: 'voucher_type', key: 'voucher_type', width: '15%' },
    { title: 'Vch No.', dataIndex: 'voucher_number', key: 'voucher_number', width: '15%' },
    { title: 'Debit Amount', dataIndex: 'debit', key: 'debit', width: '10%', align: 'right', render: val => val ? Number(val).toFixed(2) : '' },
    { title: 'Credit Amount', dataIndex: 'credit', key: 'credit', width: '10%', align: 'right', render: val => val ? Number(val).toFixed(2) : '' }
  ];

  return (
    <div style={{ height: '100%', padding: '20px', backgroundColor: '#fdfadd' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#008080' }}>Day Book</Title>
          <Text style={{ fontWeight: 'bold' }}>Company: Weebal Infotech</Text>
        </div>
        <Button danger onClick={() => navigate('/')}>[Esc] Quit</Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={vouchers} 
        rowKey="id"
        size="small"
        pagination={false}
        bordered
        loading={loading}
        scroll={{ y: 'calc(100vh - 120px)' }}
        style={{ backgroundColor: '#fff' }}
        onRow={(record) => ({
          onClick: () => {
            if (record.voucher_type === 'Sales') {
               navigate(`/sales/${record.id}`);
            } else {
               navigate(`/voucher/${record.id}`);
            }
          },
          style: { cursor: 'pointer' }
        })}
      />
    </div>
  );
};

export default DayBook;
