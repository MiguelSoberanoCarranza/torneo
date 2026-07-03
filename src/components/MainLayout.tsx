import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import { version } from '../../package.json';

const MainLayout: React.FC = () => {
    return (
        <div className="relative min-h-screen pb-24">
            <Outlet />
            <BottomNav />
            <div className="fixed bottom-1 left-0 w-full flex justify-center pointer-events-none z-50">
                <span className="text-[10px] text-gray-400/50 dark:text-gray-600/50 font-mono">
                    v{version}
                </span>
            </div>
        </div>
    );
};

export default MainLayout;
