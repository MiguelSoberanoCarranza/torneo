import React from 'react';
import BottomNav from '../components/BottomNav';

const DashboardScreen: React.FC = () => {
  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased pb-24">
      {/* Top App Bar / Sticky Header */}
      <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="flex items-center justify-between px-4 py-3">
          {/* User Profile */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="size-10 rounded-full bg-cover bg-center border-2 border-primary/20"
                style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuBL3cu8ucHnWgatFFctYqHVjoWNbMk_7ivJrYHiMoBpOwAUQxNWoINTnXdqOSGh4ydG0BGkZfoYa_X4kzS_EuPTbzm6PML0KtrdS7J-QjlQtu2fERLaEOgzsyPZzRGZCkWge5vcUtj9BMP-Brqpwh46UoOTNmforsFgUpq1k9barJxvnsPWxw1CODetzd6l-dOSdZYvItZSipIVSeGuiYC4-s21p--FDiA8G_Me70hr51FB27jnF2bVRCWRFlEifa-3RYW9mcLxaFs')` }}
              ></div>
              <div className="absolute bottom-0 right-0 size-3 rounded-full bg-green-500 border-2 border-background-light dark:border-background-dark"></div>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bienvenido</p>
              <h2 className="text-sm font-bold leading-tight">Carlos Ruiz</h2>
            </div>
          </div>
          {/* Action Icons */}
          <div className="flex items-center gap-2">
            <button className="flex items-center justify-center size-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors">
              <span className="material-symbols-outlined">search</span>
            </button>
            <button className="flex items-center justify-center size-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 size-2 rounded-full bg-red-500"></span>
            </button>
          </div>
        </div>
      </div>
      {/* Main Content */}
      <div className="flex flex-col w-full">
        {/* My Leagues Carousel */}
        <div className="pt-6 pb-2">
          <div className="flex items-center justify-between px-4 mb-3">
            <h3 className="text-lg font-bold tracking-tight">Mis Ligas</h3>
            <button className="text-xs font-semibold text-primary">Ver todas</button>
          </div>
          <div className="flex w-full overflow-x-auto no-scrollbar px-4 gap-4 pb-2">
            {/* Create New League Item */}
            <div className="flex flex-col items-center gap-2 min-w-[80px]">
              <button className="size-[80px] rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-slate-400 dark:border-slate-600 text-primary hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                <span className="material-symbols-outlined text-3xl">add</span>
              </button>
              <span className="text-xs font-medium text-center truncate w-full">Crear Liga</span>
            </div>
            {/* League Items... */}
          </div>
        </div>
        {/* Live Now Section */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex size-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2.5 bg-red-500"></span>
            </div>
            <h3 className="text-lg font-bold tracking-tight">En Juego</h3>
          </div>
          {/* Live Card */}
          <div className="relative w-full rounded-2xl overflow-hidden shadow-lg bg-surface-dark border border-slate-800">
            {/* Background Image with Overlay */}
            <div
              className="absolute inset-0 z-0 opacity-40 mix-blend-overlay bg-cover bg-center"
              style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDk578ojfyn28YcnGWLME5fLnwHpRs-h7J6oldxDXDTxPPthQvPVxDoRjZzVGSTt4d9wVWUibZyHBjeXtnPxVnA1jhjMUd4eop9HmWJBcooVe4EGCaCxM70gpgvZgI7eSm7OW4hnCGFcmtXd-7W9oO_PjdBmW5k6YAOWh8lkXDVGtz3MtJmnhSPUmZYwmQVB3x4y8Rc1XjYmifY5DmcwMF_Z0oviOK3w-if2hVK5hB1kbdExiVm06pwCYgTDLqopo6HCJXRLNw5Pus')` }}
            ></div>
            <div className="relative z-10 p-5 flex flex-col items-center justify-center text-white">
              <div className="flex items-center justify-between w-full mb-4">
                <span className="text-[10px] uppercase font-bold tracking-wider bg-red-500/90 px-2 py-0.5 rounded text-white">En Vivo</span>
                <span className="text-xs font-medium text-slate-300">Torneo Verano • Final</span>
              </div>
              <div className="flex items-center justify-between w-full gap-2">
                {/* Team A */}
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="size-14 rounded-full bg-white p-1">
                    <img alt="Leones FC Logo" className="w-full h-full rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCKFzHqCBtUPiZURaqwNilLl67NS4KOGEIpPvKW6oEXYQni1lMccRLao0QDMKlzs00CYLT2Qz96VRthGg0Kmk6XfJ4n7IAWgSKcIbzwyCcT1CGrJhAl_wvqtB4BqH8MjomEEvRev7aYzPYfx3Knpb2qgkv2qqgCCGz0tSGK8LQlwtpvt0hwNsG7CFFpHGS6oNNXNZVJtxfJJQ8-G7LD5meF0vMGTE88rHhpwZc9Zzlfx-Lv8zh1GarG-wwgspgkbongE1aG5xtBTbM" />
                  </div>
                  <span className="text-sm font-bold text-center leading-tight">Leones FC</span>
                </div>
                {/* Score */}
                <div className="flex flex-col items-center px-2">
                  <div className="text-4xl font-display font-black tracking-widest tabular-nums">2 - 1</div>
                  <div className="text-xs font-medium text-green-400 mt-1">68'</div>
                </div>
                {/* Team B */}
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="size-14 rounded-full bg-white p-1">
                    <img alt="Tigres FC Logo" className="w-full h-full rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAYMbV1RxoWtKs0SNHaftpsmEFMBpKAw9ahv1jUM42AW3GynmQcGQlJlPeUC09PLyw093zNrXkUbkxmn9keyMYAQ48bpiEnRq4t5A5SLrIpgtWnd4mBdbEA10wREbGUQ-LTNT2jCrafSeeIeIL9eA76X5altYyURoRDiEZHxJb5nLt8g0OqCye_DOWr4qcyBKrk-2LuBu152eojbUXrgS3csmnf92y1NztBjiTNe0c4MomWL9IAq3LRxErI3txvlhIGJVtMSubxf1E" />
                  </div>
                  <span className="text-sm font-bold text-center leading-tight">Tigres FC</span>
                </div>
              </div>
            </div>
            {/* Progress Bar mimicking time */}
            <div className="h-1 w-full bg-slate-700 mt-2">
              <div className="h-full bg-green-500 w-[75%]"></div>
            </div>
          </div>
        </div>
        {/* Upcoming Matches */}
        <div className="px-4 py-2">
          <h3 className="text-lg font-bold tracking-tight mb-3">Próximos Partidos</h3>
          <div className="flex flex-col gap-3">
            {/* Date Header */}
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-1">Hoy</p>
            {/* Match Cards... */}
          </div>
        </div>
        {/* Recent Results */}
        <div className="px-4 py-4 pb-8">
          <h3 className="text-lg font-bold tracking-tight mb-3">Resultados Recientes</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Result Cards... */}
          </div>
        </div>
      </div>
      {/* Floating Action Button (Admin/Creator) */}
      <div className="fixed bottom-24 right-4 z-30">
        <button className="bg-primary hover:bg-blue-600 text-white rounded-full size-14 shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95">
          <span className="material-symbols-outlined text-2xl">add</span>
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

export default DashboardScreen;
