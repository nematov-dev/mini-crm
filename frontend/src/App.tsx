import { Button, Result, Skeleton } from 'antd'
import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { LeadDetailPage } from './pages/LeadDetailPage'
import { LeadsPage } from './pages/LeadsPage'
import { LoginPage } from './pages/LoginPage'

// Charts (recharts) are heavy, so the dashboard is loaded on demand.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route
          index
          element={
            <Suspense fallback={<Skeleton active />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="leads/:id" element={<LeadDetailPage />} />
        <Route
          path="*"
          element={
            <Result
              status="404"
              title="Page not found"
              extra={
                <Link to="/">
                  <Button type="primary">Home</Button>
                </Link>
              }
            />
          }
        />
      </Route>
    </Routes>
  )
}
