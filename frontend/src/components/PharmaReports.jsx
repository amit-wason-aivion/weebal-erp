import React, { useState, useEffect } from 'react';
import { Table, Card, Tabs, Typography, Space, Button, DatePicker, Tag, Row, Col, Statistic, Empty } from 'antd';
import { RocketOutlined, AlertOutlined, SafetyOutlined, HistoryOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useCompany } from '../context/CompanyContext';

const { Title, Text } = Typography;

const PharmaReports = () => {
    const { activeCompany } = useCompany();
    const [expiryData, setExpiryData] = useState([]);
    const [scheduleHData, setScheduleHData] = useState([]);
    const [reorderData, setReorderData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expiryDays, setExpiryDays] = useState(90);
    const navigate = useNavigate();

    useEffect(() => {
        if (activeCompany) {
            fetchExpiry(90);
            fetchScheduleH();
            fetchReorder();
        }
    }, [activeCompany]);

    const fetchExpiry = async (days) => {
        setLoading(true);
        try {
            const res = await axios.get('/api/reports/expiry', { params: { days, company_id: activeCompany.id } });
            setExpiryData(res.data);
            setExpiryDays(days);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchScheduleH = async () => {
        try {
            const res = await axios.get('/api/reports/schedule-h', { params: { company_id: activeCompany.id } });
            setScheduleHData(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchReorder = async () => {
        try {
            const res = await axios.get('/api/reports/reorder', { params: { company_id: activeCompany.id } });
            setReorderData(res.data);
        } catch (e) { console.error(e); }
    };

    const expiryColumns = [
        { title: 'Item Name', dataIndex: 'item_name', key: 'item_name', sorter: (a, b) => a.item_name.localeCompare(b.item_name) },
        { title: 'Batch No', dataIndex: 'batch_no', key: 'batch_no' },
        { title: 'Expiry Date', dataIndex: 'expiry_date', key: 'expiry_date', sorter: (a, b) => a.expiry_date.localeCompare(b.expiry_date), render: (date) => <Text type="danger">{date}</Text> },
        { title: 'Current Stock', dataIndex: 'current_stock', key: 'current_stock', align: 'right' }
    ];

    const scheduleHColumns = [
        { title: 'Date', dataIndex: 'date', key: 'date' },
        { title: 'Item Name', dataIndex: 'item_name', key: 'item_name' },
        { title: 'Type', dataIndex: 'type', key: 'type', render: (t) => <Tag color={t === 'Sale' ? 'red' : 'green'}>{t}</Tag> },
        { title: 'Qty', dataIndex: 'qty', key: 'qty', align: 'right' },
        { title: 'Drug Category', key: 'category', render: (_, r) => <Space>{r.is_narcotic && <Tag color="purple">Narcotic</Tag>}{r.is_h1 && <Tag color="volcano">H1 Drug</Tag>}</Space> }
    ];

    const reorderColumns = [
        { title: 'Item Name', dataIndex: 'item_name', key: 'item_name' },
        { title: 'Current Stock', dataIndex: 'current_stock', key: 'current_stock', align: 'right' },
        { title: 'Min Level', dataIndex: 'min_level', key: 'min_level', align: 'right' },
        { title: 'Suggested Order', dataIndex: 'suggested_order', key: 'suggested_order', align: 'right', render: (val) => <Text strong style={{ color: '#cf1322' }}>{val}</Text> }
    ];

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card bordered={false} className="pharma-dashboard">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <Space>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} type="text" />
                        <Title level={3} style={{ margin: 0, color: '#001529' }}>Pharma Analytics & Legal Registers</Title>
                    </Space>
                    <Tag color="geekblue">{activeCompany?.name}</Tag>
                </div>

                <Row gutter={16} style={{ marginBottom: 20 }}>
                    <Col span={8}>
                        <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #f5222d' }}>
                            <Statistic title="Critical Expiries" value={expiryData.length} prefix={<AlertOutlined />} valueStyle={{ color: '#cf1322' }} />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #faad14' }}>
                            <Statistic title="Shortage Items" value={reorderData.length} prefix={<RocketOutlined />} valueStyle={{ color: '#d48806' }} />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #722ed1' }}>
                            <Statistic title="Narcotic Transactions" value={scheduleHData.length} prefix={<SafetyOutlined />} valueStyle={{ color: '#722ed1' }} />
                        </Card>
                    </Col>
                </Row>

                <Tabs defaultActiveKey="1" type="card">
                    <Tabs.TabPane tab={<span><AlertOutlined />Expiry Dashboard</span>} key="1">
                        <div style={{ marginBottom: 15 }}>
                            <Space>
                                <Text>View items expiring in:</Text>
                                <Button type={expiryDays === 30 ? 'primary' : 'default'} onClick={() => fetchExpiry(30)}>30 Days</Button>
                                <Button type={expiryDays === 60 ? 'primary' : 'default'} onClick={() => fetchExpiry(60)}>60 Days</Button>
                                <Button type={expiryDays === 90 ? 'primary' : 'default'} onClick={() => fetchExpiry(90)}>90 Days</Button>
                            </Space>
                        </div>
                        <Table dataSource={expiryData} columns={expiryColumns} rowKey={(r) => `${r.item_name}-${r.batch_no}`} loading={loading} size="small" bordered />
                    </Tabs.TabPane>

                    <Tabs.TabPane tab={<span><SafetyOutlined />Legal Registers (Narcotic/H1)</span>} key="2">
                        <Table dataSource={scheduleHData} columns={scheduleHColumns} rowKey={(r, i) => i} size="small" bordered />
                    </Tabs.TabPane>

                    <Tabs.TabPane tab={<span><RocketOutlined />Re-order Management</span>} key="3">
                        <Table dataSource={reorderData} columns={reorderColumns} rowKey="item_name" size="small" bordered />
                    </Tabs.TabPane>
                </Tabs>
            </Card>
        </div>
    );
};

export default PharmaReports;
