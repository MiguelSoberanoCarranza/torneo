import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import { version } from '../../package.json';

const MainLayout: React.FC = () => {
    return (
        <div className="relative min-h-screen pb-24">
            <Outlet />
            <BottomNav />
            <div className="absolute bottom-1 w-full text-center text-[10px] text-gray-400 dark:text-gray-600 pointer-events-none z-0">
                v{version}
            </div>
        </div>
    );
};

export default MainLayout;
