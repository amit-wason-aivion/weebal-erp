import React, { useState, useEffect } from 'react';
import { Table, Button, Drawer, Form, Input, Select, InputNumber, Switch, Space, Typography, message, Card } from 'antd';
import { PlusOutlined, SearchOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;

const AccountsInfo = () => {
    const [ledgers, setLedgers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [form] = Form.useForm();
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [ledgerRes, groupRes] = await Promise.all([
                axios.get('http://localhost:8000/api/ledgers'),
                axios.get('http://localhost:8000/api/groups')
            ]);
            setLedgers(ledgerRes.data);
            setGroups(groupRes.data);
        } catch (error) {
            message.error("Failed to fetch data");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (values) => {
        setLoading(true);
        try {
            await axios.post('http://localhost:8000/api/ledgers', values);
            message.success("Ledger created successfully");
            setDrawerVisible(false);
            form.resetFields();
            fetchData();
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to create ledger");
        } finally {
            setLoading(false);
        }
    };

    const columns = [
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
            render: (groupId) => groups.find(g => g.id === groupId)?.name || 'Unknown'
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
        }
    ];

    const filteredLedgers = ledgers.filter(l => 
        l.name.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <div style={{ padding: '20px', backgroundColor: '#fdfadd', minHeight: '100vh', fontFamily: 'Arial' }}>
            <Card style={{ border: '1px solid #a0a0a0', borderRadius: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #008080', paddingBottom: '10px' }}>
                    <Space>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} type="text" />
                        <Title level={4} style={{ margin: 0, color: '#008080' }}>Accounts Information (Ledgers)</Title>
                    </Space>
                    <Space>
                        <Input 
                            placeholder="Search Ledgers..." 
                            prefix={<SearchOutlined />} 
                            onChange={e => setSearchText(e.target.value)}
                            style={{ width: 250 }}
                        />
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerVisible(true)} style={{ backgroundColor: '#008080', borderColor: '#008080' }}>
                            Create Ledger
                        </Button>
                    </Space>
                </div>

                <Table 
                    dataSource={filteredLedgers} 
                    columns={columns} 
                    rowKey="id" 
                    loading={loading}
                    pagination={{ pageSize: 12 }}
                    size="small"
                    bordered
                    onRow={(record) => ({
                        onClick: () => navigate(`/ledger-vouchers/${record.id}`)
                    })}
                />
            </Card>

            <Drawer
                title="Create New Ledger"
                width={400}
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
                bodyStyle={{ paddingBottom: 80 }}
            >
                <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ is_debit_balance: true, opening_balance: 0 }}>
                    <Form.Item name="name" label="Ledger Name" rules={[{ required: true, message: 'Please enter ledger name' }]}>
                        <Input placeholder="e.g. Sales A/c, HDFC Bank" />
                    </Form.Item>

                    <Form.Item name="group_id" label="Under (Group)" rules={[{ required: true, message: 'Please select a group' }]}>
                        <Select showSearch placeholder="Select a parent group" filterOption={(input, option) => option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0}>
                            {groups.map(g => <Option key={g.id} value={g.id}>{g.name}</Option>)}
                        </Select>
                    </Form.Item>

                    <Form.Item label="Opening Balance">
                        <Space>
                            <Form.Item name="opening_balance" noStyle>
                                <InputNumber min={0} style={{ width: 200 }} precision={2} />
                            </Form.Item>
                            <Form.Item name="is_debit_balance" valuePropName="checked" noStyle>
                                <Switch checkedChildren="Dr" unCheckedChildren="Cr" />
                            </Form.Item>
                        </Space>
                    </Form.Item>

                    <Form.Item>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={() => setDrawerVisible(false)}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={loading} style={{ backgroundColor: '#008080', borderColor: '#008080' }}>
                                Create
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Drawer>
        </div>
    );
};

export default AccountsInfo;
