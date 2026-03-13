import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, Space, Typography, message, Card, Tabs, Modal } from 'antd';
import { PlusOutlined, SearchOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useCompany } from '../context/CompanyContext';
import LedgerDrawer from './LedgerDrawer';

const { Title, Text } = Typography;
const { Option } = Select;

const AccountsInfo = () => {
    const { activeCompany } = useCompany();
    const [ledgers, setLedgers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [ledgerDrawerVisible, setLedgerDrawerVisible] = useState(false);
    const [groupModalVisible, setGroupModalVisible] = useState(false);
    const [ledgerSearchText, setLedgerSearchText] = useState('');
    const [groupSearchText, setGroupSearchText] = useState('');
    const [editingLedger, setEditingLedger] = useState(null);
    const [groupForm] = Form.useForm();
    const navigate = useNavigate();

    useEffect(() => {
        if (activeCompany) {
            fetchData();
        }
    }, [activeCompany]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const config = {
                params: { company_id: activeCompany?.id }
            };
            const [ledgerRes, groupRes] = await Promise.all([
                axios.get('/api/ledgers', config),
                axios.get('/api/groups', config)
            ]);
            setLedgers(ledgerRes.data);
            setGroups(groupRes.data);
        } catch (error) {
            message.error("Failed to fetch data");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async (values) => {
        setLoading(true);
        try {
            const payload = { ...values, company_id: activeCompany?.id };
            await axios.post('/api/groups', payload);
            message.success("Group created successfully");
            setGroupModalVisible(false);
            groupForm.resetFields();
            fetchData();
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to create group");
        } finally {
            setLoading(false);
        }
    };

    const ledgerColumns = [
        {
            title: 'Ledger Name',
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => a.name.localeCompare(b.name),
            render: (text, record) => (
                <Text strong style={{ color: '#000080' }}>{text}</Text>
            )
        },
        {
            title: 'Group',
            dataIndex: 'group_id',
            key: 'group_id',
            render: (groupId) => groups.find(g => String(g.id) === String(groupId))?.name || 'Unknown'
        },
        {
            title: 'Opening Balance',
            dataIndex: 'opening_balance',
            key: 'opening_balance',
            align: 'right',
            render: (val, record) => (
                <Text>
                    {val.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {record.is_debit_balance ? 'Dr' : 'Cr'}
                </Text>
            )
        },
        {
            title: 'GSTIN',
            dataIndex: 'gstin',
            key: 'gstin',
            width: 150,
            render: (text) => text || '-'
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 80,
            render: (_, record) => (
                <Button 
                    type="link" 
                    size="small" 
                    onClick={(e) => {
                        e.stopPropagation();
                        setEditingLedger(record);
                        setLedgerDrawerVisible(true);
                    }}
                >
                    Edit
                </Button>
            )
        }
    ];

    const groupColumns = [
        {
            title: 'Group Name',
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => a.name.localeCompare(b.name),
            render: (text) => <Text strong style={{ color: '#008080' }}>{text}</Text>
        },
        {
            title: 'Under (Parent Group)',
            dataIndex: 'parent_id',
            key: 'parent_id',
            render: (pid) => groups.find(g => String(g.id) === String(pid))?.name || <Text type="secondary">Primary</Text>
        }
    ];

    const filteredLedgers = ledgers.filter(l =>
        l.name.toLowerCase().includes(ledgerSearchText.toLowerCase())
    );

    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(groupSearchText.toLowerCase())
    );

    const renderHeader = (title, count, searchPlaceholder, onSearchChange, onCreateClick, buttonText) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #008080', paddingBottom: '10px' }}>
            <Space>
                <Title level={4} style={{ margin: 0, color: '#008080' }}>{title} ({count})</Title>
            </Space>
            <Space>
                <Input
                    placeholder={searchPlaceholder}
                    prefix={<SearchOutlined />}
                    onChange={e => onSearchChange(e.target.value)}
                    style={{ width: 250 }}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={onCreateClick} style={{ backgroundColor: '#008080', borderColor: '#008080' }}>
                    {buttonText}
                </Button>
            </Space>
        </div>
    );

    const tabItems = [
        {
            key: '1',
            label: 'Ledgers',
            children: (
                <>
                    {renderHeader("Ledgers", filteredLedgers.length, "Search Ledgers...", setLedgerSearchText, () => {
                        setEditingLedger(null);
                        setLedgerDrawerVisible(true);
                    }, "Create Ledger")}
                    <Table
                        dataSource={filteredLedgers}
                        columns={ledgerColumns}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 12 }}
                        size="small"
                        bordered
                        onRow={(record) => ({
                            onClick: () => navigate(`/ledger-vouchers/${record.id}`)
                        })}
                    />
                </>
            )
        },
        {
            key: '2',
            label: 'Groups',
            children: (
                <>
                    {renderHeader("Groups", filteredGroups.length, "Search Groups...", setGroupSearchText, () => setGroupModalVisible(true), "Create Group")}
                    <Table
                        dataSource={filteredGroups}
                        columns={groupColumns}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 12 }}
                        size="small"
                        bordered
                    />
                </>
            )
        }
    ];

    return (
        <div style={{ padding: '20px', backgroundColor: '#fdfadd', minHeight: '100vh', fontFamily: 'Arial' }}>
            <Card style={{ border: '1px solid #a0a0a0', borderRadius: 0 }}>
                <div style={{ marginBottom: 20 }}>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} type="text">Back to Gateway</Button>
                </div>

                <Tabs
                    defaultActiveKey="1"
                    items={tabItems}
                    type="card"
                    style={{ marginTop: 10 }}
                />
            </Card>

            <LedgerDrawer 
                visible={ledgerDrawerVisible}
                onClose={() => {
                    setLedgerDrawerVisible(false);
                    setEditingLedger(null);
                }}
                editingLedger={editingLedger}
                onSuccess={fetchData}
                groups={groups}
            />

            {/* Create Group Modal */}
            <Modal
                title="Create New Group"
                open={groupModalVisible}
                onCancel={() => setGroupModalVisible(false)}
                footer={null}
            >
                <Form form={groupForm} layout="vertical" onFinish={handleCreateGroup}>
                    <Form.Item name="name" label="Group Name" rules={[{ required: true, message: 'Please enter group name' }]}>
                        <Input placeholder="e.g. Marketing Expenses, Staff Welfare" />
                    </Form.Item>

                    <Form.Item name="parent_id" label="Under (Parent Group)">
                        <Select showSearch allowClear placeholder="Select a parent group (leave empty for Primary)" filterOption={(input, option) => option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0}>
                            {groups.map(g => <Option key={g.id} value={g.id}>{g.name}</Option>)}
                        </Select>
                    </Form.Item>

                    <Form.Item>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={() => setGroupModalVisible(false)}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={loading} style={{ backgroundColor: '#008080', borderColor: '#008080' }}>
                                Create Group
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AccountsInfo;
