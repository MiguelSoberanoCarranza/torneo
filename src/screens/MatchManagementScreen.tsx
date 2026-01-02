import React from 'react';

const MatchManagementScreen: React.FC = () => {
  return (
    <div className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-xl overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center p-4 pb-2 justify-between">
          <h2 className="text-xl font-bold leading-tight tracking-tight flex-1 dark:text-white text-gray-900">Gestión de Partidos</h2>
          <div className="flex items-center justify-end gap-2">
            <button className="flex items-center justify-center rounded-full h-10 w-10 bg-transparent hover:bg-gray-200 dark:hover:bg-input-dark transition-colors">
              <span className="material-symbols-outlined text-2xl dark:text-white text-gray-700">add_circle</span>
            </button>
            <button className="flex items-center justify-center rounded-full h-10 w-10 bg-transparent hover:bg-gray-200 dark:hover:bg-input-dark transition-colors">
              <span className="material-symbols-outlined text-2xl dark:text-white text-gray-700">tune</span>
            </button>
          </div>
        </div>
        {/* Search Bar */}
        <div className="px-4 pb-3 pt-1">
          <div className="relative flex h-11 w-full items-center">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <span className="material-symbols-outlined text-text-secondary text-[20px]">search</span>
            </div>
            <input
              className="block w-full rounded-xl border-none bg-white dark:bg-input-dark py-2.5 pl-10 pr-3 text-sm text-gray-900 dark:text-white placeholder:text-text-secondary focus:ring-2 focus:ring-primary"
              placeholder="Buscar equipo, liga o árbitro..."
              type="search"
            />
          </div>
        </div>
        {/* Segmented Control */}
        <div className="px-4 pb-4">
          <div className="flex h-10 w-full items-center rounded-lg bg-gray-200 dark:bg-input-dark p-1">
            <label className="group flex cursor-pointer h-full flex-1 items-center justify-center rounded-[5px] transition-all has-[:checked]:bg-white dark:has-[:checked]:bg-card-dark has-[:checked]:shadow-sm">
              <input defaultChecked className="hidden" name="match_filter" type="radio" value="scheduled" />
              <span className="text-xs font-semibold text-gray-500 dark:text-text-secondary group-has-[:checked]:text-primary">Por Jugar</span>
            </label>
            <label className="group flex cursor-pointer h-full flex-1 items-center justify-center rounded-[5px] transition-all has-[:checked]:bg-white dark:has-[:checked]:bg-card-dark has-[:checked]:shadow-sm">
              <input className="hidden" name="match_filter" type="radio" value="live" />
              <span className="text-xs font-semibold text-gray-500 dark:text-text-secondary group-has-[:checked]:text-red-500">En Vivo</span>
            </label>
            <label className="group flex cursor-pointer h-full flex-1 items-center justify-center rounded-[5px] transition-all has-[:checked]:bg-white dark:has-[:checked]:bg-card-dark has-[:checked]:shadow-sm">
              <input className="hidden" name="match_filter" type="radio" value="finished" />
              <span className="text-xs font-semibold text-gray-500 dark:text-text-secondary group-has-[:checked]:text-primary">Terminados</span>
            </label>
          </div>
        </div>
      </header>
      {/* Content Area */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 scroll-smooth">
        {/* Sections for Today and Tomorrow's matches go here */}
      </main>
      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 w-full bg-white/90 dark:bg-background-dark/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-30 pb-safe">
        <div className="flex justify-around items-center h-16">
          {/* Nav items go here */}
        </div>
      </nav>
      {/* FAB for new match */}
      <button className="absolute bottom-20 right-4 h-14 w-14 rounded-full bg-primary shadow-lg shadow-primary/30 flex items-center justify-center text-white z-20 hover:scale-105 transition-transform">
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>
    </div>
  );
};

export default MatchManagementScreen;
