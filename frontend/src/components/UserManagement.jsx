import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Checkbox, Space, Typography, message, Card, Divider } from 'antd';
import { UserAddOutlined, SecurityScanOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';

const { Title, Text } = Typography;

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null); // track if we are editing
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();
    const navigate = useNavigate();
    
    const role = localStorage.getItem('role');
    const isSuper = role === 'superadmin';

    useEffect(() => {
        fetchUsers();
        if (isSuper) fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            const response = await axios.get('/api/companies');
            setCompanies(response.data);
        } catch (error) {
            console.error("Failed to load companies");
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await axios.get('/api/users');
            setUsers(response.data);
        } catch (error) {
            message.error("Failed to load users");
        }
    };

    const handleSaveUser = async (values) => {
        setLoading(true);
        try {
            if (editingUser) {
                // Remove password if empty (don't update)
                const payload = { ...values };
                if (!payload.password) delete payload.password;
                
                await axios.patch(`/api/users/${editingUser.id}`, payload);
                message.success("User updated successfully!");
            } else {
                await axios.post('/api/users', values);
                message.success("User created successfully!");
            }
            setIsModalVisible(false);
            setEditingUser(null);
            form.resetFields();
            fetchUsers();
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to save user");
        } finally {
            setLoading(false);
        }
    };

    const showEditModal = (user) => {
        setEditingUser(user);
        form.setFieldsValue({
            username: user.username,
            role: user.role,
            company_id: user.company_id,
            can_view_reports: user.can_view_reports,
            can_manage_vouchers: user.can_manage_vouchers,
            can_manage_inventory: user.can_manage_inventory,
            can_manage_masters: user.can_manage_masters,
            password: "" // Keep empty for edit
        });
        setIsModalVisible(true);
    };

    const togglePermission = async (userId, field, currentVal) => {
        try {
            await axios.patch(`/api/users/${userId}`, { [field]: !currentVal });
            message.success("Permission updated");
            fetchUsers();
        } catch (error) {
            message.error("Failed to update permission");
        }
    };

    const columns = [
        { title: 'Username', dataIndex: 'username', key: 'username', render: (text) => <Text strong>{text}</Text> },
        { title: 'Role', dataIndex: 'role', key: 'role' },
        { 
            title: 'Company', 
            dataIndex: 'company_id', 
            key: 'company', 
            hidden: !isSuper,
            render: (cid) => companies.find(c => c.id === cid)?.name || 'N/A'
        },
        { 
            title: 'Reports', 
            dataIndex: 'can_view_reports', 
            key: 'reports',
            render: (val, record) => <Checkbox checked={val} onChange={() => togglePermission(record.id, 'can_view_reports', val)} />
        },
        { 
            title: 'Vouchers', 
            dataIndex: 'can_manage_vouchers', 
            key: 'vouchers',
            render: (val, record) => <Checkbox checked={val} onChange={() => togglePermission(record.id, 'can_manage_vouchers', val)} />
        },
        { 
            title: 'Inventory', 
            dataIndex: 'can_manage_inventory', 
            key: 'inventory',
            render: (val, record) => <Checkbox checked={val} onChange={() => togglePermission(record.id, 'can_manage_inventory', val)} />
        },
        { 
            title: 'Masters', 
            dataIndex: 'can_manage_masters', 
            key: 'masters',
            render: (val, record) => <Checkbox checked={val} onChange={() => togglePermission(record.id, 'can_manage_masters', val)} />
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <Button type="link" onClick={() => showEditModal(record)}>Edit / Reset Pwd</Button>
            )
        }
    ];

    return (
        <div style={{ padding: '30px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <Space size="middle">
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} />
                        <Title level={2} style={{ margin: 0 }}><SecurityScanOutlined /> User Management</Title>
                    </Space>
                    <Button type="primary" icon={<UserAddOutlined />} onClick={() => { setEditingUser(null); form.resetFields(); setIsModalVisible(true); }}>
                        Add New User
                    </Button>
                </div>
                
                <Table 
                    dataSource={users} 
                    columns={columns} 
                    rowKey="id" 
                    pagination={false}
                    bordered
                />

                <Modal
                    title={editingUser ? "Edit User / Reset Password" : "Create New User"}
                    open={isModalVisible}
                    onCancel={() => { setIsModalVisible(false); setEditingUser(null); }}
                    footer={null}
                >
                    <Form 
                        form={form} 
                        layout="vertical" 
                        onFinish={handleSaveUser} 
                        initialValues={{ role: 'user', can_view_reports: true, can_manage_vouchers: true, can_manage_inventory: true, can_manage_masters: true }}
                    >
                        <Form.Item name="username" label="Username" rules={[{ required: true }]}>
                            <Input prefix={<UserAddOutlined />} placeholder="Enter username" disabled={!!editingUser} />
                        </Form.Item>
                        <Form.Item name="password" label={editingUser ? "New Password (Leave blank to keep current)" : "Password"} rules={[{ required: !editingUser }]}>
                            <Input.Password placeholder={editingUser ? "Enter new password" : "Enter password"} />
                        </Form.Item>
                        <Form.Item name="role" label="Role">
                            <Select>
                                {isSuper && <Select.Option value="superadmin">Superadmin (Global)</Select.Option>}
                                <Select.Option value="admin">Admin (Company Manager)</Select.Option>
                                <Select.Option value="user">User (Employee)</Select.Option>
                            </Select>
                        </Form.Item>

                        {isSuper && (
                            <Form.Item name="company_id" label="Company" rules={[{ required: true, message: 'Select a company for this user' }]}>
                                <Select placeholder="Assign to Company" showSearch optionFilterProp="children">
                                    {companies.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
                                </Select>
                            </Form.Item>
                        )}
                        
                        <Divider orientation="left">Granular Permissions</Divider>
                        
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Form.Item name="can_view_reports" valuePropName="checked" noStyle>
                                <Checkbox>Can View Financial Reports</Checkbox>
                            </Form.Item>
                            <Form.Item name="can_manage_vouchers" valuePropName="checked" noStyle>
                                <Checkbox>Can Manage Vouchers</Checkbox>
                            </Form.Item>
                            <Form.Item name="can_manage_inventory" valuePropName="checked" noStyle>
                                <Checkbox>Can Manage Inventory</Checkbox>
                            </Form.Item>
                            <Form.Item name="can_manage_masters" valuePropName="checked" noStyle>
                                <Checkbox>Can Manage Masters (Ledger/Stock Items)</Checkbox>
                            </Form.Item>
                        </Space>
                        
                        <div style={{ textAlign: 'right', marginTop: '30px' }}>
                            <Button onClick={() => { setIsModalVisible(false); setEditingUser(null); }} style={{ marginRight: '10px' }}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={loading}>{editingUser ? "Update User" : "Create User"}</Button>
                        </div>
                    </Form>
                </Modal>
            </Card>
        </div>
    );
};

export default UserManagement;
