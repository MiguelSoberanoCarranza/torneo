import React from 'react';

const CalendarScreen: React.FC = () => {
  return (
    <div className="bg-background-light dark:bg-background-dark transition-colors duration-200">
      <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl">
        {/* Header */}
        <header className="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky top-0 z-20">
          <h2 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight tracking-tight flex-1">Calendario</h2>
          <div className="flex items-center justify-end gap-3">
            <button className="flex items-center justify-center rounded-full w-10 h-10 bg-transparent text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-gray-800 transition-colors">
              <span className="material-symbols-outlined text-[24px]">search</span>
            </button>
            <button className="flex items-center justify-center rounded-full w-10 h-10 bg-primary text-white shadow-lg hover:bg-primary-dark transition-colors">
              <span className="material-symbols-outlined text-[24px]">auto_fix</span>
            </button>
          </div>
        </header>

        {/* Segmented Control */}
        <div className="px-4 py-3 bg-background-light dark:bg-background-dark z-10">
          <div className="flex h-10 w-full items-center justify-center rounded-lg bg-gray-200 dark:bg-[#232f48] p-1">
            <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-md transition-all duration-200 has-[:checked]:bg-white dark:has-[:checked]:bg-background-dark has-[:checked]:shadow-sm text-slate-500 dark:text-[#92a4c9] has-[:checked]:text-primary dark:has-[:checked]:text-white text-sm font-bold leading-normal">
              <span className="truncate">Mensual</span>
              <input defaultChecked className="invisible w-0 absolute" name="view-toggle" type="radio" value="Mensual" />
            </label>
            <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-md transition-all duration-200 has-[:checked]:bg-white dark:has-[:checked]:bg-background-dark has-[:checked]:shadow-sm text-slate-500 dark:text-[#92a4c9] has-[:checked]:text-primary dark:has-[:checked]:text-white text-sm font-bold leading-normal">
              <span className="truncate">Semanal</span>
              <input className="invisible w-0 absolute" name="view-toggle" type="radio" value="Semanal" />
            </label>
          </div>
        </div>

        {/* Calendar Component */}
        <div className="bg-background-light dark:bg-background-dark px-4 pb-4 border-b border-gray-200 dark:border-gray-800">
          {/* Calendar implementation goes here */}
        </div>

        {/* Schedule List */}
        <div className="flex-1 bg-background-light dark:bg-background-dark pb-20">
          {/* Match Cards implementation goes here */}
        </div>

        {/* Floating Action Button */}
        <button className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-xl shadow-primary/40 flex items-center justify-center hover:bg-primary-dark transition-transform active:scale-95 z-30">
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>
      </div>
    </div>
  );
};

export default CalendarScreen;
