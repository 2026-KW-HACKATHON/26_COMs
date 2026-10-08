import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AuthProvider from './components/AuthProvider';
import RequireAuth from './components/RequireAuth';
import RootLayout from './components/RootLayout';
import Feed from './pages/Feed';
import Friends from './pages/Friends';
import GroupDetail from './pages/GroupDetail';
import GroupNew from './pages/GroupNew';
import Groups from './pages/Groups';
import Home from './pages/Home';
import Leave from './pages/Leave';
import Login from './pages/Login';
import MyLog from './pages/MyLog';
import Notifications from './pages/Notifications';
import Privacy from './pages/Privacy';
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
      { path: '/privacy', element: <Privacy /> },
      { path: '/leave', element: <RequireAuth><Leave /></RequireAuth> },
      { path: '/feed', element: <RequireAuth><Feed /></RequireAuth> },
      { path: '/log', element: <RequireAuth><MyLog /></RequireAuth> },
      { path: '/video/:id', element: <RequireAuth><VideoDetail /></RequireAuth> },
      // 그룹 목록은 기기 저장 모드에서도 안내를 보여 주고, 그룹 화면은 계정이 있어야 한다
      { path: '/groups', element: <RequireAuth><Groups /></RequireAuth> },
      { path: '/groups/new', element: <RequireAuth accountOnly><GroupNew /></RequireAuth> },
      { path: '/groups/:id', element: <RequireAuth accountOnly><GroupDetail /></RequireAuth> },
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
