import React, { useState, useEffect } from 'react';
import { Modal, Form, Switch, Typography, Divider, Row, Col, message } from 'antd';
import axios from '../api/axios';

const { Title, Text } = Typography;

const CompanyFeaturesModal = ({ visible, onClose, company, onUpdate }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && company) {
      form.setFieldsValue({
        enable_bill_by_bill: company.enable_bill_by_bill,
        maintain_stock_batches: company.maintain_stock_batches,
        enable_gst: company.enable_gst,
        enable_tds: company.enable_tds,
        enable_cost_centres: company.enable_cost_centres,
      });
    }
  }, [visible, company, form]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      await axios.put(`/api/companies/${company.id}`, {
        ...company,
        ...values
      });
      message.success("Company features updated");
      onUpdate();
      onClose();
    } catch (err) {
      message.error("Failed to update features");
    } finally {
      setLoading(false);
    }
  };

  const FeatureItem = ({ label, name, description }) => (
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
      title={<Title level={4} style={{ margin: 0 }}>Company Features (F11)</Title>}
      open={visible}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={loading}
      width={600}
      bodyStyle={{ padding: '20px' }}
    >
      <Form form={form} layout="vertical">
        <Divider orientation="left" style={{ margin: '0 0 15px 0' }}>Accounting Features</Divider>
        <FeatureItem 
          label="Maintain Bill-wise Details" 
          name="enable_bill_by_bill" 
          description="Enable bill-by-bill tracking for Sundry Debtors/Creditors."
        />
        <FeatureItem 
          label="Maintain Cost Centres" 
          name="enable_cost_centres" 
          description="Track expenses and incomes by department or project."
        />

        <Divider orientation="left" style={{ margin: '20px 0 15px 0' }}>Inventory Features</Divider>
        <FeatureItem 
          label="Maintain Stock Batches" 
          name="maintain_stock_batches" 
          description="Enable batch-wise tracking and expiry dates for stock items."
        />

        <Divider orientation="left" style={{ margin: '20px 0 15px 0' }}>Statutory & Taxation</Divider>
        <FeatureItem 
          label="Enable GST" 
          name="enable_gst" 
          description="Enable Goods and Services Tax compliance."
        />
        <FeatureItem 
          label="Enable TDS" 
          name="enable_tds" 
          description="Enable Tax Deducted at Source tracking."
        />
      </Form>
    </Modal>
  );
};

export default CompanyFeaturesModal;
