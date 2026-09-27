import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import RootLayout from './components/RootLayout';
import Home from './pages/Home';
import Leave from './pages/Leave';
import MyLog from './pages/MyLog';
import VideoDetail from './pages/VideoDetail';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/leave', element: <Leave /> },
      { path: '/log', element: <MyLog /> },
      { path: '/video/:id', element: <VideoDetail /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
