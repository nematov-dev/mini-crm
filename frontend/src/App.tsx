import { Button, Result } from 'antd'
import { Link, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { LoginPage } from './pages/LoginPage'

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
