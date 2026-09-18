import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import RootLayout from './components/RootLayout';
import HomeFeed from './pages/HomeFeed';
import MapExplorer from './pages/MapExplorer';
import SealCapsule from './pages/SealCapsule';
import CapsuleDetail from './pages/CapsuleDetail';

// 1. 방금 만든 컴포넌트를 불러옵니다.
import Timeline from './pages/Timeline';
import MyLog from './pages/MyLog';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomeFeed /> },
      { path: '/map', element: <MapExplorer /> },
      { path: '/seal', element: <SealCapsule /> },
      { path: '/detail', element: <CapsuleDetail /> },
      
      // 2. 새로운 경로 2개를 추가합니다.
      { path: '/timeline', element: <Timeline /> },
      { path: '/log', element: <MyLog /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}