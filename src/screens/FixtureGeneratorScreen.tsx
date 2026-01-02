import React from 'react';
import Button from '../components/Button';
import Header from '../components/Header';

const FixtureGeneratorScreen: React.FC = () => {
  return (
    <div className="bg-background-light dark:bg-background-dark text-[#111418] dark:text-white font-display overflow-x-hidden antialiased selection:bg-primary selection:text-white">
      <div className="relative flex h-full min-h-screen w-full flex-col">
        <Header title="Generador de Fixture" onBack={() => {}} />
        {/* Main Scrollable Content */}
        <div className="flex-1 flex flex-col gap-6 p-4 pb-32 max-w-md mx-auto w-full">
          {/* League Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-[#111418] dark:text-white text-base font-medium leading-normal">Seleccionar Liga</label>
            <div className="relative">
              <select className="form-select w-full rounded-xl border border-[#dce0e5] dark:border-border-dark bg-white dark:bg-surface-dark text-[#111418] dark:text-white h-14 pl-4 pr-10 text-base font-normal focus:border-primary focus:ring-1 focus:ring-primary appearance-none outline-none transition-colors">
                <option value="1">Torneo Apertura 2024</option>
                <option value="2">Liga Master Senior</option>
                <option value="3">Copa de Verano</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary flex items-center">
                <span className="material-symbols-outlined">expand_more</span>
              </div>
            </div>
          </div>
          {/* Team Summary Card */}
          <div className="flex items-stretch justify-between gap-4 rounded-xl bg-white dark:bg-surface-dark border border-[#dce0e5] dark:border-border-dark p-4 shadow-sm">
            {/* Team summary content */}
          </div>
          {/* Section Header */}
          <div>
            <h3 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] pt-2">Configuración</h3>
          </div>
          {/* Date Picker */}
          <div className="flex flex-col gap-2">
            <label className="text-[#111418] dark:text-white text-base font-medium leading-normal">Fecha de Inicio</label>
            <div className="relative flex w-full items-center rounded-xl border border-[#dce0e5] dark:border-border-dark bg-white dark:bg-surface-dark focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors h-14">
              <input
                className="flex w-full min-w-0 flex-1 resize-none bg-transparent text-[#111418] dark:text-white focus:outline-none h-full pl-4 pr-12 text-base font-normal leading-normal border-none"
                type="date"
                defaultValue="2024-04-15"
              />
              <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center w-12 text-text-secondary pointer-events-none">
                <span className="material-symbols-outlined">calendar_today</span>
              </div>
            </div>
          </div>
          {/* Toggle Switch: Ida y Vuelta */}
          <div className="flex items-center justify-between rounded-xl bg-white dark:bg-surface-dark border border-[#dce0e5] dark:border-border-dark p-4">
            {/* Toggle switch content */}
          </div>
          {/* Match Days (Chips) */}
          <div className="flex flex-col gap-2">
            <label className="text-[#111418] dark:text-white text-base font-medium leading-normal">Días de Juego</label>
            <div className="flex flex-wrap gap-2">
              {/* Day selection buttons */}
            </div>
          </div>
          {/* Algorithm Segmented Control */}
          <div className="flex flex-col gap-2">
            <label className="text-[#111418] dark:text-white text-base font-medium leading-normal">Método de Cruces</label>
            <div className="flex p-1 bg-[#e0e4e9] dark:bg-[#0b0f17] rounded-xl">
              {/* Algorithm selection buttons */}
            </div>
            <p className="text-text-secondary text-xs px-1">Se generarán cruces al azar sin respetar posiciones anteriores.</p>
          </div>
        </div>
        {/* Fixed Bottom Action */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-lg border-t border-transparent dark:border-[#324467]/30 pb-8 z-20">
          <div className="max-w-md mx-auto w-full">
            <Button className="w-full">
              <span className="material-symbols-outlined">auto_fix_high</span>
              Generar Calendario
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FixtureGeneratorScreen;
