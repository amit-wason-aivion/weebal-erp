import React, { useState, useEffect } from 'react';
import { Table, Typography, message, Button, Modal } from 'antd';
import axios from '../api/axios';
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
  const [selectedRowId, setSelectedRowId] = useState(null);

  useEffect(() => {
    fetchDayBook();
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        if (selectedRowId) {
          handleDelete(selectedRowId);
        } else {
          message.warning("Please select a voucher to delete (click a row first).");
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRowId]);

  const fetchDayBook = async () => {
    try {
      // For demo, we are fetching all by omitting date params, but you can pass ?date=${currentDate}
      const res = await axios.get('/api/daybook');
      setVouchers(res.data);
    } catch (err) {
      message.error("Failed to load Day Book.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this voucher?',
      content: 'This action cannot be undone and will remove all associated accounting and inventory entries.',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await axios.delete(`/api/vouchers/${id}`);
          message.success("Voucher deleted successfully.");
          fetchDayBook();
          setSelectedRowId(null);
        } catch (err) {
          message.error(err.response?.data?.detail || "Failed to delete voucher.");
        }
      },
    });
  };

  const columns = [
    { title: 'Date', dataIndex: 'date', key: 'date', width: '15%' },
    { title: 'Particulars', dataIndex: 'particulars', key: 'particulars', width: '35%', render: text => <Text strong>{text}</Text> },
    { title: 'Vch Type', dataIndex: 'voucher_type', key: 'voucher_type', width: '15%' },
    { title: 'Vch No.', dataIndex: 'voucher_number', key: 'voucher_number', width: '15%' },
    { title: 'Debit Amount', dataIndex: 'debit', key: 'debit', width: '10%', align: 'right', render: val => val ? Number(val).toFixed(2) : '' },
    { title: 'Credit Amount', dataIndex: 'credit', key: 'credit', width: '10%', align: 'right', render: val => val ? Number(val).toFixed(2) : '' },
    {
      title: 'Action',
      key: 'action',
      width: '10%',
      render: (_, record) => (
        <Button 
          type="link" 
          danger 
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(record.id);
          }}
        >
          Delete
        </Button>
      )
    }
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
            setSelectedRowId(record.id);
          },
          onDoubleClick: () => {
            if (record.voucher_type === 'Sales') {
               navigate(`/sales/${record.id}`);
            } else {
               navigate(`/voucher/${record.id}`);
            }
          },
          style: { 
            cursor: 'pointer',
            backgroundColor: selectedRowId === record.id ? '#e6f7ff' : 'inherit'
          }
        })}
      />
      <div style={{ marginTop: '10px' }}>
        <Text type="secondary">Tip: Click a row to select, then press <Text code>Alt + D</Text> to delete. Double-click to view/edit.</Text>
      </div>
    </div>
  );
};

export default DayBook;
