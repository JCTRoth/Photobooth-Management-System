import { BrowserRouter, Routes, Route, Link, Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { EventDetail } from '@/pages/EventDetail';
import { CoupleUpload } from '@/pages/CoupleUpload';
import { DownloadPage } from '@/pages/DownloadPage';
import { SlideshowPage } from '@/pages/SlideshowPage';
import { AdminLogin } from '@/pages/AdminLogin';
import { MarriageLogin } from '@/pages/MarriageLogin';
import { MyGallery } from '@/pages/MyGallery';
import { AdminChangePassword } from '@/pages/AdminChangePassword';
import { AdminSmtpSettings } from '@/pages/AdminSmtpSettings';
import { AdminDevicesDashboard } from '@/pages/AdminDevicesDashboard';
import { AdminDeviceDetail } from '@/pages/AdminDeviceDetail';
import { AdminResetPassword } from '@/pages/AdminResetPassword';
import { LandingPage } from '@/pages/LandingPage';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/hooks/useAuth';
import { configureAuth, logout } from '@/services/api';
import '@/index.css';

function ApiConfigurer() {
  const { accessToken, refreshAccessToken } = useAuth();
  
  useEffect(() => {
    configureAuth(() => accessToken, refreshAccessToken);
    
    // Set up periodic token refresh (every 14 minutes for 15m token lifetime)
    if (accessToken) {
      const interval = setInterval(() => {
        refreshAccessToken();
      }, 14 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [accessToken, refreshAccessToken]);
  
  return null;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        {/* Admin login */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/reset-password" element={<AdminResetPassword />} />
        <Route
          path="/admin/change-password"
          element={
            <RequireAuth role="Admin">
              <AdminChangePassword />
            </RequireAuth>
          }
        />

        {/* Marriage user login */}
        <Route path="/login" element={<MarriageLogin />} />

        {/* Admin protected routes */}
        <Route
          path="/admin"
          element={
            <RequireAuth role="Admin">
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="events/:eventId" element={<EventDetail />} />
          <Route path="devices" element={<AdminDevicesDashboard />} />
          <Route path="devices/:deviceId" element={<AdminDeviceDetail />} />
          <Route path="settings/smtp" element={<AdminSmtpSettings />} />
        </Route>

        {/* Marriage user protected routes */}
        <Route
          path="/my-gallery"
          element={
            <RequireAuth role="MarriageUser">
              <MyGallery />
            </RequireAuth>
          }
        />

        {/* Public routes - no auth */}
        <Route path="/event/:eventId/upload" element={<CoupleUpload />} />
        <Route path="/download/:imageId" element={<DownloadPage />} />
        <Route path="/slideshow/:eventId" element={<SlideshowPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export function App() {
  return (
    <>
      <ApiConfigurer />
      <AppRoutes />
    </>
  );
}

function AdminLayout() {
  const { clearAuth } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    clearAuth();
    navigate('/', { replace: true });
  };

  return (
    <>
      <nav className="nav">
        <Link to="/admin" className="nav-brand">
          Photobooth Admin
        </Link>
        <Link to="/admin">Events</Link>
        <Link to="/admin/devices">Devices</Link>
        <Link to="/admin/settings/smtp">SMTP</Link>
        <button className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={handleLogout}>
          Log out
        </button>
      </nav>
      <div className="container">
        <Outlet />
      </div>
    </>
  );
}
