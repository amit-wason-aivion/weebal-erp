import React, { useState, useEffect } from 'react';
import { Table, Button, Drawer, Form, Input, Select, InputNumber, Switch, Space, Typography, message, Card, Tabs, Modal, Row, Col, Divider, Tooltip, Badge } from 'antd';
import { PlusOutlined, SearchOutlined, ArrowLeftOutlined, LinkOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useCompany } from '../context/CompanyContext';

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
    const [ledgerForm] = Form.useForm();
    const [groupForm] = Form.useForm();
    const [revisionForm] = Form.useForm();
    const [salaryHistory, setSalaryHistory] = useState([]);
    const [wageRatio, setWageRatio] = useState(0);
    const [isRevisionModalVisible, setIsRevisionModalVisible] = useState(false);
    const [isMonitoring, setIsMonitoring] = useState(false);
    const navigate = useNavigate();

    // Watch group selection to show tax/address fields
    const selectedGroupId = Form.useWatch('group_id', ledgerForm);
    const selectedGroup = groups.find(g => String(g.id) === String(selectedGroupId));
    const showTaxDetails = selectedGroup?.name?.toLowerCase().includes('debtors') ||
        selectedGroup?.name?.toLowerCase().includes('creditors') ||
        selectedGroup?.name?.toLowerCase().includes('bank accounts') ||
        selectedGroup?.name?.toLowerCase().includes('branch') ||
        selectedGroup?.name?.toLowerCase().includes('loans');
    
    const isStatutoryOnly = selectedGroup?.name?.toLowerCase().includes('duties & taxes');
    const isEmployeeOnly = selectedGroup?.name?.toLowerCase().includes('salary expenses') || 
        selectedGroup?.name?.toLowerCase().includes('employee cost');

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

    const handleCreateLedger = async (values) => {
        setLoading(true);
        try {
            const payload = { ...values, company_id: activeCompany?.id };
            if (editingLedger) {
                await axios.put(`/api/ledgers/${editingLedger.id}`, payload);
                message.success("Ledger updated successfully");
            } else {
                await axios.post('/api/ledgers', payload);
                message.success("Ledger created successfully");
            }
            setLedgerDrawerVisible(false);
            setEditingLedger(null);
            ledgerForm.resetFields();
            fetchData();
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to save ledger");
        } finally {
            setLoading(false);
        }
    };

    const calculateWageCompliance = () => {
        const values = ledgerForm.getFieldsValue();
        const basic = parseFloat(values.basic_pay) || 0;
        const da = parseFloat(values.da_pay) || 0;
        const ctc = parseFloat(values.total_ctc) || 0;
        
        if (ctc > 0) {
            const ratio = ((basic + da) / ctc) * 100;
            setWageRatio(ratio);
        } else {
            setWageRatio(0);
        }
    };

    const fetchSalaryHistory = async (ledgerId) => {
        try {
            const res = await axios.get(`/api/ledgers/${ledgerId}/salary-history`);
            setSalaryHistory(res.data);
        } catch (error) {
            console.error("Failed to fetch salary history", error);
        }
    };

    const handleAddRevision = async (values) => {
        setLoading(true);
        try {
            await axios.post(`/api/ledgers/${editingLedger.id}/salary-history`, values);
            message.success("Salary revision added successfully");
            setIsRevisionModalVisible(false);
            revisionForm.resetFields();
            fetchSalaryHistory(editingLedger.id);
            fetchData();
        } catch (error) {
            message.error("Failed to add revision");
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
                        ledgerForm.setFieldsValue({
                            ...record,
                            group_id: record.group_id
                        });
                        
                        // Advanced Payroll Info
                        const groupName = groups.find(g => String(g.id) === String(record.group_id))?.name || '';
                        if (groupName.toLowerCase().includes('salary expenses') || groupName.toLowerCase().includes('employee cost')) {
                            fetchSalaryHistory(record.id);
                            const basic = parseFloat(record.basic_pay) || 0;
                            const da = parseFloat(record.da_pay) || 0;
                            const ctc = parseFloat(record.total_ctc) || 0;
                            if (ctc > 0) {
                                setWageRatio(((basic + da) / ctc) * 100);
                            }
                        }

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

    const items = [
        {
            key: '1',
            label: 'Ledgers',
            children: (
                <>
                    {renderHeader("Ledgers", filteredLedgers.length, "Search Ledgers...", setLedgerSearchText, () => {
                        setEditingLedger(null);
                        ledgerForm.resetFields();
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
                    items={items}
                    type="card"
                    style={{ marginTop: 10 }}
                />
            </Card>

            {/* Create Ledger Drawer */}
            <Drawer
                title={editingLedger ? "Edit Ledger" : "Create New Ledger"}
                width={500}
                onClose={() => {
                    setLedgerDrawerVisible(false);
                    setEditingLedger(null);
                }}
                open={ledgerDrawerVisible}
            >
                <Tabs defaultActiveKey="main">
                    <Tabs.TabPane tab="General Info" key="main">
                        <Form 
                            form={ledgerForm} 
                            layout="vertical" 
                            onFinish={handleCreateLedger} 
                            initialValues={{ is_debit_balance: true, opening_balance: 0, monitoring_enabled: false }}
                            onValuesChange={(changed, all) => {
                                if ('basic_pay' in changed || 'da_pay' in changed || 'total_ctc' in changed) {
                                    calculateWageCompliance();
                                }
                                if ('monitoring_enabled' in changed) {
                                    setIsMonitoring(changed.monitoring_enabled);
                                }
                            }}
                        >
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
                                        <InputNumber min={0} style={{ width: 300 }} precision={2} disabled={editingLedger && salaryHistory.length > 0} />
                                    </Form.Item>
                                    <Form.Item name="is_debit_balance" valuePropName="checked" noStyle>
                                        <Switch checkedChildren="Dr" unCheckedChildren="Cr" />
                                    </Form.Item>
                                </Space>
                                {editingLedger && salaryHistory.length > 0 && <Text type="secondary" block style={{ fontSize: '11px' }}>Opening balance is locked. Use Salary Revisions to update CTC.</Text>}
                            </Form.Item>

                            {showTaxDetails && (
                                <>
                                    <Divider orientation="left" style={{ borderColor: '#008080' }}>
                                        <Text strong style={{ color: '#008080', fontSize: '12px' }}>TAX & ADDRESS DETAILS</Text>
                                    </Divider>

                                    <Form.Item name="address" label="Address">
                                        <Input.TextArea rows={2} placeholder="Full building/street address" />
                                    </Form.Item>

                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item name="city" label="City">
                                                <Input placeholder="City" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="state" label="State">
                                                <Input placeholder="State" />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item name="pincode" label="Pincode">
                                                <Input placeholder="6-digit ZIP" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item
                                                name="gstin"
                                                label="GSTIN"
                                                rules={[
                                                    {
                                                        pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
                                                        message: 'Invalid GSTIN format'
                                                    }
                                                ]}
                                            >
                                                <Input placeholder="e.g. 27AAAAA0000A1Z5" />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item name="pan_no" label="PAN No.">
                                                <Input placeholder="PAN" />
                                            </Form.Item>
                                        </Col>
                                        {activeCompany?.company_type === 'PHARMA' && (
                                            <Col span={12}>
                                                <Form.Item name="drug_license_no" label="Drug License No.">
                                                    <Input placeholder="DL No." />
                                                </Form.Item>
                                            </Col>
                                        )}
                                    </Row>

                                    {activeCompany?.company_type === 'PHARMA' && (
                                        <Row gutter={16}>
                                            <Col span={12}>
                                                <Form.Item name="fssai_no" label="FSSAI No.">
                                                    <Input placeholder="FSSAI Number" />
                                                </Form.Item>
                                            </Col>
                                        </Row>
                                    )}

                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item name="phone" label="Phone No.">
                                                <Input placeholder="Contact" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="email" label="Email ID" rules={[{ type: 'email', message: 'Invalid email' }]}>
                                                <Input placeholder="Email" />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </>
                            )}

                            {isStatutoryOnly && (
                                <>
                                    <Divider orientation="left" style={{ borderColor: '#008080' }}>
                                        <Text strong style={{ color: '#008080', fontSize: '12px' }}>STATUTORY DETAILS</Text>
                                    </Divider>

                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item name="tax_type" label="Tax Type">
                                                <Select placeholder="e.g. GST, TDS, VAT">
                                                    <Select.Option value="GST">GST</Select.Option>
                                                    <Select.Option value="TDS">TDS</Select.Option>
                                                    <Select.Option value="TCS">TCS</Select.Option>
                                                    <Select.Option value="VAT">VAT</Select.Option>
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="tax_percentage" label="Percentage (%)">
                                                <InputNumber min={0} max={100} style={{ width: '100%' }} precision={2} placeholder="e.g. 18.0" />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item name="tax_head" label="Tax Head">
                                                <Select placeholder="Input / Output">
                                                    <Select.Option value="Input">Input</Select.Option>
                                                    <Select.Option value="Output">Output</Select.Option>
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </>
                            )}

                            {isEmployeeOnly && (
                                <>
                                    <Divider orientation="left" style={{ borderColor: '#008080' }}>
                                        <Text strong style={{ color: '#008080', fontSize: '13px' }}>**Employee & Payment Info**</Text>
                                    </Divider>

                                    <div style={{ border: '2px solid #b22222', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
                                        <Row gutter={16} align="middle">
                                            <Col span={18}>
                                                <Title level={5} style={{ margin: 0 }}>Wage Compliance</Title>
                                            </Col>
                                            <Col span={6}>
                                                <Badge 
                                                    count={`${wageRatio.toFixed(1)}%`} 
                                                    style={{ backgroundColor: wageRatio < 50 ? '#faad14' : '#52c41a' }} 
                                                />
                                            </Col>
                                        </Row>
                                        {wageRatio < 50 && (
                                            <Text type="warning" style={{ fontSize: '11px', display: 'block', marginBottom: '10px' }}>
                                                Compliance Alert: Allowances exceed 50% threshold. Excess will be considered as Wages for PF/ESI.
                                            </Text>
                                        )}

                                        <Row gutter={16}>
                                            <Col span={12}><Form.Item name="basic_pay" label="Basic Pay"><InputNumber style={{ width: '100%' }} onChange={calculateWageCompliance} /></Form.Item></Col>
                                            <Col span={12}><Form.Item name="da_pay" label="DA Pay"><InputNumber style={{ width: '100%' }} onChange={calculateWageCompliance} /></Form.Item></Col>
                                        </Row>
                                        <Row gutter={16}>
                                            <Col span={12}><Form.Item name="total_ctc" label="Total CTC"><InputNumber style={{ width: '100%' }} onChange={calculateWageCompliance} /></Form.Item></Col>
                                            <Col span={12}><Form.Item name="hra_pay" label="HRA"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                                        </Row>

                                        <Divider style={{ margin: '10px 0' }} />

                                        <Row gutter={16}>
                                            <Col span={12}><Form.Item name="employee_id" label="Employee ID"><Input placeholder="WBL-042" /></Form.Item></Col>
                                            <Col span={12}><Form.Item name="bank_name" label="Bank Name"><Input placeholder="HDFC Bank" /></Form.Item></Col>
                                        </Row>
                                        <Row gutter={16}>
                                            <Col span={12}><Form.Item name="designation" label="Designation">
                                                <Select placeholder="Select Designation">
                                                    <Select.Option value="Sr. Software Engineer">Sr. Software Engineer</Select.Option>
                                                    <Select.Option value="Developer">Developer</Select.Option>
                                                    <Select.Option value="Sales Executive">Sales Executive</Select.Option>
                                                    <Select.Option value="HR Manager">HR Manager</Select.Option>
                                                    <Select.Option value="Accountant">Accountant</Select.Option>
                                                </Select>
                                            </Form.Item></Col>
                                            <Col span={12}><Form.Item name="account_no" label="Account No."><Input placeholder="XXXXXX1234" /></Form.Item></Col>
                                        </Row>
                                        <Row gutter={16}>
                                            <Col span={12}>
                                                <Form.Item 
                                                    name="pan_no" 
                                                    label="PAN No."
                                                    rules={[{ pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, message: 'Invalid PAN format' }]}
                                                >
                                                    <Input placeholder="AXXXX0000Z" maxLength={10} style={{ backgroundColor: '#f5f5f5' }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item 
                                                    name="ifsc_code" 
                                                    label="IFSC Code"
                                                    rules={[{ pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/, message: 'Invalid IFSC format' }]}
                                                >
                                                    <Input placeholder="HDFC0001234" maxLength={11} />
                                                </Form.Item>
                                            </Col>
                                        </Row>

                                        <Divider style={{ margin: '10px 0' }} />
                                        
                                        <Space style={{ marginBottom: 15 }}>
                                            <Form.Item name="monitoring_enabled" valuePropName="checked" noStyle>
                                                <Switch onChange={(checked) => setIsMonitoring(checked)} />
                                            </Form.Item>
                                            <Text strong>Enable Monitoring Mode</Text>
                                        </Space>

                                        {isMonitoring && (
                                            <Row gutter={16}>
                                                <Col span={12}>
                                                    <Form.Item name="attendance_source" label="Attendance Source">
                                                        <Select>
                                                            <Option value="Manual">Manual</Option>
                                                            <Option value="Biometric">Biometric</Option>
                                                            <Option value="Geofence">Geofence</Option>
                                                        </Select>
                                                    </Form.Item>
                                                </Col>
                                                <Col span={12}>
                                                    <Form.Item name="shift_type" label="Shift Type">
                                                        <Select>
                                                            <Option value="General">General</Option>
                                                            <Option value="Night">Night</Option>
                                                            <Option value="Rotating">Rotating</Option>
                                                        </Select>
                                                    </Form.Item>
                                                </Col>
                                            </Row>
                                        )}
                                    </div>
                                </>
                            )}

                            <Form.Item style={{ marginTop: 20 }}>
                                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                                    <Button onClick={() => setLedgerDrawerVisible(false)}>Cancel</Button>
                                    <Button type="primary" htmlType="submit" loading={loading} style={{ backgroundColor: '#008080', borderColor: '#008080' }}>
                                        {editingLedger ? "Update" : "Create"}
                                    </Button>
                                </Space>
                            </Form.Item>
                        </Form>
                    </Tabs.TabPane>

                    {isEmployeeOnly && editingLedger && (
                        <Tabs.TabPane tab="Salary History" key="history">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15 }}>
                                <Text strong>Revision Log</Text>
                                <Button size="small" icon={<PlusOutlined />} onClick={() => setIsRevisionModalVisible(true)}>
                                    Add Revision
                                </Button>
                            </div>
                            <Table 
                                dataSource={salaryHistory} 
                                size="small" 
                                pagination={false}
                                columns={[
                                    { title: 'Date', dataIndex: 'effective_date', key: 'date' },
                                    { title: 'New Salary', dataIndex: 'new_salary', key: 'salary', render: val => val.toLocaleString('en-IN') },
                                    { title: 'Change %', dataIndex: 'change_percentage', key: 'change', render: val => `${val}%` }
                                ]}
                            />
                        </Tabs.TabPane>
                    )}
                </Tabs>
            </Drawer>

            <Modal
                title="New Salary Revision"
                open={isRevisionModalVisible}
                onCancel={() => setIsRevisionModalVisible(false)}
                onOk={() => revisionForm.submit()}
                confirmLoading={loading}
            >
                <Form form={revisionForm} layout="vertical" onFinish={handleAddRevision}>
                    <Form.Item name="effective_date" label="Effective Date" rules={[{ required: true }]}>
                        <Input type="date" />
                    </Form.Item>
                    <Form.Item name="new_salary" label="New Total CTC" rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                </Form>
            </Modal>

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
