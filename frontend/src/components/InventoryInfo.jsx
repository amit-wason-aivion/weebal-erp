import React, { useState, useEffect } from 'react';
import { Table, Button, Drawer, Form, Input, Select, InputNumber, Space, Typography, message, Card, Tag, Tabs, Modal, Row, Col } from 'antd';
import { PlusOutlined, SearchOutlined, ArrowLeftOutlined, ShoppingCartOutlined, InboxOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useCompany } from '../context/CompanyContext';

const { Title, Text } = Typography;
const { Option } = Select;

const InventoryInfo = () => {
    const { activeCompany } = useCompany();
    const [items, setItems] = useState([]);
    const [uoms, setUoms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [itemDrawerVisible, setItemDrawerVisible] = useState(false);
    const [uomModalVisible, setUomModalVisible] = useState(false);
    const [itemSearchText, setItemSearchText] = useState('');
    const [uomSearchText, setUomSearchText] = useState('');
    const [itemForm] = Form.useForm();
    const [uomForm] = Form.useForm();
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
            const [itemRes, uomRes] = await Promise.all([
                axios.get('/api/stock-items', config),
                axios.get('/api/uoms', config)
            ]);
            setItems(itemRes.data);
            setUoms(uomRes.data);
        } catch (error) {
            message.error("Failed to fetch inventory data");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateItem = async (values) => {
        setLoading(true);
        try {
            const payload = { ...values, company_id: activeCompany?.id };
            await axios.post('/api/inventory/items', payload);
            message.success("Stock Item created successfully");
            setItemDrawerVisible(false);
            itemForm.resetFields();
            fetchData();
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to create stock item");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUOM = async (values) => {
        setLoading(true);
        try {
            const payload = { ...values, company_id: activeCompany?.id };
            await axios.post('/api/uoms', payload);
            message.success("Unit of Measure created successfully");
            setUomModalVisible(false);
            uomForm.resetFields();
            fetchData();
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to create UOM");
        } finally {
            setLoading(false);
        }
    };

    const itemColumns = [
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
        },
        {
            title: 'Main Unit',
            dataIndex: 'main_unit_name',
            key: 'main_unit_name',
            render: (val) => val || '-'
        },
        {
            title: 'Sub Unit',
            dataIndex: 'sub_unit_name',
            key: 'sub_unit_name',
            render: (val) => val || '-'
        },
        {
            title: 'Factor',
            dataIndex: 'conversion_factor',
            key: 'conversion_factor',
            render: (val) => val || 1
        }
    ];

    const uomColumns = [
        {
            title: 'Symbol',
            dataIndex: 'symbol',
            key: 'symbol',
            sorter: (a, b) => a.symbol.localeCompare(b.symbol),
            render: (text) => <Text strong style={{ color: '#008080' }}>{text}</Text>
        },
        {
            title: 'Formal Name',
            dataIndex: 'formal_name',
            key: 'formal_name',
            render: (text) => text || '-'
        }
    ];

    const filteredItems = items.filter(i => 
        i.name.toLowerCase().includes(itemSearchText.toLowerCase()) ||
        (i.hsn_sac && i.hsn_sac.includes(itemSearchText))
    );

    const filteredUoms = uoms.filter(u => 
        u.symbol.toLowerCase().includes(uomSearchText.toLowerCase()) ||
        (u.formal_name && u.formal_name.toLowerCase().includes(uomSearchText.toLowerCase()))
    );

    const ItemsTab = (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <Input 
                    placeholder="Search Items/HSN..." 
                    prefix={<SearchOutlined />} 
                    onChange={e => setItemSearchText(e.target.value)}
                    style={{ width: 250 }}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setItemDrawerVisible(true)} style={{ backgroundColor: '#008080', borderColor: '#008080' }}>
                    Create Stock Item
                </Button>
            </div>
            <Table 
                dataSource={filteredItems} 
                columns={itemColumns} 
                rowKey="id" 
                loading={loading}
                pagination={{ pageSize: 12 }}
                size="small"
                bordered
            />
        </Space>
    );

    const UomsTab = (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <Input 
                    placeholder="Search UOMs..." 
                    prefix={<SearchOutlined />} 
                    onChange={e => setUomSearchText(e.target.value)}
                    style={{ width: 250 }}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setUomModalVisible(true)} style={{ backgroundColor: '#008000', borderColor: '#008000' }}>
                    Create UOM
                </Button>
            </div>
            <Table 
                dataSource={filteredUoms} 
                columns={uomColumns} 
                rowKey="id" 
                loading={loading}
                pagination={{ pageSize: 12 }}
                size="small"
                bordered
            />
        </Space>
    );

    return (
        <div style={{ padding: '20px', backgroundColor: '#fdfadd', minHeight: '100vh', fontFamily: 'Arial' }}>
            <Card style={{ border: '1px solid #a0a0a0', borderRadius: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '2px solid #008080', paddingBottom: '10px' }}>
                    <Space>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} type="text" />
                        <Title level={4} style={{ margin: 0, color: '#008080' }}>Inventory Information</Title>
                    </Space>
                    {activeCompany && <Text type="secondary">Company: {activeCompany.name}</Text>}
                </div>

                <Tabs defaultActiveKey="1">
                    <Tabs.TabPane tab={<span><ShoppingCartOutlined />Stock Items</span>} key="1">
                        {ItemsTab}
                    </Tabs.TabPane>
                    <Tabs.TabPane tab={<span><InboxOutlined />Units of Measure</span>} key="2">
                        {UomsTab}
                    </Tabs.TabPane>
                </Tabs>
            </Card>

            <Drawer
                title="Create New Stock Item"
                width={400}
                onClose={() => setItemDrawerVisible(false)}
                open={itemDrawerVisible}
                bodyStyle={{ paddingBottom: 80 }}
            >
                <Form form={itemForm} layout="vertical" onFinish={handleCreateItem} initialValues={{ gst_rate: 18 }}>
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

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="main_unit_name" label="Main Unit Name (e.g. Box)">
                                <Input placeholder="Box" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="sub_unit_name" label="Sub Unit Name (e.g. Strip)">
                                <Input placeholder="Strip" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="conversion_factor" label="Conversion Factor" initialValue={1}>
                                <InputNumber min={1} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="min_stock_level" label="Re-order Level" initialValue={0}>
                                <InputNumber min={0} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    {activeCompany?.company_type === 'PHARMA' && (
                        <>
                            <Divider orientation="left" style={{ borderColor: '#008080', margin: '10px 0' }}>
                                <Text strong style={{ color: '#008080', fontSize: '11px' }}>PHARMA / DRUG DETAILS</Text>
                            </Divider>

                            <Form.Item name="salt_composition" label="Salt Composition">
                                <Input placeholder="e.g. Paracetamol + Caffeine" />
                            </Form.Item>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="rack_number" label="Rack / Shelf No.">
                                        <Input placeholder="A-101" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Space style={{ marginTop: 30 }}>
                                        <Form.Item name="is_narcotic" valuePropName="checked" noStyle>
                                            <Switch size="small" />
                                        </Form.Item>
                                        <Text size="small">Narcotic</Text>

                                        <Form.Item name="is_h1" valuePropName="checked" noStyle>
                                            <Switch size="small" />
                                        </Form.Item>
                                        <Text size="small">H1 Drug</Text>
                                    </Space>
                                </Col>
                            </Row>
                        </>
                    )}

                    <Form.Item>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={() => setItemDrawerVisible(false)}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={loading} style={{ backgroundColor: '#008080', borderColor: '#008080' }}>
                                Create
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Drawer>

            <Modal
                title="Create New Unit of Measure (UOM)"
                open={uomModalVisible}
                onCancel={() => setUomModalVisible(false)}
                footer={null}
            >
                <Form form={uomForm} layout="vertical" onFinish={handleCreateUOM}>
                    <Form.Item name="symbol" label="Symbol" rules={[{ required: true, message: 'e.g. NOS, KGS, PCS' }]}>
                        <Input placeholder="Uppercase symbol" />
                    </Form.Item>
                    <Form.Item name="formal_name" label="Formal Name" rules={[{ required: true, message: 'e.g. Numbers, Kilograms, Pieces' }]}>
                        <Input placeholder="Full name of unit" />
                    </Form.Item>
                    <Form.Item>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={() => setUomModalVisible(false)}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={loading} style={{ backgroundColor: '#008000', borderColor: '#008000' }}>
                                Create UOM
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default InventoryInfo;
