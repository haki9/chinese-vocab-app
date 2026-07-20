import { Route, Routes, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Scan from './pages/Scan';
import ScanReview from './pages/ScanReview';
import Lesson from './pages/Lesson';
import Practice from './pages/Practice';
import ProgressPage from './pages/Progress';
import Rewards from './pages/Rewards';

export default function App() {
  const { pathname } = useLocation();
  // Màn luyện + quét: fullscreen, không bottom nav
  const hideNav = /^\/lesson\/[^/]+\/practice\//.test(pathname) || pathname.startsWith('/scan');
  return (
    <div className="phone">
      <div className={`page ${hideNav ? 'no-nav' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/scan/review" element={<ScanReview />} />
          <Route path="/lesson/:id" element={<Lesson />} />
          <Route path="/lesson/:id/practice/:mode" element={<Practice />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/rewards" element={<Rewards />} />
        </Routes>
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
