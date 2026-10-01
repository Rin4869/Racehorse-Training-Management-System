import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from 'react-router-dom';
import './index.css';
import './i18n';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { HorsesPage } from './pages/HorsesPage';
import { HorseDetailPage } from './pages/HorseDetailPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { HealthSchedulePage } from './pages/HealthSchedulePage';
import {
  HorseFormPage,
  HorseOwnershipPage,
  HorsePedigreePage,
  HorseRaceHistoryPage,
  MyHorsesPage,
} from './pages/HorseFlowPages';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { path: '/', element: <Navigate to="/overview" replace /> },
      { path: '/overview', element: <OverviewPage /> },
      {
        path: '/vaccinations',
        element: (
          <RequireAuth roles={['MANAGER', 'TRAINER', 'VET', 'GROOM']}>
            <HealthSchedulePage />
          </RequireAuth>
        ),
      },
      { path: '/horses', element: <HorsesPage /> },
      {
        path: '/my-horses',
        element: (
          <RequireAuth roles={['OWNER']}>
            <MyHorsesPage />
          </RequireAuth>
        ),
      },
      {
        path: '/horses/new',
        element: (
          <RequireAuth roles={['MANAGER']}>
            <HorseFormPage />
          </RequireAuth>
        ),
      },
      {
        path: '/horses/:id/edit',
        element: (
          <RequireAuth roles={['MANAGER']}>
            <HorseFormPage />
          </RequireAuth>
        ),
      },
      { path: '/horses/:id', element: <HorseDetailPage /> },
      { path: '/horses/:id/pedigree', element: <HorsePedigreePage /> },
      { path: '/horses/:id/performance', element: <HorseRaceHistoryPage /> },
      { path: '/horses/:id/ownership', element: <HorseOwnershipPage /> },
      {
        path: '/admin/users',
        element: (
          <RequireAuth roles={['MANAGER']}>
            <AdminUsersPage />
          </RequireAuth>
        ),
      },
      { path: '*', element: <Navigate to="/horses" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
