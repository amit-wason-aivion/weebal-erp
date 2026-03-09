import React, { useState } from 'react';
import { Card, Button, Space, Typography, message, Divider, List, Tag, Alert, Upload, Row, Col } from 'antd';
import { SyncOutlined, ArrowLeftOutlined, CloudDownloadOutlined, DatabaseOutlined, InboxOutlined, FileTextOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const ImportData = () => {
    const [syncingMasters, setSyncingMasters] = useState(false);
    const [syncingTransactions, setSyncingTransactions] = useState(false);
    const navigate = useNavigate();

    const handleSyncMasters = async () => {
        setSyncingMasters(true);
        try {
            const response = await axios.post('/api/sync/import-ledgers');
            message.success(response.data.message || "Masters synced successfully");
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to sync masters from Tally");
        } finally {
            setSyncingMasters(false);
        }
    };

    const handleSyncTransactions = async () => {
        setSyncingTransactions(true);
        try {
            const response = await axios.post('/api/sync/import-vouchers');
            message.success(response.data.message || "Transactions synced successfully");
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to sync transactions from Tally");
        } finally {
            setSyncingTransactions(false);
        }
    };

    const tallyUploadProps = {
        name: 'file',
        multiple: false,
        accept: '.xml',
        customRequest: async ({ file, onSuccess, onError }) => {
            const formData = new FormData();
            formData.append('file', file);
            try {
                const response = await axios.post('/api/sync/upload-tally-xml', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                onSuccess(response.data);
                message.success(`${file.name} uploaded and synced: ${response.data.ledgers}, ${response.data.transactions}`);
            } catch (err) {
                const errorMsg = err.response?.data?.detail || "File sync failed";
                onError(new Error(errorMsg));
                message.error(`${file.name} failed: ${errorMsg}`);
            }
        },
        beforeUpload: (file) => {
            const isXML = file.type === 'text/xml' || file.name.endsWith('.xml');
            if (!isXML) {
                message.error(`${file.name} is not an XML file`);
            }
            return isXML || Upload.LIST_IGNORE;
        }
    };

    const appBackupProps = {
        name: 'file',
        multiple: false,
        accept: '.json',
        customRequest: async ({ file, onSuccess, onError }) => {
            const formData = new FormData();
            formData.append('file', file);
            try {
                const response = await axios.post('/api/sync/upload-app-json', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                onSuccess(response.data);
                message.success(`${file.name} backup restored successfully.`);
            } catch (err) {
                const errorMsg = err.response?.data?.detail || "Restore failed";
                onError(new Error(errorMsg));
                message.error(`${file.name} restoration failed: ${errorMsg}`);
            }
        },
        beforeUpload: (file) => {
            const isJSON = file.type === 'application/json' || file.name.endsWith('.json');
            if (!isJSON) {
                message.error(`${file.name} is not a JSON backup file`);
            }
            return isJSON || Upload.LIST_IGNORE;
        }
    };

    const syncSteps = [
        {
            title: 'Masters (Ledgers & Groups)',
            description: 'Imports all account heads, hierarchies, and opening balances from Tally.',
            action: handleSyncMasters,
            loading: syncingMasters,
            icon: <DatabaseOutlined style={{ fontSize: '24px', color: '#008080' }} />
        },
        {
            title: 'Transactions (Vouchers)',
            description: 'Imports sales, purchases, payments, and other vouchers. Uses AlterID to prevent duplicates.',
            action: handleSyncTransactions,
            loading: syncingTransactions,
            icon: <CloudDownloadOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
        }
    ];

    return (
        <div style={{ padding: '40px', backgroundColor: '#fdfadd', minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
            <Card 
                style={{ width: '100%', maxWidth: '850px', border: '1px solid #a0a0a0', borderRadius: 0 }}
                title={
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} type="text" />
                            <Title level={3} style={{ margin: 0, color: '#008080' }}>Import of Data (Tally Sync)</Title>
                        </Space>
                        <Tag color="cyan">ODBC/XML Port: 9000</Tag>
                    </Space>
                }
            >
                <Alert
                    message="Bidirectional Connectivity"
                    description="You can either sync directly via Tally's Port 9000 OR upload export files manually for offline parallel runs."
                    type="info"
                    showIcon
                    style={{ marginBottom: '20px' }}
                />

                <Divider orientation="left">1. Live Connection Sync</Divider>
                <List
                    itemLayout="horizontal"
                    dataSource={syncSteps}
                    renderItem={item => (
                        <List.Item
                            actions={[
                                <Button 
                                    type="primary" 
                                    icon={<SyncOutlined spin={item.loading} />} 
                                    onClick={item.action} 
                                    loading={item.loading}
                                    style={{ 
                                        backgroundColor: item.title.includes('Masters') ? '#008080' : '#1890ff',
                                        borderColor: item.title.includes('Masters') ? '#008080' : '#1890ff' 
                                    }}
                                >
                                    Connect & Sync
                                </Button>
                            ]}
                        >
                            <List.Item.Meta
                                avatar={item.icon}
                                title={<Text strong>{item.title}</Text>}
                                description={item.description}
                            />
                        </List.Item>
                    )}
                />

                <Divider orientation="left">2. File-Based Offline Import</Divider>
                <Row gutter={16}>
                    <Col span={12}>
                        <Card size="small" title={<><FileTextOutlined /> Tally Export (XML)</>}>
                            <Dragger {...tallyUploadProps} style={{ padding: '20px', background: '#fff' }}>
                                <p className="ant-upload-drag-icon">
                                    <InboxOutlined style={{ color: '#008080' }} />
                                </p>
                                <p className="ant-upload-text">Click or drag Tally XML</p>
                                <p className="ant-upload-hint">Supports Masters & Daybook</p>
                            </Dragger>
                        </Card>
                    </Col>
                    <Col span={12}>
                        <Card size="small" title={<><CloudUploadOutlined /> WEEBAL JSON Backup</>}>
                            <Dragger {...appBackupProps} style={{ padding: '20px', background: '#fff' }}>
                                <p className="ant-upload-drag-icon">
                                    <CloudUploadOutlined style={{ color: '#1890ff' }} />
                                </p>
                                <p className="ant-upload-text">Restore WEEBAL backup</p>
                                <p className="ant-upload-hint">Full JSON restore logic</p>
                            </Dragger>
                        </Card>
                    </Col>
                </Row>

                <Divider />

                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <Space size="large">
                        <Button 
                            icon={<CloudDownloadOutlined />} 
                            onClick={async () => {
                                const token = localStorage.getItem('token');
                                const url = `${axios.defaults.baseURL}/api/sync/export-app-data`;
                                fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
                                .then(resp => resp.blob())
                                .then(blob => {
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.style.display = 'none';
                                    a.href = url;
                                    a.download = `weebal_backup_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.json`;
                                    document.body.appendChild(a);
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                    message.success("JSON Backup export started.");
                                })
                                .catch(() => message.error("JSON Export failed."));
                            }}
                        >
                            WEEBAL JSON Backup
                        </Button>

                        <Button 
                            type="primary"
                            icon={<FileTextOutlined />} 
                            style={{ backgroundColor: '#008080', borderColor: '#008080' }}
                            onClick={async () => {
                                const token = localStorage.getItem('token');
                                const url = `${axios.defaults.baseURL}/api/sync/export-tally-xml`;
                                fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
                                .then(resp => resp.blob())
                                .then(blob => {
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.style.display = 'none';
                                    a.href = url;
                                    a.download = `weebal_to_tally_export.xml`;
                                    document.body.appendChild(a);
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                    message.success("Tally XML export started.");
                                })
                                .catch(() => message.error("XML Export failed."));
                            }}
                        >
                            Export to Tally (XML)
                        </Button>
                    </Space>
                </div>

                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <Text type="secondary">
                        <SyncOutlined style={{ marginRight: '8px' }} />
                        Note: Files are processed instantly using UPSERT logic.
                    </Text>
                </div>
            </Card>
        </div>
    );
};

export default ImportData;
