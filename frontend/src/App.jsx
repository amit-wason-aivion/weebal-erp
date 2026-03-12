import React, { useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { message } from 'antd';
import TrialBalance from './components/TrialBalance';
import VoucherEntry from './components/VoucherEntry';
import SalesInvoice from './components/SalesInvoice';
import PnL from './components/PnL';
import BalanceSheet from './components/BalanceSheet';
import Gateway from './components/Gateway';
import DayBook from './components/DayBook';
import LedgerVouchers from './components/LedgerVouchers';
import PurchaseInvoice from './components/PurchaseInvoice';
import Login from './components/Login';
import AccountsInfo from './components/AccountsInfo';
import InventoryInfo from './components/InventoryInfo';
import ImportData from './components/ImportData';
import RatioAnalysis from './components/RatioAnalysis';
import CompanyInfo from './components/CompanyInfo';
import UserManagement from './components/UserManagement';
import PharmaReports from './components/PharmaReports';
import Banking from './components/Banking';
import { CompanyProvider } from './context/CompanyContext';
import 'antd/dist/reset.css'; // Ant Design basic reset

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Pharma Route Wrapper
import { useCompany } from './context/CompanyContext';
const PharmaRoute = ({ children }) => {
  const { activeCompany } = useCompany();
  if (activeCompany?.company_type !== 'PHARMA') {
    message.error("Not Authorized: This report is for Pharma companies only.");
    return <Navigate to="/" replace />;
  }
  return children;
};

// Global Axios Interceptor
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

function AppContent() {
  const navigate = useNavigate();

  // Universal escape key to return to Gateway Menu & Alt+F3 for Company Info
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Prevent escape if we are on login screen
        if (window.location.pathname !== '/login') {
          navigate('/');
        }
      }
      
      // ALT + F3 for Company Info
      if (e.altKey && e.key === 'F3') {
        e.preventDefault();
        navigate('/company-info');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="App" style={{ height: '100vh', width: '100vw', backgroundColor: '#f0f2f5', overflow: 'hidden', position: 'fixed', top: 0, left: 0 }}>
      <main style={{ height: '100%', width: '100%' }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Gateway /></ProtectedRoute>} />
          <Route path="/trial" element={<ProtectedRoute><TrialBalance /></ProtectedRoute>} />
          <Route path="/voucher" element={<ProtectedRoute><VoucherEntry /></ProtectedRoute>} />
          <Route path="/voucher/:id" element={<ProtectedRoute><VoucherEntry /></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute><SalesInvoice /></ProtectedRoute>} />
          <Route path="/sales/:id" element={<ProtectedRoute><SalesInvoice /></ProtectedRoute>} />
          <Route path="/pnl" element={<ProtectedRoute><PnL /></ProtectedRoute>} />
          <Route path="/bs" element={<ProtectedRoute><BalanceSheet /></ProtectedRoute>} />
          <Route path="/daybook" element={<ProtectedRoute><DayBook /></ProtectedRoute>} />
          <Route path="/banking" element={<ProtectedRoute><Banking /></ProtectedRoute>} />
          <Route path="/ledger-vouchers/:id" element={<ProtectedRoute><LedgerVouchers /></ProtectedRoute>} />
          <Route path="/ledger-vouchers/:id" element={<ProtectedRoute><LedgerVouchers /></ProtectedRoute>} />
          <Route path="/purchase" element={<ProtectedRoute><PurchaseInvoice /></ProtectedRoute>} />
          <Route path="/purchase/:id" element={<ProtectedRoute><PurchaseInvoice /></ProtectedRoute>} />
          <Route path="/accounts-info" element={<ProtectedRoute><AccountsInfo /></ProtectedRoute>} />
          <Route path="/inventory-info" element={<ProtectedRoute><InventoryInfo /></ProtectedRoute>} />
          <Route path="/import-data" element={<ProtectedRoute><ImportData /></ProtectedRoute>} />
          <Route path="/ratio-analysis" element={<ProtectedRoute><RatioAnalysis /></ProtectedRoute>} />
          <Route path="/company-info" element={<ProtectedRoute><CompanyInfo /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
          <Route path="/pharma-reports" element={<ProtectedRoute><PharmaRoute><PharmaReports /></PharmaRoute></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Provider store={store}>
      <CompanyProvider>
        <Router>
          <AppContent />
        </Router>
      </CompanyProvider>
    </Provider>
  );
}

export default App;
