import React from 'react';
import Header from '../components/Header';

const LeagueTableScreen: React.FC = () => {
  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased text-gray-900 dark:text-white">
      <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-10">
        <Header
          title="Tabla General"
          onBack={() => {}}
          rightAction={
            <button className="flex cursor-pointer items-center justify-center rounded-lg h-10 w-10 bg-surface-light dark:bg-surface-dark text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#232f48] transition-colors">
              <span className="material-symbols-outlined text-2xl">filter_list</span>
            </button>
          }
        />
        {/* Chips: Filters */}
        <div className="flex gap-3 p-4 overflow-x-auto hide-scrollbar sticky top-[65px] z-30 bg-background-light dark:bg-background-dark">
          {/* Filter chips go here */}
        </div>
        {/* Headline & Meta */}
        <div className="px-4 pt-2">
          <h3 className="text-gray-900 dark:text-white tracking-tight text-2xl font-bold leading-tight">Clasificación</h3>
          <p className="text-gray-500 dark:text-[#92a4c9] text-sm font-normal leading-normal pb-3 pt-1">Liga Premier - Temporada Regular</p>
        </div>
        {/* League Summary Stats */}
        <div className="mx-4 mb-6 grid grid-cols-3 rounded-xl bg-surface-light dark:bg-surface-dark p-4 shadow-sm border border-gray-200 dark:border-gray-800">
          {/* Summary stats go here */}
        </div>
        {/* Sticky Table Container */}
        <div className="flex-1 w-full overflow-hidden flex flex-col pl-4">
          <div className="w-full overflow-x-auto pb-4 pr-4">
            <table className="w-full border-separate border-spacing-0 text-left">
              {/* Table header and body go here */}
            </table>
          </div>
        </div>
        {/* Legend / Footer */}
        <div className="mx-4 mt-2 mb-20 rounded-lg bg-surface-light dark:bg-surface-dark p-4 border border-gray-200 dark:border-gray-800">
          {/* Legend content */}
        </div>
        {/* Floating Action Button for Updates */}
        <div className="fixed bottom-6 right-6 z-50">
          <button className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-blue-900/40 hover:scale-105 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-2xl">refresh</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeagueTableScreen;
