import { BrowserRouter, Routes, Route, Link, Outlet } from 'react-router-dom';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { EventDetail } from '@/pages/EventDetail';
import { CoupleUpload } from '@/pages/CoupleUpload';
import { DownloadPage } from '@/pages/DownloadPage';
import { SlideshowPage } from '@/pages/SlideshowPage';
import '@/index.css';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin routes */}
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="events/:eventId" element={<EventDetail />} />
        </Route>

        {/* Public routes - no nav */}
        <Route path="/event/:eventId/upload" element={<CoupleUpload />} />
        <Route path="/download/:imageId" element={<DownloadPage />} />
        <Route path="/slideshow/:eventId" element={<SlideshowPage />} />
      </Routes>
    </BrowserRouter>
  );
}

function AdminLayout() {
  return (
    <>
      <nav className="nav">
        <Link to="/" className="nav-brand">
          📸 Photobooth Admin
        </Link>
        <Link to="/">Events</Link>
      </nav>
      <div className="container">
        <Outlet />
      </div>
    </>
  );
}
