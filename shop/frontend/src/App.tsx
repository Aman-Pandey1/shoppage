import { Routes, Route, Navigate } from 'react-router-dom'
// import { ShopApp } from './ShopApp'
import { ShopBySlugPage } from './pages/ShopBySlugPage'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/s/default" replace />} />
      <Route path="/s/:siteSlug" element={<ShopBySlugPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/s/default" replace />} />
    </Routes>
  )
}

export default App
