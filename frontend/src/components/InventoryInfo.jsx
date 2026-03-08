import React, { useState, useEffect } from 'react';
import { Table, Button, Drawer, Form, Input, Select, InputNumber, Space, Typography, message, Card, Tag } from 'antd';
import { PlusOutlined, SearchOutlined, ArrowLeftOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;

const InventoryInfo = () => {
    const [items, setItems] = useState([]);
    const [uoms, setUoms] = useState([]);
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
            const [itemRes, uomRes] = await Promise.all([
                axios.get('http://localhost:8000/api/stock-items'),
                axios.get('http://localhost:8000/api/uoms')
            ]);
            setItems(itemRes.data);
            setUoms(uomRes.data);
        } catch (error) {
            message.error("Failed to fetch inventory data");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (values) => {
        setLoading(true);
        try {
            await axios.post('http://localhost:8000/api/inventory/items', values);
            message.success("Stock Item created successfully");
            setDrawerVisible(false);
            form.resetFields();
            fetchData();
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to create stock item");
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Item Name',
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => a.name.localeCompare(b.name),
            render: (text) => (
                <Space>
                    <ShoppingCartOutlined style={{ color: '#008080' }} />
                    <Text strong style={{ color: '#000080' }}>{text}</Text>
                </Space>
            )
        },
        {
            title: 'HSN/SAC',
            dataIndex: 'hsn_sac',
            key: 'hsn_sac',
            render: (val) => val || '-'
        },
        {
            title: 'GST Rate',
            dataIndex: 'gst_rate',
            key: 'gst_rate',
            render: (rate) => <Tag color="blue">{rate}%</Tag>
        },
        {
            title: 'UOM',
            dataIndex: 'uom_id',
            key: 'uom_id',
            render: (uomId) => uoms.find(u => u.id === uomId)?.symbol || 'Unit'
        }
    ];

    const filteredItems = items.filter(i => 
        i.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (i.hsn_sac && i.hsn_sac.includes(searchText))
    );

    return (
        <div style={{ padding: '20px', backgroundColor: '#fdfadd', minHeight: '100vh', fontFamily: 'Arial' }}>
            <Card style={{ border: '1px solid #a0a0a0', borderRadius: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #008080', paddingBottom: '10px' }}>
                    <Space>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} type="text" />
                        <Title level={4} style={{ margin: 0, color: '#008080' }}>Inventory Information (Stock Items)</Title>
                    </Space>
                    <Space>
                        <Input 
                            placeholder="Search Items/HSN..." 
                            prefix={<SearchOutlined />} 
                            onChange={e => setSearchText(e.target.value)}
                            style={{ width: 250 }}
                        />
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerVisible(true)} style={{ backgroundColor: '#008080', borderColor: '#008080' }}>
                            Create Stock Item
                        </Button>
                    </Space>
                </div>

                <Table 
                    dataSource={filteredItems} 
                    columns={columns} 
                    rowKey="id" 
                    loading={loading}
                    pagination={{ pageSize: 12 }}
                    size="small"
                    bordered
                />
            </Card>

            <Drawer
                title="Create New Stock Item"
                width={400}
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
                bodyStyle={{ paddingBottom: 80 }}
            >
                <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ gst_rate: 18 }}>
                    <Form.Item name="name" label="Item Name" rules={[{ required: true, message: 'Please enter item name' }]}>
                        <Input placeholder="e.g. Paracetamol 500mg, Laptop Dell" />
                    </Form.Item>

                    <Form.Item name="hsn_sac" label="HSN/SAC Code">
                        <Input placeholder="e.g. 3004, 8471" />
                    </Form.Item>

                    <Form.Item name="gst_rate" label="GST Percentage (%)" rules={[{ required: true, message: 'Please enter GST rate' }]}>
                        <InputNumber min={0} max={100} style={{ width: '100%' }} precision={2} />
                    </Form.Item>

                    <Form.Item name="uom_id" label="Unit of Measure (UOM)" rules={[{ required: true, message: 'Please select a UOM' }]}>
                        <Select placeholder="Select UOM">
                            {uoms.map(u => <Option key={u.id} value={u.id}>{u.symbol} ({u.formal_name})</Option>)}
                        </Select>
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

export default InventoryInfo;
