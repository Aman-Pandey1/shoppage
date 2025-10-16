import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../lib/api';

export const ProtectedRoute = ({ children, requiredRole }) => {
  const location = useLocation();
  const token = (typeof window !== 'undefined') ? localStorage.getItem('auth_token') : null;
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (requiredRole) {
    const user = getCurrentUser();
    if (!user || String(user.role).toLowerCase() !== String(requiredRole).toLowerCase()) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
  }
  return <>{children}</>;
};

