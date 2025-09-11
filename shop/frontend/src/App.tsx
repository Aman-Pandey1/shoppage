import { Routes, Route } from 'react-router-dom'
// import { ShopApp } from './ShopApp'
import { ShopBySlugPage } from './pages/ShopBySlugPage'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { MyOrdersPage } from './pages/MyOrdersPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<ShopBySlugPage />} />
      {/* Root-level site slug: e.g. /website1 */}
      <Route path=":siteSlug" element={<ShopBySlugPage />} />
      <Route path=":siteSlug/c/:categoryId" element={<ShopBySlugPage />} />
      <Route path="/s/:siteSlug" element={<ShopBySlugPage />} />
      <Route path="/s/:siteSlug/c/:categoryId" element={<ShopBySlugPage />} />
      <Route path="/s/:siteSlug/orders" element={<MyOrdersPage />} />
      <Route path="/c/:categoryId" element={<ShopBySlugPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      {/* Catch-all: show shop for any path to support arbitrary endpoints under domain */}
      <Route path="*" element={<ShopBySlugPage />} />
    </Routes>
  )
}

export default App
