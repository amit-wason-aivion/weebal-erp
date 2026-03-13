import React, { useState, useEffect } from 'react';
import { Modal, Form, Switch, Typography, Divider, Row, Col, message } from 'antd';

const { Title, Text } = Typography;

const UserConfigModal = ({ visible, onClose }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      const savedConfig = JSON.parse(localStorage.getItem('user_config') || '{}');
      form.setFieldsValue({
        vch_show_balance: savedConfig.vch_show_balance ?? true,
        vch_skip_date: savedConfig.vch_skip_date ?? false,
        db_show_narration: savedConfig.db_show_narration ?? true,
        show_stock_batches: savedConfig.show_stock_batches ?? true,
      });
    }
  }, [visible, form]);

  const handleSave = () => {
    const values = form.getFieldsValue();
    localStorage.setItem('user_config', JSON.stringify(values));
    message.success("Configuration updated locally");
    window.dispatchEvent(new Event('storage')); // Trigger update in other components
    onClose();
  };

  const ConfigItem = ({ label, name, description }) => (
    <Row align="middle" style={{ marginBottom: '12px' }}>
      <Col span={16}>
        <Text strong>{label}</Text>
        <br />
        <Text type="secondary" style={{ fontSize: '12px' }}>{description}</Text>
      </Col>
      <Col span={8} style={{ textAlign: 'right' }}>
        <Form.Item name={name} valuePropName="checked" noStyle>
          <Switch size="small" />
        </Form.Item>
      </Col>
    </Row>
  );

  return (
    <Modal
      title={<Title level={4} style={{ margin: 0 }}>Configuration (F12)</Title>}
      open={visible}
      onCancel={onClose}
      onOk={handleSave}
      width={500}
      bodyStyle={{ padding: '20px' }}
    >
      <Form form={form} layout="vertical">
        <Divider orientation="left" style={{ margin: '0 0 15px 0' }}>Voucher Entry</Divider>
        <ConfigItem 
          label="Show Ledger Balances" 
          name="vch_show_balance" 
          description="Display current balance of the selected ledger during voucher entry."
        />
        <ConfigItem 
          label="Skip Date Field" 
          name="vch_skip_date" 
          description="Automatically skip the date field during entry for faster input."
        />

        <Divider orientation="left" style={{ margin: '20px 0 15px 0' }}>Reports Display</Divider>
        <ConfigItem 
          label="Show Narration in Day Book" 
          name="db_show_narration" 
          description="Display narration for each entry in the Day Book report."
        />
        <ConfigItem 
          label="Show Stock Batches" 
          name="show_stock_batches" 
          description="Show batch-wise breakdown in inventory reports."
        />
      </Form>
    </Modal>
  );
};

export default UserConfigModal;
