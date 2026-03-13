import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Layout } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import axios from '../api/axios';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Content } = Layout;

const Login = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const onFinish = async (values) => {
        setLoading(true);
        try {
            // FastAPI OAuth2 expects form-data
            const formData = new FormData();
            formData.append('username', values.username);
            formData.append('password', values.password);

            const res = await axios.post('/api/login', formData);
            
            // Store token and user info
            localStorage.setItem('token', res.data.access_token);
            localStorage.setItem('role', res.data.role);
            localStorage.setItem('username', values.username);
            localStorage.setItem('company_id', res.data.company_id);
            localStorage.setItem('permissions', JSON.stringify(res.data.permissions));

            message.success('Login successful! Welcome to WEEBAL ERP.');
            navigate('/');
        } catch (err) {
            message.error(err.response?.data?.detail || 'Login failed. Check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #001529 0%, #002140 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                <Card 
                    style={{ width: '400px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
                    styles={{ body: { padding: '40px' } }}
                >
                    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                        <img src="/logo.png" alt="WEEBAL Logo" style={{ height: '60px', marginBottom: '15px' }} />
                        <Title level={2} style={{ color: '#001529', marginBottom: '5px', marginTop: 0 }}>WEEBAL ERP</Title>
                        <Text type="secondary">Welcome to WEEBAL ERP</Text>
                    </div>

                    <Form
                        name="login_form"
                        onFinish={onFinish}
                        layout="vertical"
                        size="large"
                    >
                        <Form.Item
                            name="username"
                            rules={[{ required: true, message: 'Please input your username!' }]}
                        >
                            <Input prefix={<UserOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="Username" />
                        </Form.Item>

                        <Form.Item
                            name="password"
                            rules={[{ required: true, message: 'Please input your password!' }]}
                        >
                            <Input.Password 
                                prefix={<LockOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} 
                                placeholder="Password" 
                            />
                        </Form.Item>

                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%', height: '45px', borderRadius: '6px', background: '#001529' }}>
                                Log In
                            </Button>
                        </Form.Item>
                    </Form>
                    
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>Parallel Run v1.0 | Tally Integration Active</Text>
                    </div>
                </Card>
            </Content>
        </Layout>
    );
};

export default Login;
