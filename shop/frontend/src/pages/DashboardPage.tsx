import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { clearAuthToken } from '../lib/api';
import { AdminDashboard } from '../components/AdminDashboard';
import { BarChart3, LogOut, ArrowLeft } from 'lucide-react';

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
          <BarChart3 size={22} />
          <h2 style={{ margin: 0 }}>Admin Dashboard</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to={`/s/${localStorage.getItem('admin_selected_site_slug') || 'default'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={16} /> Back to shop
          </Link>
          <button onClick={handleLogout} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>
      <AdminDashboard />
    </div>
  );
};

