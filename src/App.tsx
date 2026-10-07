import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AuthProvider from './components/AuthProvider';
import RequireAuth from './components/RequireAuth';
import RootLayout from './components/RootLayout';
import Friends from './pages/Friends';
import Home from './pages/Home';
import Leave from './pages/Leave';
import Login from './pages/Login';
import MyLog from './pages/MyLog';
import Notifications from './pages/Notifications';
import ProfileEdit from './pages/ProfileEdit';
import VideoDetail from './pages/VideoDetail';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      // 지도는 로그인 없이 둘러볼 수 있고, 기록을 남기거나 보려면 로그인한다
      { path: '/', element: <Home /> },
      { path: '/login', element: <Login /> },
      { path: '/leave', element: <RequireAuth><Leave /></RequireAuth> },
      { path: '/log', element: <RequireAuth><MyLog /></RequireAuth> },
      { path: '/video/:id', element: <RequireAuth><VideoDetail /></RequireAuth> },
      { path: '/friends', element: <RequireAuth accountOnly><Friends /></RequireAuth> },
      { path: '/profile', element: <RequireAuth accountOnly><ProfileEdit /></RequireAuth> },
      { path: '/notifications', element: <RequireAuth accountOnly><Notifications /></RequireAuth> },
    ],
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
