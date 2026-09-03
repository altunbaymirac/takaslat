import { useEffect, lazy, Suspense } from 'react';
import { setMonitoringUser } from './lib/monitoring';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AIAssistant from './components/AIAssistant';
import Toast from './components/Toast';
import CompareBar from './components/CompareBar';
import BundleBar from './components/BundleBar';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import ErrorBoundary from './components/ErrorBoundary';

// ── Eager (critical path) ────────────────────────────────────────────────────
import Home from './pages/Home';
import ListingDetail from './pages/ListingDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';

// ── Lazy (route-level code splitting) ───────────────────────────────────────
const Listings      = lazy(() => import('./pages/Listings'));
const AIResults      = lazy(() => import('./pages/AIResults'));
const CreateListing = lazy(() => import('./pages/CreateListing'));
const MyOffers      = lazy(() => import('./pages/MyOffers'));
const Conversations = lazy(() => import('./pages/Conversations'));
const Favorites     = lazy(() => import('./pages/Favorites'));
const Compare       = lazy(() => import('./pages/Compare'));
const Profile       = lazy(() => import('./pages/Profile'));
const Trends        = lazy(() => import('./pages/Trends'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Wishlist      = lazy(() => import('./pages/Wishlist'));
const MapView       = lazy(() => import('./pages/MapView'));
const Achievements  = lazy(() => import('./pages/Achievements'));
const Settings      = lazy(() => import('./pages/Settings'));
const SmartTools    = lazy(() => import('./pages/SmartTools'));
const Admin         = lazy(() => import('./pages/Admin'));
const TrustCenter   = lazy(() => import('./pages/TrustCenter'));
const Auctions      = lazy(() => import('./pages/Auctions'));
const Privacy       = lazy(() => import('./pages/Privacy'));
const Terms         = lazy(() => import('./pages/Terms'));
const CategoryLanding = lazy(() => import('./pages/CategoryLanding'));
const NotFound      = lazy(() => import('./pages/NotFound'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-8 h-8 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );
}
import { useAppStore } from './store/useAppStore';
import { setSoundEnabled } from './lib/sound';
import { subscribeAuctionStream, subscribeNotificationStream } from './services/api';
import { Link } from 'react-router-dom';
import { usePriceDropAlerts } from './hooks/usePriceDropAlerts';
import CookieConsent from './components/CookieConsent';

function AppInner() {
  const { pathname } = useLocation();
  const {
    initAuth,
    loadListings,
    loadAuctions,
    loadNotifications,
    pushNotification,
    currentUser,
    darkMode,
    soundEnabled,
    compareList,
    bundleCart,
  } = useAppStore();
  usePriceDropAlerts();
  const isFocusedWorkspace = pathname === '/create' || pathname === '/conversations';

  useEffect(() => {
    initAuth();
    loadListings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadAuctions();
    let refreshTimer: number | undefined;
    const stop = subscribeAuctionStream(() => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => { void loadAuctions(); }, 120);
    });
    return () => {
      stop();
      window.clearTimeout(refreshTimer);
    };
  }, [loadAuctions]);

  useEffect(() => {
    if (!currentUser) return;
    loadNotifications();
    const stop = subscribeNotificationStream(
      (notification) => { pushNotification(notification); },
    );
    const poll = window.setInterval(() => {
      loadNotifications();
    }, 20_000);
    return () => {
      stop();
      window.clearInterval(poll);
    };
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else          root.classList.remove('dark');
  }, [darkMode]);

  // Ses ayarını sync et
  useEffect(() => { setSoundEnabled(soundEnabled); }, [soundEnabled]);

  // Hata raporlarına yalnızca kullanıcı kimliğini iliştir
  useEffect(() => { setMonitoringUser(currentUser?.id ?? null); }, [currentUser?.id]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 transition-colors">
      <Routes>
        <Route path="/login"          element={<Login />} />
        <Route path="/register"       element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="*"
          element={
            <>
              <Navbar />
              {/* E-posta doğrulanmamış kullanıcı için banner */}
              {currentUser && !currentUser.emailVerified && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between gap-4">
                  <p className="text-xs text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374L10.052 3.38c.866-1.5 3.03-1.5 3.896 0l7.355 12.746zM12 16.5h.008v.008H12V16.5z" />
                    </svg>
                    <span>E-posta adresin henüz doğrulanmadı. Güven skorun düşük görünebilir.</span>
                  </p>
                  <Link
                    to="/settings"
                    className="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-300 underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
                  >
                    Doğrula →
                  </Link>
                </div>
              )}
              <main className={compareList.length > 0 || bundleCart.length > 0 ? 'pb-52 md:pb-28' : 'pb-20 md:pb-0'}>
                <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/"              element={<Home />} />
                    <Route path="/listings"      element={<Listings />} />
                    <Route path="/arac-takas"    element={<CategoryLanding kind="vehicle" />} />
                    <Route path="/ev-takas"      element={<CategoryLanding kind="home" />} />
                    <Route path="/arsa-takas"    element={<CategoryLanding kind="land" />} />
                    <Route path="/ai-sonuclar"   element={<AIResults />} />
                    <Route path="/listing/:id"   element={<ListingDetail />} />
                    <Route path="/create"        element={<CreateListing />} />
                    <Route path="/offers"        element={<MyOffers />} />
                    <Route path="/conversations" element={<Conversations />} />
                    <Route path="/favorites"     element={<Favorites />} />
                    <Route path="/compare"       element={<Compare />} />
                    <Route path="/profile/:id"   element={<Profile />} />
                    <Route path="/trends"        element={<Trends />} />
                    <Route path="/dashboard"     element={<Dashboard />} />
                    <Route path="/wishlist"      element={<Wishlist />} />
                    <Route path="/map"           element={<MapView />} />
                    <Route path="/achievements"  element={<Achievements />} />
                    <Route path="/settings"      element={<Settings />} />
                    <Route path="/smart-tools"   element={<SmartTools />} />
                    <Route path="/auctions"      element={<Auctions />} />
                    <Route path="/trust"         element={<TrustCenter />} />
                    <Route path="/admin"         element={<Admin />} />
                    <Route path="/gizlilik"      element={<Privacy />} />
                    <Route path="/kullanim-kosullari" element={<Terms />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                </ErrorBoundary>
              </main>
              {!isFocusedWorkspace && <Footer />}
              <AIAssistant />
              <CompareBar />
              <BundleBar />
              <KeyboardShortcuts />
            </>
          }
        />
      </Routes>

      <Toast />
      <CookieConsent />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
