import React, { useEffect, useState } from 'react';
import { Row, Col, Typography, message } from 'antd';
import axios from '../api/axios';

import { useNavigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import CompanyFeaturesModal from './CompanyFeaturesModal';
import UserConfigModal from './UserConfigModal';

const { Text } = Typography;

const Gateway = () => {
  const navigate = useNavigate();
  const { activeCompany, fetchCompanies } = useCompany(); 
  
  const [featuresVisible, setFeaturesVisible] = useState(false);
  const [configVisible, setConfigVisible] = useState(false);
  
  const role = localStorage.getItem('role');
  const permissions = JSON.parse(localStorage.getItem('permissions') || '{}');
  const username = localStorage.getItem('username');

  // RBAC Flags
  const isSuper = role === 'superadmin';
  const isAdmin = role === 'Admin';
  const canManageMasters = permissions.masters || isSuper || isAdmin;
  const canManageVouchers = permissions.vouchers || isSuper || isAdmin;
  const canManageInventory = permissions.inventory || isSuper || isAdmin;
  const canViewReports = permissions.reports || isSuper || isAdmin;

  // Global hotkeys for the Gateway screen
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore keydowns if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const key = e.key.toLowerCase();
      
      // Hotkey Guards
      if (key === 'v' && canManageVouchers) navigate('/voucher'); 
      if (key === 's' && canManageVouchers) navigate('/sales');   
      if (key === 'f' && canManageVouchers) navigate('/purchase');
      if (key === 'b' && canViewReports) navigate('/bs');      
      if (key === 'p' && canViewReports) navigate('/pnl');     
      if (key === 't' && canViewReports) navigate('/trial');   
      if (key === 'd' && canViewReports) navigate('/daybook'); 
      if (key === 'a' && canManageMasters) navigate('/accounts-info'); 
      if (key === 'i' && canManageInventory) navigate('/inventory-info'); 
      if (key === 'u' && (isAdmin || isSuper)) navigate('/users');
      if (key === 'o' && (isAdmin || isSuper)) navigate('/import-data'); 
      if (key === 'r' && canViewReports) navigate('/ratio-analysis'); 
      if (key === 'h' && canViewReports && activeCompany?.company_type === 'PHARMA') navigate('/pharma-reports');
      if (key === 'n') navigate('/banking'); 
      if (key === 'q' || key === 'l') {
        localStorage.clear();
        navigate('/login');
      }
      
      // Export Hotkey
      if (key === 'e' && (isAdmin || isSuper)) {
        e.preventDefault();
        handleExport();
      }

      // Alt+F3 for Company Info (Superadmin only for creation, but others can view if they have it)
      if (e.altKey && e.key === 'F3') {
        e.preventDefault();
        navigate('/company-info');
      }

      // F11: Features Placeholder
      if (e.key === 'F11') {
        e.preventDefault();
        setFeaturesVisible(true);
      }

      // F12: Configure Placeholder
      if (e.key === 'F12') {
        e.preventDefault();
        setConfigVisible(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, activeCompany, isAdmin, isSuper, canManageMasters, canManageVouchers, canManageInventory, canViewReports, fetchCompanies]);

  // Styles to mimic Classic Tally 9 aesthetic
  const theme = {
    bg: '#fdfadd',        // Pale yellow background
    border: '#a0a0a0',    // Panel borders
    headerBg: '#008080',  // Teal headers
    headerText: '#ffffff',// White header text
    text: '#000000',      // Default black text
    hotkey: '#ff0000',    // Red text for keyboard shortcuts
    panelBg: '#ffffff',   // White background for menu lists
  };

  const handleExport = async () => {
    if (!isAdmin && !isSuper) {
      message.error("Only administrators can export data.");
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      message.error("Not authenticated");
      return;
    }
    const url = `${axios.defaults.baseURL}/api/sync/export-app-data`;
    
    try {
      const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const blob = await resp.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      a.download = `weebal_backup_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      message.success("Backup export started.");
    } catch (err) {
      message.error("Export failed.");
    }
  };

  const TopMenuButton = ({ label, hotkey, onClick }) => (
    <div 
      onClick={onClick}
      style={{ 
        padding: '2px 10px', 
        display: 'inline-block', 
        borderRight: `1px solid ${theme.border}`, 
        fontSize: '12px',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <Text style={{ color: theme.hotkey, textDecoration: 'underline' }}>{hotkey}</Text>: {label}
    </div>
  );

  const MenuItem = ({ label, hotkeyChar, onClick }) => {
    // Split label to highlight the hotkey character
    const charIndex = label.toLowerCase().indexOf(hotkeyChar.toLowerCase());
    let prefix = label;
    let match = '';
    let suffix = '';
    
    if (charIndex !== -1) {
      prefix = label.substring(0, charIndex);
      match = label.substring(charIndex, charIndex + 1);
      suffix = label.substring(charIndex + 1);
    }

    return (
      <div 
        onClick={onClick}
        style={{ padding: '4px 20px 4px 80px', cursor: 'pointer', textAlign: 'left', fontSize: '14px' }}
        className="tally-menu-item"
        onMouseEnter={(e) => { e.target.style.backgroundColor = '#000080'; e.target.style.color = '#fff'; }}
        onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = theme.text; }}
      >
        {prefix}
        {match && <Text style={{ color: theme.hotkey, fontWeight: 'bold', fontSize: '15px' }}>{match}</Text>}
        {suffix}
      </div>
    );
  };

  const MenuSectionHeading = ({ title }) => (
    <div style={{ textAlign: 'left', paddingLeft: '60px', color: '#000080', fontWeight: 'bold', margin: '10px 0 5px 0', fontSize: '13px' }}>
      {title}
    </div>
  );

  return (
    <div style={{ height: '100%', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif' }}>
      
      {/* Top Header Row */}
      <div style={{ backgroundColor: '#e0e0e0', borderBottom: `1px solid ${theme.border}`, height: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 5px' }}>
          <div>
            <TopMenuButton label="Print" hotkey="P" onClick={() => message.info("Print feature coming in next update")} />
            <TopMenuButton label="Export" hotkey="E" onClick={handleExport} />
            <TopMenuButton label="E-Mail" hotkey="M" onClick={() => message.info("E-Mail feature coming in next update")} />
            <TopMenuButton label="Upload" hotkey="O" onClick={() => navigate('/import-data')} />
          </div>
          <div style={{ alignSelf: 'center', position: 'absolute', width: '100%', textAlign: 'center', pointerEvents: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img src="/logo.png" alt="WEEBAL Logo" style={{ height: '32px', marginRight: '10px' }} />
            <span style={{ fontSize: '24px', fontWeight: 'bold', fontStyle: 'italic', letterSpacing: '2px', color: '#000' }}>WEEBAL ERP</span>
          </div>
          <div>
            <TopMenuButton label="Language" hotkey="L" />
            <TopMenuButton label="Keyboard" hotkey="K" />
            <TopMenuButton label="Help" hotkey="H" />
          </div>
        </div>
      </div>

      {/* Gateway Green Info Bar */}
      <div style={{ backgroundColor: theme.headerBg, color: theme.headerText, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 10px', fontSize: '12px', fontWeight: 'bold' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/logo.png" alt="" style={{ height: '14px', marginRight: '8px', filter: 'brightness(0) invert(1)' }} />
          <span>Gateway of WEEBAL</span>
        </div>
        <span>Ctrl + M ✖</span>
      </div>

      {/* Main Workspace */}
      <div style={{ flex: 1, display: 'flex' }}>
        
        {/* Left Pane - Company Info */}
        <div style={{ flex: 1, borderRight: `1px outset ${theme.border}`, display: 'flex', flexDirection: 'column', backgroundColor: theme.bg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 30px', borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontStyle: 'italic' }}>Current Period</div>
              <div style={{ fontWeight: 'bold', fontSize: '13px' }}>
                {activeCompany ? (() => {
                  const start = new Date(activeCompany.financial_year_from);
                  const end = new Date(start);
                  end.setFullYear(start.getFullYear() + 1);
                  end.setDate(end.getDate() - 1);
                  
                  const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-');
                  return `${fmt(start)} to ${fmt(end)}`;
                })() : 'N/A'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontStyle: 'italic' }}>Current Date</div>
              <div style={{ fontWeight: 'bold', fontSize: '13px' }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'long' })}, {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-')}
              </div>
            </div>
          </div>
          
          <div style={{ flex: 1, padding: '20px' }}>
             <div style={{ textAlign: 'center', textDecoration: 'underline', fontWeight: 'bold', marginBottom: '20px', fontSize: '14px' }}>List of Selected Companies</div>
             
             <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 10px', fontSize: '12px', fontStyle: 'italic', marginBottom: '10px' }}>
                <span>Name of Company</span>
                <span>Date of Last Entry</span>
             </div>
             
             <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 10px', fontWeight: 'bold', fontSize: '14px' }}>
                <span style={{ color: activeCompany ? 'inherit' : '#ff0000' }}>
                  {activeCompany ? activeCompany.name : 'No Company Selected!'}
                </span>
                <span>{activeCompany ? new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '-'}</span>
             </div>
             
             {!activeCompany && (
                <div style={{ marginTop: '40px', textAlign: 'center', padding: '20px', border: '1px dashed #ff0000', color: '#ff0000' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '16px' }}>COMPANY NOT SELECTED</div>
                  <div style={{ fontSize: '12px', marginTop: '10px' }}>Press <span style={{ textDecoration: 'underline' }}>Alt+F3</span> to Create or Select a Company</div>
                </div>
             )}
          </div>
        </div>

        {/* Right Pane - Gateway Menu */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', paddingTop: '60px', backgroundColor: theme.bg }}>
          
          <div style={{ width: '350px', backgroundColor: theme.bg, border: `1px solid ${theme.border}`, borderStyle: 'outset', boxShadow: '2px 2px 5px rgba(0,0,0,0.2)', height: 'fit-content' }}>
            
            <div style={{ backgroundColor: theme.headerBg, color: theme.headerText, textAlign: 'center', padding: '4px', fontWeight: 'bold', fontSize: '14px', borderBottom: `1px solid ${theme.border}` }}>
              Gateway of WEEBAL
            </div>
            
            <div style={{ paddingBottom: '20px' }}>
              <MenuSectionHeading title="Masters" />
              {canManageMasters && <MenuItem label="Accounts Info." hotkeyChar="A" onClick={() => navigate('/accounts-info')} />}
              {canManageInventory && <MenuItem label="Inventory Info." hotkeyChar="I" onClick={() => navigate('/inventory-info')} />}
              
              <MenuSectionHeading title="Transactions" />
              {canManageVouchers && (
                <>
                  <MenuItem label="Accounting Vouchers" hotkeyChar="V" onClick={() => navigate('/voucher')} />
                  <MenuItem label="Purchase Invoice" hotkeyChar="F" onClick={() => navigate('/purchase')} />
                  <MenuItem label="Sales Invoice" hotkeyChar="S" onClick={() => navigate('/sales')} />
                </>
              )}
              
              <MenuSectionHeading title="Data Sync" />
              {(isAdmin || isSuper) && <MenuItem label="Tally Import" hotkeyChar="O" onClick={() => navigate('/import-data')} />}
              <MenuItem label="Banking" hotkeyChar="N" onClick={() => navigate('/banking')} />
              
              <MenuSectionHeading title="Reports" />
              {canViewReports && (
                <>
                  <MenuItem label="Balance Sheet" hotkeyChar="B" onClick={() => navigate('/bs')} />
                  <MenuItem label="Profit & Loss A/c" hotkeyChar="P" onClick={() => navigate('/pnl')} />
                  <MenuItem label="Trial Balance" hotkeyChar="T" onClick={() => navigate('/trial')} />
                  <MenuItem label="Ratio Analysis" hotkeyChar="R" onClick={() => navigate('/ratio-analysis')} />
                  {activeCompany?.company_type === 'PHARMA' && (
                    <MenuItem label="Pharma Reports" hotkeyChar="H" onClick={() => navigate('/pharma-reports')} />
                  )}
                </>
              )}
              
              <MenuSectionHeading title="Display" />
              {canViewReports && <MenuItem label="Day Book" hotkeyChar="D" onClick={() => navigate('/daybook')} />}
              
              <MenuSectionHeading title="Administration" />
              {(isAdmin || isSuper) && <MenuItem label="User Management" hotkeyChar="U" onClick={() => navigate('/users')} />}
              
              <div style={{ marginTop: '10px' }}>
                <MenuItem label="Logout" hotkeyChar="L" onClick={() => {
                  localStorage.clear();
                  navigate('/login');
                }} />
                <MenuItem label="Quit" hotkeyChar="Q" onClick={() => {
                  localStorage.clear();
                  navigate('/login');
                }} />
              </div>
            </div>

          </div>

        </div>
        
        {/* Rightmost Action Buttons Pane */}
        <div style={{ width: '100px', backgroundColor: '#e0e0e0', borderLeft: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', height: '100%' }}>
           <div style={{ flex: 1 }}></div>
           <div 
             onClick={() => setFeaturesVisible(true)}
             style={{ borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, padding: '4px', fontSize: '12px', textAlign: 'center', cursor: 'pointer' }}
           >
             <Text style={{ color: theme.hotkey, fontWeight: 'bold' }}>F11:</Text> Features
           </div>
           <div 
             onClick={() => setConfigVisible(true)}
             style={{ borderBottom: `1px solid ${theme.border}`, padding: '4px', fontSize: '12px', textAlign: 'center', cursor: 'pointer' }}
           >
             <Text style={{ color: theme.hotkey, fontWeight: 'bold' }}>F12:</Text> Configure
           </div>
        </div>

      </div>

      {/* Bottom Bar (Calculator / Server status) */}
      <div style={{ height: '20px', backgroundColor: '#a0d0d0', borderTop: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', padding: '0 10px', fontSize: '11px', color: '#000' }}>
        <span>Calculator</span>
        <span>ODBC Server</span>
        <span>Ctrl + N</span>
      </div>

      <CompanyFeaturesModal 
        visible={featuresVisible} 
        onClose={() => setFeaturesVisible(false)} 
        company={activeCompany}
        onUpdate={fetchCompanies}
      />
      <UserConfigModal 
        visible={configVisible} 
        onClose={() => setConfigVisible(false)} 
      />
    </div>
  );
};

export default Gateway;
