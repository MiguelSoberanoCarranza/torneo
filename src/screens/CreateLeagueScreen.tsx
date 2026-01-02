import React from 'react';
import Button from '../components/Button';
import Card from '../components/Card';
import Header from '../components/Header';
import Input from '../components/Input';
import Textarea from '../components/Textarea';

const CreateLeagueScreen: React.FC = () => {
  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display min-h-screen flex flex-col antialiased pb-24 selection:bg-primary selection:text-white">
      <Header title="Crear Liga" onBack={() => {}} />

      {/* Main Content Scroll */}
      <div className="flex-1 w-full max-w-md mx-auto flex flex-col px-4 pt-4 gap-6">
        {/* Shield/Logo Uploader */}
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative group cursor-pointer">
            {/* Avatar Circle */}
            <div
              className="w-32 h-32 rounded-full bg-surface-light dark:bg-surface-dark shadow-sm border-4 border-white dark:border-gray-800 bg-center bg-cover bg-no-repeat overflow-hidden flex items-center justify-center group-active:scale-95 transition-transform duration-200"
              style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuA_hh3GEQc3DFUfjZu8pd9UBOiBzPwug8xXiigtQQhq0wFTkItCco79fWsxu2QoZMuOO3zZaeIcqhUMqAuk1oGB3GeUaVJ6lxMhipn4PhDa7dxxWrkwR9Aefix_BF3zutneayxdXhwQvaDX1u2lTkE8iOjC1u1c728OvdP6RnhXXa-lM8rHsTaFRj4VKyBQV6iGia2wgnBP2_REtSLmpbXpbr-Jeib8BvIW57RS5d6wcg4UM5IHua7jV7P6tnA7ffSfoRrUhmEHEE0')` }}
            >
              {/* Overlay for upload hint */}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-white text-3xl">edit</span>
              </div>
            </div>
            {/* Camera Icon Badge */}
            <div className="absolute bottom-0 right-1 bg-primary text-white p-2.5 rounded-full shadow-lg border-[3px] border-background-light dark:border-background-dark flex items-center justify-center">
              <span className="material-symbols-outlined text-lg font-bold">photo_camera</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-primary font-semibold text-lg">Subir Escudo</p>
            <p className="text-gray-500 text-sm">Formato .png recomendado</p>
          </div>
        </div>

        {/* Section 1: Basic Details */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold px-1">Detalles Básicos</h2>
          <Card className="space-y-5">
            {/* League Name Input */}
            <label className="block">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 block ml-1">Nombre de la Liga</span>
              <Input icon="emoji_events" placeholder="Ej. Torneo Apertura 2024" type="text" />
            </label>
            {/* Description Input */}
            <label className="block">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 block ml-1">Descripción</span>
              <Textarea placeholder="Reglas breves, premios o detalles del torneo..." />
            </label>
          </Card>
        </div>

        {/* Section 2: Format & Config */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold px-1">Formato de Juego</h2>
          {/* Format Selector Cards */}
          <div className="grid grid-cols-3 gap-3">
            {/* Format cards... */}
          </div>
          {/* Detailed Numeric Configs */}
          <Card className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {/* Teams Count */}
            <div className="flex items-center justify-between py-3">
              {/* ... */}
            </div>
            {/* Match Duration */}
            <div className="flex items-center justify-between py-3 pt-4">
              {/* ... */}
            </div>
          </Card>
        </div>

        {/* Section 3: Switches */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold px-1">Reglas Avanzadas</h2>
          <Card className="divide-y divide-gray-100 dark:divide-gray-800 p-0">
            {/* Switch Items... */}
          </Card>
        </div>

        {/* Padding for bottom button */}
        <div className="h-8"></div>
      </div>

      {/* Floating Bottom Action */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark dark:to-transparent z-40 pb-8">
        <div className="max-w-md mx-auto">
          <Button className="w-full">
            <span>Crear Liga</span>
            <span className="material-symbols-outlined text-2xl">arrow_forward</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateLeagueScreen;
