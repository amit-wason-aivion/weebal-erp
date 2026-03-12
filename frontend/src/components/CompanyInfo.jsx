import React, { useState, useEffect } from 'react';
import { Card, Typography, List, Button, Form, Input, DatePicker, message, Modal, Space, Divider, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, PlusOutlined, DatabaseOutlined, ShopOutlined } from '@ant-design/icons';
import axios from '../api/axios';
import { useCompany } from '../context/CompanyContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const CompanyInfo = () => {
    const [companies, setCompanies] = useState([]);
    const [menu, setMenu] = useState('main'); // 'main', 'select', 'create', 'split', 'alter'
    const [loading, setLoading] = useState(false);
    const [isSplitModalVisible, setIsSplitModalVisible] = useState(false);
    const [selectedSplitCompany, setSelectedSplitCompany] = useState(null);
    const [editingCompany, setEditingCompany] = useState(null);
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const { selectCompany } = useCompany();
    const userRole = localStorage.getItem('role');
    const companyTypeWatch = Form.useWatch('company_type', form);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            const response = await axios.get('/api/companies');
            setCompanies(response.data);
        } catch (error) {
            message.error("Failed to fetch companies");
        }
    };

    const onCreateFinish = async (values) => {
        setLoading(true);
        try {
            const payload = {
                ...values,
                financial_year_from: values.financial_year_from.format('YYYY-MM-DD'),
                books_beginning_from: values.books_beginning_from.format('YYYY-MM-DD')
            };
            
            if (editingCompany) {
                await axios.put(`/api/companies/${editingCompany.id}`, payload);
                message.success("Company updated successfully!");
                setEditingCompany(null);
            } else {
                await axios.post('/api/companies', payload);
                message.success("Company created successfully!");
            }
            
            fetchCompanies();
            setMenu('main');
            form.resetFields();
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to save company");
        } finally {
            setLoading(false);
        }
    };

    const showEditMode = (company) => {
        setEditingCompany(company);
        form.setFieldsValue({
            ...company,
            financial_year_from: dayjs(company.financial_year_from),
            books_beginning_from: dayjs(company.books_beginning_from)
        });
        setMenu('create');
    };
    
    const handleSplitCompany = async (values) => {
        setLoading(true);
        try {
            const payload = {
                new_financial_year_start: values.new_financial_year_start.format('YYYY-MM-DD')
            };
            await axios.post(`/api/companies/${selectedSplitCompany.id}/split`, payload);
            message.success("Company split successfully! New financial year created.");
            setIsSplitModalVisible(false);
            fetchCompanies();
            setMenu('main');
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to split company");
        } finally {
            setLoading(false);
        }
    };

    // Tally Aesthetic Styles
    const theme = {
        bg: '#fdfadd',
        teal: '#008080',
        border: '#a0a0a0',
        panelBg: '#ffffff',
        hotkey: '#ff0000'
    };

    const TallyMenuItem = ({ label, hotkeyChar, onClick }) => {
        const charIndex = label.toLowerCase().indexOf(hotkeyChar.toLowerCase());
        const prefix = label.substring(0, charIndex);
        const match = label.substring(charIndex, charIndex + 1);
        const suffix = label.substring(charIndex + 1);

        return (
            <div 
                onClick={onClick}
                style={{ padding: '8px 20px', cursor: 'pointer', textAlign: 'center', backgroundColor: '#fff', border: `1px solid ${theme.border}`, marginBottom: '-1px' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#000080'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.color = '#000'; }}
            >
                {prefix}
                <span style={{ color: theme.hotkey, fontWeight: 'bold' }}>{match}</span>
                {suffix}
            </div>
        );
    };

    return (
        <div style={{ padding: '20px 50px', backgroundColor: theme.bg, minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '500px' }}>
                <Space style={{ marginBottom: '20px' }}>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => {
                        if (menu === 'main') navigate('/');
                        else {
                            setMenu('main');
                            setEditingCompany(null);
                            form.resetFields();
                        }
                    }} type="text" />
                    <Title level={3} style={{ margin: 0, color: theme.teal }}>Company Info</Title>
                </Space>

                {menu === 'main' && (
                    <Card style={{ padding: 0, borderRadius: 0, border: `2px solid ${theme.teal}`, boxShadow: '4px 4px 0 rgba(0,0,0,0.1)' }}>
                        <div style={{ backgroundColor: theme.teal, color: 'white', textAlign: 'center', padding: '5px', fontWeight: 'bold' }}>Company Menu</div>
                        <TallyMenuItem label="Select Company" hotkeyChar="S" onClick={() => setMenu('select')} />
                        <TallyMenuItem label="Create Company" hotkeyChar="C" onClick={() => { setEditingCompany(null); form.resetFields(); setMenu('create'); }} />
                        <TallyMenuItem label="Alter Company" hotkeyChar="A" onClick={() => setMenu('alter')} />
                        {userRole === 'superadmin' && <TallyMenuItem label="Split Company" hotkeyChar="P" onClick={() => setMenu('split')} />}
                        <TallyMenuItem label="Back" hotkeyChar="B" onClick={() => navigate('/')} />
                    </Card>
                )}

                {menu === 'select' && (
                    <Card style={{ padding: 0, borderRadius: 0, border: `2px solid ${theme.teal}`, boxShadow: '4px 4px 0 rgba(0,0,0,0.1)' }}>
                        <div style={{ backgroundColor: theme.teal, color: 'white', textAlign: 'center', padding: '5px', fontWeight: 'bold' }}>List of Companies</div>
                        {companies.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', fontStyle: 'italic' }}>No Companies Found</div>
                        ) : (
                            <List
                                dataSource={companies}
                                renderItem={c => (
                                    <div 
                                        onClick={() => { selectCompany(c); navigate('/'); message.success(`Switched to ${c.name}`); }}
                                        style={{ padding: '10px 20px', cursor: 'pointer', borderBottom: `1px solid #ddd` }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#000080'; e.currentTarget.style.color = '#fff'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.color = '#000'; }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                                            <span style={{ fontSize: '10px', color: theme.teal, border: `1px solid ${theme.teal}`, padding: '0 4px', borderRadius: '2px' }}>{c.company_type}</span>
                                        </div>
                                        <div style={{ fontSize: '11px' }}>FY: {new Date(c.financial_year_from).getFullYear()} - {new Date(c.financial_year_from).getFullYear() + 1}</div>
                                    </div>
                                )}
                            />
                        )}
                    </Card>
                )}

                {menu === 'alter' && (
                    <Card style={{ padding: 0, borderRadius: 0, border: `2px solid ${theme.teal}`, boxShadow: '4px 4px 0 rgba(0,0,0,0.1)' }}>
                        <div style={{ backgroundColor: theme.teal, color: 'white', textAlign: 'center', padding: '5px', fontWeight: 'bold' }}>Select Company to Alter</div>
                        {companies.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', fontStyle: 'italic' }}>No Companies Found</div>
                        ) : (
                            <List
                                dataSource={companies}
                                renderItem={c => (
                                    <div 
                                        onClick={() => showEditMode(c)}
                                        style={{ padding: '10px 20px', cursor: 'pointer', borderBottom: `1px solid #ddd` }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#000080'; e.currentTarget.style.color = '#fff'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.color = '#000'; }}
                                    >
                                        <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                                        <div style={{ fontSize: '11px' }}>Type: {c.company_type}</div>
                                    </div>
                                )}
                            />
                        )}
                    </Card>
                )}

                {menu === 'create' && (
                    <Card style={{ borderRadius: 0, border: `2px solid ${theme.teal}`, width: '500px' }}>
                        <div style={{ backgroundColor: theme.teal, color: 'white', textAlign: 'center', padding: '5px', fontWeight: 'bold', marginBottom: '20px' }}>
                            {editingCompany ? 'Company Alteration' : 'Company Creation'}
                        </div>
                        <Form 
                            form={form} 
                            layout="vertical" 
                            onFinish={onCreateFinish} 
                            initialValues={{ 
                                financial_year_from: dayjs('2024-04-01'), 
                                books_beginning_from: dayjs('2024-04-01'),
                                company_type: 'GENERAL'
                            }}
                        >
                            <Form.Item name="name" label="Company Name" rules={[{ required: true }]}>
                                <Input placeholder="e.g., WEEBAL ERP" />
                            </Form.Item>
                            
                            <Form.Item name="company_type" label="Company Type (GENERAL / PHARMA)" rules={[{ required: true }]}>
                                <Select>
                                    <Select.Option value="GENERAL">GENERAL (Standard ERP)</Select.Option>
                                    <Select.Option value="PHARMA">PHARMA (Expiry, Batches, Salt Search)</Select.Option>
                                </Select>
                            </Form.Item>

                            <Form.Item name="address" label="Address">
                                <Input.TextArea rows={2} />
                            </Form.Item>
                            
                            <Space>
                                <Form.Item name="state" label="State"><Input /></Form.Item>
                                <Form.Item name="pin_code" label="Pincode"><Input /></Form.Item>
                            </Space>

                            {companyTypeWatch === 'PHARMA' && (
                                <Space>
                                    <Form.Item name="drug_license_no" label="Drug License No.">
                                        <Input placeholder="DL No." />
                                    </Form.Item>
                                    <Form.Item name="fssai_no" label="FSSAI No.">
                                        <Input placeholder="FSSAI No." />
                                    </Form.Item>
                                </Space>
                            )}
                            
                            <Divider style={{ margin: '10px 0' }} />
                            
                            <Space>
                                <Form.Item name="financial_year_from" label="Financial Year From" rules={[{ required: true }]}>
                                    <DatePicker style={{ width: '100%' }} />
                                </Form.Item>
                                <Form.Item name="books_beginning_from" label="Books Beginning From" rules={[{ required: true }]}>
                                    <DatePicker style={{ width: '100%' }} />
                                </Form.Item>
                            </Space>
                            
                            <Form.Item style={{ marginTop: '20px' }}>
                                <Button type="primary" htmlType="submit" loading={loading} block style={{ backgroundColor: theme.teal, borderColor: theme.teal }}>
                                    {editingCompany ? 'Update and Save' : 'Create and Save'}
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                )}

                <Modal
                    title="Financial Year Split"
                    open={isSplitModalVisible}
                    onCancel={() => setIsSplitModalVisible(false)}
                    footer={null}
                    width={400}
                >
                    <div style={{ marginBottom: '20px' }}>
                        <Text strong>Company:</Text> <Text>{selectedSplitCompany?.name}</Text>
                        <br />
                        <Text type="secondary">This will create a new company record for the next financial year and carry forward all ledger balances.</Text>
                    </div>
                    
                    <Form 
                        layout="vertical" 
                        onFinish={handleSplitCompany}
                        initialValues={{ 
                            new_financial_year_start: selectedSplitCompany ? dayjs(selectedSplitCompany.financial_year_from).add(1, 'year') : null
                        }}
                    >
                        <Form.Item 
                            name="new_financial_year_start" 
                            label="New Financial Year From" 
                            rules={[{ required: true }]}
                        >
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                        
                        <div style={{ textAlign: 'right', marginTop: '20px' }}>
                            <Button onClick={() => setIsSplitModalVisible(false)} style={{ marginRight: '10px' }}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={loading} style={{ backgroundColor: theme.teal, borderColor: theme.teal }}>
                                Start Split
                            </Button>
                        </div>
                    </Form>
                </Modal>
            </div>
        </div>
    );
};

export default CompanyInfo;
