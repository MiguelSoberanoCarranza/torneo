import React from 'react';
import Button from '../components/Button';
import Header from '../components/Header';
import Input from '../components/Input';

const CreateTeamScreen: React.FC = () => {
  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased">
      <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden">
        <Header
          title="Crear Equipo"
          onBack={() => {}}
          rightAction={<button className="text-primary text-base font-bold leading-normal tracking-[0.015em] shrink-0 focus:outline-none hover:text-primary/80 transition-colors">Guardar</button>}
        />

        {/* Scrollable Content */}
        <div className="flex-1 flex flex-col pb-24">
          {/* Badge Upload Section */}
          <div className="w-full flex flex-col items-center justify-center pt-8 pb-6 bg-gradient-to-b from-background-light to-white dark:from-background-dark dark:to-surface-dark/30">
            <div className="relative group cursor-pointer">
              {/* Placeholder Circle */}
              <div className="w-32 h-32 rounded-full bg-white dark:bg-surface-dark border-2 border-dashed border-gray-300 dark:border-border-dark flex items-center justify-center overflow-hidden shadow-lg transition-all group-hover:border-primary">
                <span className="material-symbols-outlined text-text-secondary text-4xl group-hover:text-primary transition-colors">add_a_photo</span>
              </div>
              {/* Edit Badge Button */}
              <div className="absolute bottom-0 right-0 bg-primary rounded-full p-2 border-4 border-background-light dark:border-background-dark shadow-sm">
                <span className="material-symbols-outlined text-white text-sm font-bold">edit</span>
              </div>
            </div>
            <p className="text-text-secondary text-sm mt-4 font-medium">Subir Escudo</p>
          </div>
          <div className="h-px w-full bg-gray-200 dark:bg-border-dark/50 my-2"></div>

          {/* Form Section: Basic Info */}
          <div className="flex flex-col gap-4 px-4 py-4">
            <h3 className="text-slate-900 dark:text-white tracking-tight text-xl font-bold leading-tight pt-2">Información General</h3>
            {/* Team Name Input */}
            <label className="flex flex-col flex-1 group">
              <p className="text-slate-700 dark:text-white text-base font-medium leading-normal pb-2 transition-colors group-focus-within:text-primary">Nombre del Equipo</p>
              <Input
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-slate-900 dark:text-white focus:outline-0 focus:ring-0 border border-gray-300 dark:border-border-dark bg-white dark:bg-surface-dark focus:border-primary dark:focus:border-primary h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal shadow-sm transition-all"
                placeholder="Ej. Leones FC"
              />
            </label>
            {/* League Selector */}
            <label className="flex flex-col flex-1 group mt-2">
              <p className="text-slate-700 dark:text-white text-base font-medium leading-normal pb-2 transition-colors group-focus-within:text-primary">Liga Seleccionada</p>
              <div className="relative">
                <select className="form-select flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-slate-900 dark:text-white focus:outline-0 focus:ring-0 border border-gray-300 dark:border-border-dark bg-white dark:bg-surface-dark focus:border-primary dark:focus:border-primary h-14 placeholder:text-text-secondary pl-4 pr-10 text-base font-normal leading-normal shadow-sm appearance-none transition-all">
                  <option value="1">Liga Premier 2024</option>
                  <option value="2">Torneo Apertura</option>
                  <option value="3">Copa de Verano</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-secondary">
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </label>
          </div>

          {/* Style Section: Colors */}
          <div className="flex flex-col gap-4 px-4 py-4 mt-2">
            <h3 className="text-slate-900 dark:text-white tracking-tight text-xl font-bold leading-tight">Colores del Uniforme</h3>
            <div className="flex gap-4">
              {/* Home Kit Color */}
              <div className="flex-1 bg-white dark:bg-surface-dark rounded-xl p-4 border border-gray-300 dark:border-border-dark flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 transition-all shadow-sm active:scale-95">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-[#ef4444] border-2 border-gray-100 dark:border-white/10 shadow-inner"></div>
                  <div className="absolute -bottom-1 -right-1 bg-white dark:bg-surface-dark rounded-full p-0.5 border border-gray-200 dark:border-border-dark">
                    <span className="material-symbols-outlined text-xs text-text-secondary block">colorize</span>
                  </div>
                </div>
                <span className="text-slate-600 dark:text-text-secondary text-sm font-medium">Local</span>
              </div>
              {/* Away Kit Color */}
              <div className="flex-1 bg-white dark:bg-surface-dark rounded-xl p-4 border border-gray-300 dark:border-border-dark flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 transition-all shadow-sm active:scale-95">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-[#3b82f6] border-2 border-gray-100 dark:border-white/10 shadow-inner"></div>
                  <div className="absolute -bottom-1 -right-1 bg-white dark:bg-surface-dark rounded-full p-0.5 border border-gray-200 dark:border-border-dark">
                    <span className="material-symbols-outlined text-xs text-text-secondary block">colorize</span>
                  </div>
                </div>
                <span className="text-slate-600 dark:text-text-secondary text-sm font-medium">Visitante</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer Action */}
        <div className="fixed bottom-0 left-0 w-full p-4 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl border-t border-gray-200 dark:border-border-dark/50 z-40">
          <Button className="w-full">
            <span className="material-symbols-outlined">add_circle</span>
            Registrar Equipo
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateTeamScreen;
