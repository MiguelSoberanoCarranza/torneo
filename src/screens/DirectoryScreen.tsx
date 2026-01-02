import React from 'react';

const DirectoryScreen: React.FC = () => {
  return (
    <div className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-background-light dark:bg-background-dark overflow-x-hidden shadow-2xl">
      {/* Top App Bar */}
      <header className="sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center px-4 py-3 justify-between">
          <h2 className="text-gray-900 dark:text-white text-xl font-bold leading-tight tracking-tight">Directorio</h2>
          <button className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30">
            <span className="material-symbols-outlined text-2xl">add</span>
          </button>
        </div>
        {/* Segmented Control */}
        <div className="px-4 pb-3">
          <div className="flex h-12 w-full items-center rounded-xl bg-gray-200 dark:bg-surface-dark p-1">
            <label className="group flex-1 cursor-pointer h-full relative">
              <input defaultChecked className="peer sr-only" name="directory_type" type="radio" value="Jugadores" />
              <div className="absolute inset-0 rounded-lg bg-white dark:bg-primary shadow-sm opacity-0 peer-checked:opacity-100 transition-all duration-200 ease-out"></div>
              <span className="relative z-10 flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500 dark:text-text-secondary peer-checked:text-primary dark:peer-checked:text-white transition-colors">
                Jugadores
              </span>
            </label>
            <label className="group flex-1 cursor-pointer h-full relative">
              <input className="peer sr-only" name="directory_type" type="radio" value="Arbitros" />
              <div className="absolute inset-0 rounded-lg bg-white dark:bg-primary shadow-sm opacity-0 peer-checked:opacity-100 transition-all duration-200 ease-out"></div>
              <span className="relative z-10 flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500 dark:text-text-secondary peer-checked:text-primary dark:peer-checked:text-white transition-colors">
                Árbitros
              </span>
            </label>
          </div>
        </div>
      </header>
      {/* Search Bar Area */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative flex w-full items-center h-12 rounded-xl bg-white dark:bg-surface-dark shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 transition-all">
          <div className="pl-4 pr-2 text-gray-400 dark:text-text-secondary">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input
            className="flex-1 bg-transparent border-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-text-secondary focus:ring-0 text-base font-normal h-full"
            placeholder="Buscar nombre, equipo..."
            type="text"
          />
          <div className="pr-3">
            <button className="flex items-center justify-center p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-text-secondary transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>tune</span>
            </button>
          </div>
        </div>
      </div>
      {/* Filter Chips */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar mask-linear-fade">
        {/* Filter chips go here */}
      </div>
      {/* Content List */}
      <div className="flex-1 px-4 py-2 space-y-3 pb-24">
        {/* List items go here */}
      </div>
    </div>
  );
};

export default DirectoryScreen;
