import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import SpreadsheetView from './pages/SpreadsheetView'
import MinitabView from './pages/MinitabView'
import Profile from './pages/Profile'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import MinitabLayout from './components/MinitabLayout'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Register />}
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="spreadsheet/:id" element={<SpreadsheetView />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route
          path="/minitab"
          element={
            <ProtectedRoute>
              <MinitabLayout />
            </ProtectedRoute>
          }
        >
          <Route path="spreadsheet/:id" element={<MinitabView />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  )
}

export default App

