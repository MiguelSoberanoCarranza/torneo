import React from 'react';
import Button from '../components/Button';
import Input from '../components/Input';

const PlayerJoinScreen: React.FC = () => {
  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center justify-center relative overflow-hidden text-[#111418] dark:text-white">
      {/* Background Decoration */}
      <div className="absolute inset-0 z-0 bg-pattern opacity-[0.03] dark:opacity-[0.15] pointer-events-none"></div>
      {/* Gradient Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none"></div>

      <div className="relative w-full max-w-md h-full min-h-screen flex flex-col bg-transparent z-10">
        {/* Top Bar */}
        <div className="flex items-center p-4 justify-between">
          <button className="text-[#111418] dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">Unirse a la Liga</h2>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col px-4 pb-6 overflow-y-auto">
          {/* Hero Image / Illustration */}
          <div className="mt-4 mb-6">
            <div
              className="w-full h-48 rounded-xl bg-center bg-cover relative overflow-hidden group shadow-lg"
              style={{ backgroundImage: `url("https://lh3.googleusercontent.com/aida-public/AB6AXuAAtnp75M7aOjffl5Tqo4FB0HsQN4k5mMAdhAebgL93eImGfUSFCavXX703U0zh_8sQ8OOnXkhAgYkR4nmoEwBPMRVNpzw35rhvCp5INq9LfQ0jyv_P5eK2-N_NLLSabS0cJN7LJfiYFU-iH8boBIzrMXvhi1J-278vn1_aJk1IaRhqHwI3_-KKPwVRd8ek1cjjZn09zDTjn9Vkf1KlbjYPnuf6h2Ctraf2tBqILTPikYCj4tJ8zgg2SyJ8bjUrMCEejDphJpWx5l8")` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-background-dark/90 via-background-dark/40 to-transparent"></div>
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-primary">sports_soccer</span>
                  <span className="text-xs font-medium uppercase tracking-wider text-primary">Liga Connect</span>
                </div>
                <h3 className="text-xl font-bold">Estadísticas en tiempo real</h3>
              </div>
            </div>
          </div>

          {/* Header Texts */}
          <div className="mb-8 text-center">
            <h1 className="text-[#111418] dark:text-white tracking-tight text-3xl font-bold leading-tight mb-2">Bienvenido Jugador</h1>
            <p className="text-[#637588] dark:text-[#93adc8] text-base font-normal leading-normal">
              Introduce el código del torneo para sincronizar tus partidos y estadísticas.
            </p>
          </div>

          {/* Form */}
          <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
            {/* Tournament Code Field */}
            <div>
              <label className="block text-[#111418] dark:text-white text-sm font-medium mb-2 pl-1" htmlFor="tournament-code">
                Código del Torneo
              </label>
              <Input
                id="tournament-code"
                icon="vpn_key"
                placeholder="TOR-8821"
                type="text"
                autoComplete="off"
                className="form-input block w-full pl-10 pr-3 py-3.5 rounded-xl border border-[#dce0e5] dark:border-border-dark bg-white dark:bg-surface-dark text-[#111418] dark:text-white placeholder-[#637588] dark:placeholder-[#92a4c9] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-display tracking-widest uppercase text-lg"
              />
            </div>
            {/* Player Name Field */}
            <div>
              <label className="block text-[#111418] dark:text-white text-sm font-medium mb-2 pl-1" htmlFor="player-name">
                Nombre del Jugador <span className="text-[#637588] dark:text-[#92a4c9] font-normal text-xs ml-1">(Opcional)</span>
              </label>
              <Input
                id="player-name"
                icon="person"
                placeholder="Tu nombre completo"
                type="text"
                className="form-input block w-full pl-10 pr-3 py-3.5 rounded-xl border border-[#dce0e5] dark:border-border-dark bg-white dark:bg-surface-dark text-[#111418] dark:text-white placeholder-[#637588] dark:placeholder-[#92a4c9] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-display text-base"
              />
            </div>
            {/* Helper Text */}
            <div className="flex items-center justify-end">
              <button className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors">
                <span className="material-symbols-outlined text-[16px]">help</span>
                ¿Dónde encuentro mi código?
              </button>
            </div>
            {/* Submit Button */}
            <Button className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-primary/20 transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4">
              <span>Acceder a la Liga</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </Button>
          </form>

          <div className="flex-1"></div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[#dce0e5] dark:border-border-dark/50 text-center">
            <p className="text-sm text-[#637588] dark:text-[#93adc8] mb-3">
              ¿Eres administrador u organizador?
            </p>
            <button className="w-full py-3 px-4 rounded-xl border border-[#dce0e5] dark:border-border-dark bg-white dark:bg-surface-dark/50 text-[#111418] dark:text-white font-medium hover:bg-[#f0f2f4] dark:hover:bg-surface-dark transition-colors flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
              Iniciar sesión como Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerJoinScreen;
