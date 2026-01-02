import React from 'react';

const BottomNav: React.FC = () => {
  return (
    <nav className="fixed bottom-0 w-full bg-white dark:bg-surface-dark border-t border-slate-200 dark:border-slate-800 pt-2 pb-6 px-6 flex justify-between items-center z-40">
      <button className="flex flex-col items-center gap-1 w-12 group">
        <span className="material-symbols-outlined filled text-primary text-2xl group-hover:scale-110 transition-transform">home</span>
        <span className="text-[10px] font-medium text-primary">Inicio</span>
      </button>
      <button className="flex flex-col items-center gap-1 w-12 group">
        <span className="material-symbols-outlined text-slate-400 text-2xl group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">trophy</span>
        <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">Ligas</span>
      </button>
      <button className="flex flex-col items-center gap-1 w-12 group">
        <span className="material-symbols-outlined text-slate-400 text-2xl group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">groups</span>
        <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">Equipos</span>
      </button>
      <button className="flex flex-col items-center gap-1 w-12 group">
        <span className="material-symbols-outlined text-slate-400 text-2xl group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">person</span>
        <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">Perfil</span>
      </button>
    </nav>
  );
};

export default BottomNav;
