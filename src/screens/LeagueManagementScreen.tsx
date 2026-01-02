import React from 'react';
import Header from '../components/Header';

const LeagueManagementScreen: React.FC = () => {
  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased selection:bg-primary selection:text-white">
      <div className="relative flex h-full min-h-screen w-full flex-col pb-24">
        <Header
          title="Detalles de Liga"
          onBack={() => {}}
          rightAction={
            <button className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>edit_square</span>
            </button>
          }
        />

        {/* League Header Profile */}
        <div className="px-4 pt-6 pb-2">
          {/* League details go here */}
        </div>

        {/* Stats Cards (Horizontal Scroll) */}
        <div className="flex overflow-x-auto hide-scrollbar gap-3 px-4 py-4 w-full">
          {/* Stat cards go here */}
        </div>

        {/* Segmented Control */}
        <div className="px-4 py-2 sticky top-[72px] z-10 bg-background-light dark:bg-background-dark pb-3">
          {/* Segmented control implementation */}
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-4">
          <div className="relative flex items-center w-full h-12 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 transition-shadow">
            <div className="grid place-items-center h-full w-12 text-slate-400">
              <span className="material-symbols-outlined">search</span>
            </div>
            <input
              className="peer h-full w-full outline-none bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 pr-4 font-normal"
              id="search"
              placeholder="Buscar equipo..."
              type="text"
            />
          </div>
        </div>

        {/* Team List */}
        <div className="flex flex-col gap-3 px-4">
          {/* Team list items go here */}
        </div>

        {/* Floating Action Button */}
        <div className="fixed bottom-6 right-6 z-30">
          <button className="flex items-center justify-center h-14 w-14 rounded-full bg-primary text-white shadow-lg shadow-primary/40 hover:scale-105 active:scale-95 transition-all">
            <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>add</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeagueManagementScreen;
