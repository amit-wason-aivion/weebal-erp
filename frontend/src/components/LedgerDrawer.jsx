import React, { useState, useEffect } from 'react';
import { Drawer, Form, Input, Select, InputNumber, Switch, Space, Typography, message, Tabs, Modal, Row, Col, Divider, Badge, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import axios from '../api/axios';
import { useCompany } from '../context/CompanyContext';

const { Title, Text } = Typography;
const { Option } = Select;

const LedgerDrawer = ({ visible, onClose, editingLedger, onSuccess, groups, initialGroupId }) => {
    const { activeCompany } = useCompany();
    const [ledgerForm] = Form.useForm();
    const [revisionForm] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [salaryHistory, setSalaryHistory] = useState([]);
    const [wageRatio, setWageRatio] = useState(0);
    const [isRevisionModalVisible, setIsRevisionModalVisible] = useState(false);
    const [isMonitoring, setIsMonitoring] = useState(false);

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
        if (visible) {
            if (editingLedger) {
                ledgerForm.setFieldsValue({
                    ...editingLedger,
                    group_id: editingLedger.group_id
                });
                setIsMonitoring(editingLedger.monitoring_enabled || false);
                
                if (isEmployeeOnly) {
                    fetchSalaryHistory(editingLedger.id);
                    calculateWageCompliance();
                }
            } else {
                ledgerForm.resetFields();
                if (initialGroupId) {
                    ledgerForm.setFieldsValue({ group_id: initialGroupId });
                }
            }
        }
    }, [visible, editingLedger, ledgerForm, initialGroupId]);

    const fetchSalaryHistory = async (ledgerId) => {
        try {
            const res = await axios.get(`/api/ledgers/${ledgerId}/salary-history`);
            setSalaryHistory(res.data);
        } catch (error) {
            console.error("Failed to fetch salary history", error);
        }
    };

    const calculateWageCompliance = () => {
        const values = ledgerForm.getFieldsValue();
        const basic = parseFloat(values.basic_pay) || 0;
        const da = parseFloat(values.da_pay) || 0;
        const ctc = parseFloat(values.total_ctc) || 0;
        
        if (ctc > 0) {
            setWageRatio(((basic + da) / ctc) * 100);
        } else {
            setWageRatio(0);
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
            onSuccess();
            onClose();
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to save ledger");
        } finally {
            setLoading(false);
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
            onSuccess();
        } catch (error) {
            message.error("Failed to add revision");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Drawer
                title={editingLedger ? "Edit Ledger" : "Create New Ledger"}
                width={500}
                onClose={onClose}
                open={visible}
            >
                <Tabs defaultActiveKey="main">
                    <Tabs.TabPane tab="General Info" key="main">
                        <Form 
                            form={ledgerForm} 
                            layout="vertical" 
                            onFinish={handleCreateLedger} 
                            initialValues={{ is_debit_balance: true, opening_balance: 0, monitoring_enabled: false, country: 'India' }}
                            onValuesChange={(changed) => {
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
                                            <Form.Item name="country" label="Country" rules={[{ required: true }]}>
                                                <Select showSearch>
                                                    <Option value="India">India</Option>
                                                    <Option value="USA">USA</Option>
                                                    <Option value="UK">UK</Option>
                                                    <Option value="UAE">UAE</Option>
                                                    <Option value="Australia">Australia</Option>
                                                    <Option value="Canada">Canada</Option>
                                                    <Option value="Germany">Germany</Option>
                                                    <Option value="France">France</Option>
                                                    <Option value="China">China</Option>
                                                    <Option value="Japan">Japan</Option>
                                                    <Option value="Singapore">Singapore</Option>
                                                    <Option value="Other">Other</Option>
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="iec_code" label="IEC Code">
                                                <Input placeholder="Import Export Code" />
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
                                    <Button onClick={onClose}>Cancel</Button>
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
        </>
    );
};

export default LedgerDrawer;
