import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import AIAssistant from './components/AIAssistant';
import Toast from './components/Toast';
import CompareBar from './components/CompareBar';
import BundleBar from './components/BundleBar';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import OnboardingTour from './components/OnboardingTour';
import FloatingActionButton from './components/FloatingActionButton';
import TermsModal from './components/TermsModal';
import ErrorBoundary from './components/ErrorBoundary';

// ── Eager (critical path) ────────────────────────────────────────────────────
import Home from './pages/Home';
import ListingDetail from './pages/ListingDetail';
import Login from './pages/Login';
import Register from './pages/Register';

// ── Lazy (route-level code splitting) ───────────────────────────────────────
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

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-8 h-8 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );
}
import { useAppStore } from './store/useAppStore';
import { setSoundEnabled } from './lib/sound';
import { subscribeNotificationStream } from './services/api';
import { Link } from 'react-router-dom';

function AppInner() {
  const { initAuth, loadListings, loadNotifications, pushNotification, currentUser, darkMode, soundEnabled, accentColor } = useAppStore();

  useEffect(() => {
    initAuth();
    loadListings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Accent color CSS variable
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accentColor);
  }, [accentColor]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 transition-colors">
      <TermsModal />
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="*"
          element={
            <>
              <Navbar />
              {/* E-posta doğrulanmamış kullanıcı için banner */}
              {currentUser && !currentUser.emailVerified && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between gap-4">
                  <p className="text-xs text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                    <span>⚠️</span>
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
              <main>
                <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/"              element={<Home />} />
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
                    <Route path="/trust"         element={<TrustCenter />} />
                    <Route path="/admin"         element={<Admin />} />
                  </Routes>
                </Suspense>
                </ErrorBoundary>
              </main>
              <AIAssistant />
              <CompareBar />
              <BundleBar />
              <KeyboardShortcuts />
              <OnboardingTour />
              <FloatingActionButton />
            </>
          }
        />
      </Routes>

      <Toast />
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
