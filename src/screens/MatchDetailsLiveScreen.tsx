import React from 'react';
import Header from '../components/Header';

const MatchDetailsLiveScreen: React.FC = () => {
  return (
    <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex flex-col overflow-x-hidden antialiased text-slate-900 dark:text-white">
      <Header
        title="Jornada 10"
        onBack={() => {}}
        rightAction={
          <button className="flex items-center justify-center p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined text-slate-900 dark:text-white">share</span>
          </button>
        }
      />

      {/* Main Content */}
      <main className="flex-1 w-full max-w-lg mx-auto pb-12">
        {/* Live Badge */}
        <div className="flex justify-center pt-6 pb-2">
          <div className="flex items-center gap-x-2 rounded-full bg-red-500/20 border border-red-500/30 px-3 py-1 animate-pulse">
            <div className="h-2 w-2 rounded-full bg-red-500"></div>
            <p className="text-red-500 text-xs font-bold tracking-wider">EN VIVO</p>
          </div>
        </div>
        {/* Scoreboard Hero */}
        <div className="px-4 py-4">
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50 p-6 flex flex-col gap-6">
            {/* Timer */}
            <div className="flex justify-center items-center">
              <div className="bg-slate-100 dark:bg-background-dark px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                <p className="text-primary font-bold text-lg tabular-nums tracking-tight">45:00 <span className="text-xs text-primary/70 font-medium">+3</span></p>
              </div>
            </div>
            {/* Teams & Score */}
            <div className="flex items-center justify-between gap-4">
              {/* Team A */}
              <div className="flex flex-col items-center flex-1 gap-3">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center shadow-inner overflow-hidden border-2 border-slate-200 dark:border-slate-600 p-1">
                  <div
                    className="w-full h-full bg-center bg-no-repeat bg-cover rounded-full"
                    style={{ backgroundImage: `url("https://lh3.googleusercontent.com/aida-public/AB6AXuCBruZumBgJFdRt_U-fIWCNnO9S197gAL9glG-EOTB-XpYbIbc_n6N23xh0qxK3hfpmZKM12Md6Dg_K2PqAtbGpvlXQgHT-kfPhQ6qL9RNvxbk5JHDco6-hQZiiqLcXVIROv3CNuwFhKp01hQR5weVkLJHZcT8tjbHebHXbZ9KzzgCaJjfKy1UOUAHaY3YyPBLWVeyPH3RMUl9pGJmc3I56MsyswH1d4QMLrt3qfv6O0qdD_fp09Pjj8ehCEjj3dwf-mOA_XW_-o08")` }}
                  ></div>
                </div>
                <h3 className="text-center font-bold text-sm leading-tight">Tigres FC</h3>
              </div>
              {/* Score */}
              <div className="flex flex-col items-center justify-center">
                <div className="text-5xl font-extrabold tracking-tighter text-slate-900 dark:text-white flex items-center gap-2">
                  <span>2</span>
                  <span className="text-slate-300 dark:text-slate-600 text-3xl">-</span>
                  <span>1</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">2do Tiempo</p>
              </div>
              {/* Team B */}
              <div className="flex flex-col items-center flex-1 gap-3">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center shadow-inner overflow-hidden border-2 border-slate-200 dark:border-slate-600 p-1">
                  <div
                    className="w-full h-full bg-center bg-no-repeat bg-cover rounded-full"
                    style={{ backgroundImage: `url("https://lh3.googleusercontent.com/aida-public/AB6AXuC3jQqgjK4YDyXjvSkHco3waJ5lR5qNt_QeRRZYLM_psdewpfsdhxpEuB4-HCKRLs7JjE_ZW-WY8NntSqC-4XNtMOCrGzm-NEk3ZghcoEfDclFEVjHgd00-f2-38JJeiXoWiRGqkNsHf7GMbEicy8xH4CuXJ_rzgJfGvJJwRLBGMf3oGWR_d3M_nznyb4aSmVQdCTwBakjpz5KlWChnUBSSiZddyqI7clLmI8SrYJ6jLpjyKAgqOoMPebgX1pBlWPNPAh1Uxd_LkW4")` }}
                  ></div>
                </div>
                <h3 className="text-center font-bold text-sm leading-tight">Rayos</h3>
              </div>
            </div>
            {/* Stats Summary */}
            <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-700 mt-2 border-t border-slate-200 dark:border-slate-700 pt-4">
              <div className="flex flex-col items-center">
                <span className="text-xs text-slate-500">Posesión</span>
                <span className="font-bold text-sm">45%</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs text-slate-500">Tiros al Arco</span>
                <span className="font-bold text-sm">6</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs text-slate-500">Tarjetas</span>
                <span className="font-bold text-sm text-yellow-500">2</span>
              </div>
            </div>
          </div>
        </div>
        {/* Timeline Section */}
        <div className="px-4 mt-2">
          <h3 className="text-lg font-bold mb-4 px-2">Minuto a Minuto</h3>
          <div className="relative flex flex-col gap-6 pl-4 pr-2 timeline-line">
            {/* Timeline events go here */}
          </div>
        </div>
      </main>
      {/* Bottom Actions (Optional for spectator interaction) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background-light dark:from-background-dark to-transparent pointer-events-none flex justify-center z-40">
        <button className="bg-primary hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-lg pointer-events-auto transition-transform hover:scale-105 active:scale-95 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">refresh</span>
          Actualizar
        </button>
      </div>
    </div>
  );
};

export default MatchDetailsLiveScreen;
