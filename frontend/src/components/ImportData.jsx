import React, { useState } from 'react';
import { Card, Button, Space, Typography, message, Divider, List, Tag, Alert, Upload, Row, Col, Checkbox, Modal, Input } from 'antd';
import { SyncOutlined, ArrowLeftOutlined, CloudDownloadOutlined, DatabaseOutlined, InboxOutlined, FileTextOutlined, CloudUploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import axios from '../api/axios';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const ImportData = () => {
    const [syncingMasters, setSyncingMasters] = useState(false);
    const [syncingTransactions, setSyncingTransactions] = useState(false);
    const [pushingPending, setPushingPending] = useState(false);
    const [overwrite, setOverwrite] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [resetPassword, setResetPassword] = useState('');
    const [resetModalVisible, setResetModalVisible] = useState(false);
    const navigate = useNavigate();
    const { activeCompany } = useCompany();

    const role = localStorage.getItem('role')?.toLowerCase();
    const isSuper = role === 'superadmin';

    const handleSystemReset = async () => {
        if (!resetPassword) {
            message.error("Please enter the secret reset password");
            return;
        }

        setResetting(true);
        try {
            const response = await axios.post('/api/admin/reset-db', { password: resetPassword });
            message.success(response.data.message || "Database reset successfully");
            setResetModalVisible(false);
            setResetPassword('');
            // Optional: Logout or redirect to gateway
            setTimeout(() => {
                localStorage.clear();
                window.location.href = '/login';
            }, 2000);
        } catch (error) {
            message.error(error.response?.data?.detail || "System reset failed. Check password.");
        } finally {
            setResetting(false);
        }
    };

    const handleSyncMasters = async () => {
        setSyncingMasters(true);
        try {
            const response = await axios.post('/api/sync/import-ledgers', {}, {
                headers: { 'X-Company-ID': activeCompany?.id }
            });
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
            const response = await axios.post('/api/sync/import-vouchers', {}, {
                headers: { 'X-Company-ID': activeCompany?.id }
            });
            message.success(response.data.message || "Transactions synced successfully");
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to sync transactions from Tally");
        } finally {
            setSyncingTransactions(false);
        }
    };

    const handlePushPending = async () => {
        setPushingPending(true);
        try {
            const response = await axios.post('/api/sync/tally/push-pending', {}, {
                headers: { 'X-Company-ID': activeCompany?.id }
            });
            message.success(response.data.message || "Manual push started in background");
        } catch (error) {
            message.error(error.response?.data?.detail || "Failed to trigger push to Tally");
        } finally {
            setPushingPending(false);
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
                    headers: { 
                        'Content-Type': 'multipart/form-data',
                        'X-Company-ID': activeCompany?.id
                    }
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
            Modal.confirm({
                title: 'Confirm Restoration',
                content: `Are you sure you want to restore data from ${file.name}? ${overwrite ? 'Existing records will be OVERWRITTEN.' : 'New records will be added, existing ones will be skipped.'}`,
                onOk: async () => {
                    const formData = new FormData();
                    formData.append('file', file);
                    try {
                        const response = await axios.post(`/api/sync/upload-app-json?overwrite=${overwrite}`, formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        onSuccess(response.data);
                        message.success(`${file.name} backup restored successfully.`);
                    } catch (err) {
                        const errorMsg = err.response?.data?.detail || "Restore failed";
                        onError(new Error(errorMsg));
                        message.error(`${file.name} restoration failed: ${errorMsg}`);
                    }
                }
            });
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
            title: 'Transactions (Import from Tally)',
            description: 'Imports sales, purchases, payments, and other vouchers. Uses AlterID to prevent duplicates.',
            action: handleSyncTransactions,
            loading: syncingTransactions,
            icon: <CloudDownloadOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
        },
        {
            title: 'Push Pending (Local to Tally Sync)',
            description: 'Pushes all unsynced local vouchers to Tally running on Port 9000.',
            action: handlePushPending,
            loading: pushingPending,
            icon: <SyncOutlined style={{ fontSize: '24px', color: '#8844ee' }} />
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
                                        backgroundColor: item.title.includes('Masters') ? '#008080' : item.title.includes('Push') ? '#8844ee' : '#1890ff',
                                        borderColor: item.title.includes('Masters') ? '#008080' : item.title.includes('Push') ? '#8844ee' : '#1890ff' 
                                    }}
                                >
                                    {item.title.includes('Push') ? 'Push to Tally' : 'Connect & Sync'}
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
                            <Checkbox 
                                checked={overwrite} 
                                onChange={e => setOverwrite(e.target.checked)}
                                style={{ marginBottom: '10px' }}
                            >
                                Overwrite existing data
                            </Checkbox>
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
                                fetch(url, { 
                                    headers: { 
                                        'Authorization': `Bearer ${token}`,
                                        'X-Company-ID': activeCompany?.id
                                    } 
                                })
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
                                fetch(url, { 
                                    headers: { 
                                        'Authorization': `Bearer ${token}`,
                                        'X-Company-ID': activeCompany?.id
                                    } 
                                })
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

                {isSuper && (
                    <>
                        <Divider orientation="left" style={{ borderColor: '#ff4d4f' }}>
                            <Text type="danger"><DeleteOutlined /> Danger Zone</Text>
                        </Divider>
                        <div style={{ backgroundColor: '#fff2f0', border: '1px solid #ffccc7', padding: '15px', textAlign: 'center' }}>
                            <Paragraph type="danger">
                                <strong>System Reset:</strong> This will erase all companies, ledgers, and vouchers. This action cannot be undone.
                            </Paragraph>
                            <Button 
                                danger 
                                type="primary" 
                                icon={<DeleteOutlined />} 
                                onClick={() => setResetModalVisible(true)}
                            >
                                Reset Entire Database
                            </Button>
                        </div>
                    </>
                )}
            </Card>

            <Modal
                title="System Emergency Reset"
                visible={resetModalVisible}
                onOk={handleSystemReset}
                onCancel={() => setResetModalVisible(false)}
                okText="WIPE DATABASE"
                okButtonProps={{ danger: true, loading: resetting }}
                confirmLoading={resetting}
            >
                <div style={{ padding: '10px 0' }}>
                    <Alert
                        message="CRITICAL WARNING"
                        description="You are about to wipe the entire production database. All current data will be LOST forever."
                        type="error"
                        showIcon
                        style={{ marginBottom: '15px' }}
                    />
                    <Text strong>To confirm, please enter the Secret Reset Password:</Text>
                    <Input.Password 
                        placeholder="Enter secret reset password" 
                        value={resetPassword}
                        onChange={e => setResetPassword(e.target.value)}
                        style={{ marginTop: '10px' }}
                        onPressEnter={handleSystemReset}
                    />
                </div>
            </Modal>
        </div>
    );
};

export default ImportData;
