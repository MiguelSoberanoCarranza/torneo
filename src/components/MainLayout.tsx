import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

const MainLayout: React.FC = () => {
    return (
        <div className="relative min-h-screen pb-24">
            <Outlet />
            <BottomNav />
        </div>
    );
};

export default MainLayout;
