import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { clearAuthToken } from '../lib/api';
import { AdminDashboard } from '../components/AdminDashboard';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  function handleLogout() {
    clearAuthToken();
    navigate('/login', { replace: true });
  }
  return (
    <div className="container" style={{ paddingTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 24 }}>📊</div>
          <h2 style={{ margin: 0 }}>Admin Dashboard</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/">← Back to shop</Link>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>
      <AdminDashboard />
    </div>
  );
};

