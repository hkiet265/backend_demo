import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

// Note: Router is prepared but not integrated yet
// Current app still uses tab-based navigation in App.jsx
// This is ready for future migration to proper routing

// Loading fallback component
const PageLoader = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    background: '#FAFBFC'
  }}>
    <div className="spinner"></div>
  </div>
);

const HomePage = lazy(() => import('@/pages/HomePage'));
const NewsPage = lazy(() => import('@/pages/NewsPage'));
const BusinessPage = lazy(() => import('@/pages/BusinessPage'));
const AdminPortalPage = lazy(() => import('@/pages/AdminPortal'));
const FavoritesPage = lazy(() => import('@/pages/FavoritesPage'));

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<PageLoader />}>
        <HomePage />
      </Suspense>
    ),
  },
  {
    path: '/news',
    element: (
      <Suspense fallback={<PageLoader />}>
        <NewsPage />
      </Suspense>
    ),
  },
  {
    path: '/business',
    element: (
      <Suspense fallback={<PageLoader />}>
        <BusinessPage />
      </Suspense>
    ),
  },
  {
    path: '/favorites',
    element: (
      <Suspense fallback={<PageLoader />}>
        <FavoritesPage />
      </Suspense>
    ),
  },
  {
    path: '/admin',
    element: (
      <Suspense fallback={<PageLoader />}>
        <AdminPortalPage />
      </Suspense>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default function Router() {
  return <RouterProvider router={router} />;
}
