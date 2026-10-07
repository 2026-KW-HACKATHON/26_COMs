import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AuthProvider from './components/AuthProvider';
import RequireAuth from './components/RequireAuth';
import RootLayout from './components/RootLayout';
import Feed from './pages/Feed';
import Friends from './pages/Friends';
import Home from './pages/Home';
import Leave from './pages/Leave';
import Login from './pages/Login';
import MyLog from './pages/MyLog';
import Notifications from './pages/Notifications';
import ProfileEdit from './pages/ProfileEdit';
import Ranking from './pages/Ranking';
import VideoDetail from './pages/VideoDetail';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      // 지도는 로그인 없이 둘러볼 수 있고, 기록을 남기거나 보려면 로그인한다
      { path: '/', element: <Home /> },
      { path: '/login', element: <Login /> },
      // 동네 랭킹은 숫자만 보여 줘서 로그인 없이 볼 수 있다 (공유 링크로 처음 들어오는 사람용)
      { path: '/ranking', element: <Ranking /> },
      { path: '/leave', element: <RequireAuth><Leave /></RequireAuth> },
      { path: '/feed', element: <RequireAuth><Feed /></RequireAuth> },
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
