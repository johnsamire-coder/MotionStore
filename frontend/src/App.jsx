import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import POSPage from './pages/POSPage';
import SortingPage from './pages/SortingPage';
import InventoryPage from './pages/InventoryPage';
import PurchasingPage from './pages/PurchasingPage';
import ShiftsPage from './pages/ShiftsPage';
import TreasuryPage from './pages/TreasuryPage';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center text-slate-500">Loading Workspace...</div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="pos" element={<POSPage />} />
            <Route path="sorting" element={<SortingPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="purchasing" element={<PurchasingPage />} />
            <Route path="shifts" element={<ShiftsPage />} />
            <Route path="treasury" element={<TreasuryPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
