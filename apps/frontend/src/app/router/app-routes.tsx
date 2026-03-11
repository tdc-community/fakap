import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@app/layout/AppLayout';
import { RequireRoleRoute } from '@features/auth';
import { AuthCallbackPage } from '@pages/auth/AuthCallbackPage';

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout section="home" />,
  },
  {
    path: '/news/:id',
    element: <AppLayout section="news-detail" />,
  },
  {
    path: '/auth/callback',
    element: <AuthCallbackPage />,
  },
  {
    path: '/vehicles',
    element: <AppLayout section="vehicles" />,
  },
  {
    path: '/auctions',
    element: <AppLayout section="auctions" />,
  },
  {
    path: '/contests',
    element: <AppLayout section="contests" />,
  },
  {
    path: '/wallet',
    element: <AppLayout section="wallet" />,
  },
  {
    path: '/account/settings',
    element: <AppLayout section="account-settings" />,
  },
  {
    path: '/admin',
    element: <RequireRoleRoute allow={['admin']} section="admin" />,
  },
  {
    path: '/editor/news',
    element: <RequireRoleRoute allow={['moderator', 'admin']} section="editor-news" />,
  },
  {
    path: '/editor/events',
    element: <RequireRoleRoute allow={['moderator', 'admin']} section="editor-events" />,
  },
  {
    path: '/editor/auctions',
    element: <RequireRoleRoute allow={['moderator', 'admin']} section="editor-auctions" />,
  },
  {
    path: '/editor/contests',
    element: <RequireRoleRoute allow={['moderator', 'admin']} section="editor-contests" />,
  },
  {
    path: '/editor/vehicles',
    element: <RequireRoleRoute allow={['moderator', 'admin']} section="editor-vehicles" />,
  },
]);
