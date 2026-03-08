import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, Space, Button, Table, message, Divider, Spin, Tag } from 'antd';
import { ArrowLeftOutlined, FallOutlined, RiseOutlined, PercentageOutlined, CalculatorOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';

const { Title, Text } = Typography;

const RatioAnalysis = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/reports/balance-sheet');
            setData(response.data);
        } catch (error) {
            message.error("Failed to fetch financial data for Ratio Analysis");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const findGroupValue = (nodes, name) => {
        for (const node of nodes) {
            if (node.name === name) {
                return (node.debit || 0) + (node.credit || 0);
            }
            if (node.children) {
                const childVal = findGroupValue(node.children, name);
                if (childVal !== 0) return childVal;
            }
        }
        return 0;
    };

    // Calculation Logic
    const currentAssets = data ? findGroupValue(data.assets, 'Current Assets') : 0;
    const currentLiabilities = data ? findGroupValue(data.liabilities, 'Current Liabilities') : 0;
    const stockInHand = data ? findGroupValue(data.assets, 'Stock-in-hand') : 0;

    const workingCapital = currentAssets - currentLiabilities;
    const currentRatio = currentLiabilities !== 0 ? (currentAssets / currentLiabilities).toFixed(2) : 'N/A';
    const quickRatio = currentLiabilities !== 0 ? ((currentAssets - stockInHand) / currentLiabilities).toFixed(2) : 'N/A';

    return (
        <div style={{ padding: '30px', backgroundColor: '#fdfadd', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <Space style={{ marginBottom: '20px' }}>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} type="text" />
                    <Title level={2} style={{ margin: 0, color: '#008080' }}>Ratio Analysis</Title>
                </Space>

                <Spin spinning={loading}>
                    <Row gutter={[16, 16]}>
                        <Col span={8}>
                            <Card bordered={false} style={{ border: '1px solid #a0a0a0', borderRadius: 0 }}>
                                <Statistic
                                    title="Working Capital"
                                    value={workingCapital}
                                    precision={2}
                                    prefix="₹"
                                    valueStyle={{ color: workingCapital >= 0 ? '#3f8600' : '#cf1322' }}
                                />
                                <Text type="secondary">(Current Assets - Current Liabilities)</Text>
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card bordered={false} style={{ border: '1px solid #a0a0a0', borderRadius: 0 }}>
                                <Statistic
                                    title="Current Ratio"
                                    value={currentRatio}
                                    suffix=": 1"
                                    valueStyle={{ color: currentRatio >= 1.2 ? '#3f8600' : '#cf1322' }}
                                    prefix={< RiseOutlined />}
                                />
                                <Text type="secondary">(Current Assets / Current Liabilities)</Text>
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card bordered={false} style={{ border: '1px solid #a0a0a0', borderRadius: 0 }}>
                                <Statistic
                                    title="Quick Ratio"
                                    value={quickRatio}
                                    suffix=": 1"
                                    valueStyle={{ color: quickRatio >= 1 ? '#3f8600' : '#cf1322' }}
                                    prefix={<PercentageOutlined />}
                                />
                                <Text type="secondary">((Current Assets - Stock) / Current Liab.)</Text>
                            </Card>
                        </Col>
                    </Row>

                    <Divider orientation="left" style={{ marginTop: '40px' }}>Key Figures</Divider>
                    
                    <Card style={{ border: '1px solid #a0a0a0', borderRadius: 0 }}>
                        <Row gutter={32}>
                            <Col span={12}>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text strong>Current Assets:</Text>
                                        <Text>₹{currentAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text strong>Stock-in-hand:</Text>
                                        <Text>₹{stockInHand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                                    </div>
                                    <Divider style={{ margin: '8px 0' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text strong>Quick Assets:</Text>
                                        <Text>₹{(currentAssets - stockInHand).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                                    </div>
                                </Space>
                            </Col>
                            <Col span={12}>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text strong>Current Liabilities:</Text>
                                        <Text>₹{currentLiabilities.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                                    </div>
                                    <Divider style={{ margin: '8px 0' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: '#f0f2f5' }}>
                                        <Text strong>Liquidity Status:</Text>
                                        <Tag color={currentRatio >= 1 ? 'green' : 'red'}>
                                            {currentRatio >= 1 ? 'Stable' : 'Low Liquidity'}
                                        </Tag>
                                    </div>
                                </Space>
                            </Col>
                        </Row>
                    </Card>

                    <Row style={{ marginTop: '20px', textAlign: 'center' }}>
                        <Col span={24}>
                            <Text type="secondary">
                                < CalculatorOutlined /> Ratios are calculated based on real-time Trial Balance and Group hierarchies.
                            </Text>
                        </Col>
                    </Row>
                </Spin>
            </div>
        </div>
    );
};

export default RatioAnalysis;
