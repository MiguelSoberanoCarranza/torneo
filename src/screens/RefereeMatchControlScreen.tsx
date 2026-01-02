import React from 'react';

const RefereeMatchControlScreen: React.FC = () => {
  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display min-h-screen flex flex-col transition-colors duration-200">
      {/* Top App Bar */}
      <header className="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-none mb-1">Liga Primera • Jornada 5</h1>
          <h2 className="text-lg font-bold leading-none tracking-tight">Los Tigres vs Halcones</h2>
        </div>
        <button className="flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
          Finalizar
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 gap-5 max-w-md mx-auto w-full">
        {/* Scoreboard & Timer Card */}
        <section className="rounded-2xl bg-white dark:bg-card-dark shadow-sm dark:shadow-[0_0_4px_rgba(0,0,0,0.3)] p-5 flex flex-col items-center gap-4 relative overflow-hidden">
          {/* Background Decoration */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-purple-500"></div>
          <div className="flex items-center justify-between w-full mb-1">
            <div className="flex flex-col items-center flex-1">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mb-2 overflow-hidden flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-500 text-3xl">pets</span>
              </div>
              <span className="text-sm font-bold text-center leading-tight">Los Tigres</span>
            </div>
            <div className="flex flex-col items-center mx-2 z-10">
              <div className="text-5xl font-black tracking-tighter tabular-nums leading-none mb-2">
                15:30
              </div>
              <div className="flex items-center gap-3 text-2xl font-bold text-slate-400 dark:text-slate-500">
                <span className="text-slate-900 dark:text-white">2</span>
                <span>-</span>
                <span className="text-slate-900 dark:text-white">1</span>
              </div>
            </div>
            <div className="flex flex-col items-center flex-1">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mb-2 overflow-hidden flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-3xl">flight</span>
              </div>
              <span className="text-sm font-bold text-center leading-tight">Halcones</span>
            </div>
          </div>
          {/* Timer Controls */}
          <div className="flex items-center gap-3 mt-1 w-full">
            <button className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span>+1 Min</span>
            </button>
            <button className="flex-[2] h-12 flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all active:scale-95">
              <span className="material-symbols-outlined fill-1">pause</span>
              <span>Pausar Tiempo</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">1er Tiempo - En Juego</span>
          </div>
        </section>

        {/* View Switcher */}
        <div className="flex p-1 bg-slate-200 dark:bg-slate-800/50 rounded-xl">
          <button className="flex-1 py-2 px-4 rounded-lg bg-white dark:bg-card-dark shadow-sm text-sm font-bold text-primary transition-all">
            Controles
          </button>
          <button className="flex-1 py-2 px-4 rounded-lg text-slate-500 dark:text-slate-400 text-sm font-medium hover:text-slate-700 dark:hover:text-slate-200 transition-all">
            Alineaciones
          </button>
        </div>

        {/* Team Controls Area */}
        <div className="flex flex-col gap-4">
          {/* Home Team Actions */}
          <div className="bg-white dark:bg-card-dark rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <h3 className="font-bold text-lg">Los Tigres</h3>
              </div>
              <span className="text-xs font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500">Local</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 transition-colors group">
                <span className="material-symbols-outlined text-3xl group-active:scale-90 transition-transform">sports_soccer</span>
                <span className="text-[10px] font-bold uppercase">Gol</span>
              </button>
              <button className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 text-amber-600 dark:text-amber-400 transition-colors group">
                <span className="material-symbols-outlined text-3xl rotate-90 group-active:scale-90 transition-transform">style</span>
                <span className="text-[10px] font-bold uppercase">Amarilla</span>
              </button>
              <button className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-600 dark:text-red-400 transition-colors group">
                <span className="material-symbols-outlined text-3xl rotate-90 group-active:scale-90 transition-transform">style</span>
                <span className="text-[10px] font-bold uppercase">Roja</span>
              </button>
              <button className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors group">
                <span className="material-symbols-outlined text-3xl group-active:scale-90 transition-transform">published_with_changes</span>
                <span className="text-[10px] font-bold uppercase">Cambio</span>
              </button>
            </div>
          </div>
          {/* Away Team Actions */}
          <div className="bg-white dark:bg-card-dark rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary"></span>
                <h3 className="font-bold text-lg">Halcones FC</h3>
              </div>
              <span className="text-xs font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500">Visitante</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 transition-colors group">
                <span className="material-symbols-outlined text-3xl group-active:scale-90 transition-transform">sports_soccer</span>
                <span className="text-[10px] font-bold uppercase">Gol</span>
              </button>
              <button className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 text-amber-600 dark:text-amber-400 transition-colors group">
                <span className="material-symbols-outlined text-3xl rotate-90 group-active:scale-90 transition-transform">style</span>
                <span className="text-[10px] font-bold uppercase">Amarilla</span>
              </button>
              <button className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-600 dark:text-red-400 transition-colors group">
                <span className="material-symbols-outlined text-3xl rotate-90 group-active:scale-90 transition-transform">style</span>
                <span className="text-[10px] font-bold uppercase">Roja</span>
              </button>
              <button className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors group">
                <span className="material-symbols-outlined text-3xl group-active:scale-90 transition-transform">published_with_changes</span>
                <span className="text-[10px] font-bold uppercase">Cambio</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RefereeMatchControlScreen;
