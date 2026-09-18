import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';

export default function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = location.pathname.replace('/', '') || 'home';

  return (
    <div className="bg-surface font-body-md text-on-surface flex flex-col min-h-screen">
      <Header currentPath={currentPath} goBack={() => navigate(-1)} />
      
      <main className="flex-1 flex flex-col relative w-full max-w-md mx-auto px-margin pt-16 pb-28 bg-surface">
        <Outlet />
      </main>

      <BottomNav currentPath={currentPath} />
    </div>
  );
}