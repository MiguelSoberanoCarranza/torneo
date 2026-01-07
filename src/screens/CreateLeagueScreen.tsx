import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';

const CreateLeagueScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const leagueId = location.state?.league_id;
  const isEditing = !!leagueId;

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState('5');
  const [maxTeams, setMaxTeams] = useState(12);
  const [maxPlayers, setMaxPlayers] = useState(20); // New Field
  const [matchDuration, setMatchDuration] = useState(45);
  const [twoLegged, setTwoLegged] = useState(false);
  const [allowDraws, setAllowDraws] = useState(true);

  // Logo State
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);


  const { showToast } = useToast();

  useEffect(() => {
    if (isEditing) {
      const fetchLeague = async () => {
        setLoading(true);
        const { data } = await supabase
          .from('leagues')
          .select('*')
          .eq('id', leagueId)
          .single();

        if (data) {
          setName(data.name);
          setDescription(data.description || '');
          setFormat(data.format);
          setMaxTeams(data.max_teams);
          setMatchDuration(data.match_duration);
          setMaxPlayers(data.max_players_per_team || 20); // Load max_players
          setLogoPreview(data.logo_url);


          if (data.settings) {
            setTwoLegged(data.settings.two_legged || false);
            setAllowDraws(data.settings.allow_draws ?? true);
          }
        }
        setLoading(false);
      };
      fetchLeague();
    }
  }, [isEditing, leagueId]);

  const handleSaveLeague = async () => {
    if (!name.trim()) {
      showToast('Por favor ingresa un nombre para la liga.', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        showToast('Debes iniciar sesión.', 'error');
        navigate('/admin-login');
        return;
      }



      // Upload Logo if exists
      let logoUrl = logoPreview;
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('league-logos')
          .upload(filePath, logoFile);

        if (uploadError) {
          console.error('Error uploading logo:', uploadError);
          showToast('No se pudo subir el logo.', 'error');
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('league-logos')
            .getPublicUrl(filePath);
          logoUrl = publicUrlData.publicUrl;
        }
      }

      const leagueData = {
        name,
        description,
        format,
        max_teams: maxTeams,
        max_players_per_team: maxPlayers,
        match_duration: matchDuration,
        logo_url: logoUrl,
        settings: {
          two_legged: twoLegged,
          allow_draws: allowDraws
        }
      };

      let error;

      if (isEditing) {
        // UPDATE
        const { error: updateError } = await supabase
          .from('leagues')
          .update(leagueData)
          .eq('id', leagueId);
        error = updateError;
      } else {
        // INSERT
        const { error: insertError } = await supabase
          .from('leagues')
          .insert([
            {
              owner_id: user.id,
              status: 'upcoming',
              ...leagueData
            }
          ]);
        error = insertError;
      }

      if (error) throw error;

      showToast(isEditing ? '¡Liga actualizada!' : '¡Liga creada exitosamente!', 'success');
      navigate(isEditing ? `/league/${leagueId}` : '/'); // Go back to details or dashboard
    } catch (error: any) {
      console.error('Error saving league:', error);
      showToast(`Error al guardar: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display min-h-screen flex flex-col antialiased pb-24 selection:bg-primary selection:text-white">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-10 h-10 rounded-full active:bg-gray-200 dark:active:bg-gray-800 transition-colors text-slate-900 dark:text-white"
        >
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight">{isEditing ? 'Editar Liga' : 'Crear Liga'}</h1>
        <div className="w-10"></div>
      </div>

      {/* Main Content Scroll */}
      <div className="flex-1 w-full max-w-md mx-auto flex flex-col px-4 pt-4 gap-6">
        {/* Shield/Logo Uploader */}
        <div className="flex flex-col items-center gap-3 py-2">
          <label className="relative group cursor-pointer">
            {/* Avatar Circle */}
            <div
              className="w-32 h-32 rounded-full bg-surface-light dark:bg-surface-dark shadow-sm border-4 border-white dark:border-gray-800 bg-center bg-cover bg-no-repeat overflow-hidden flex items-center justify-center group-active:scale-95 transition-transform duration-200"
              style={{ backgroundImage: logoPreview && !logoFile ? `url('${logoPreview}')` : undefined }}
            >
              {logoFile ? (
                <img src={URL.createObjectURL(logoFile)} className="w-full h-full object-cover" />
              ) : !logoPreview && (
                <span className="material-symbols-outlined text-4xl text-gray-300">image</span>
              )}

              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-white text-3xl">edit</span>
              </div>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setLogoFile(e.target.files[0]);
                }
              }}
            />
            <div className="absolute bottom-0 right-1 bg-primary text-white p-2.5 rounded-full shadow-lg border-[3px] border-background-light dark:border-background-dark flex items-center justify-center">
              <span className="material-symbols-outlined text-lg font-bold">photo_camera</span>
            </div>
          </label>
          <div className="text-center">
            <p className="text-primary font-semibold text-lg">Subir Escudo</p>
            <p className="text-gray-500 text-sm">Formato .png recomendado</p>
          </div>
        </div>

        {/* Section 1: Basic Details */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold px-1">Detalles Básicos</h2>
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 space-y-5">
            {/* League Name Input */}
            <label className="block">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 block ml-1">Nombre de la Liga</span>
              <div className="relative">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-white rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-primary h-12 pl-4 pr-10 placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-shadow"
                  placeholder="Ej. Torneo Apertura 2024"
                  type="text"
                />
                <span className="material-symbols-outlined absolute right-3 top-3 text-gray-400">emoji_events</span>
              </div>
            </label>
            {/* Description Input */}
            <label className="block">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 block ml-1">Descripción</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-white rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-primary min-h-[100px] p-4 placeholder:text-gray-400 dark:placeholder:text-gray-600 resize-none transition-shadow"
                placeholder="Reglas breves, premios o detalles del torneo..."
              ></textarea>
            </label>
          </div>
        </div>

        {/* Section 2: Format & Config */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold px-1">Formato de Juego</h2>
          {/* Format Selector Cards */}
          <div className="grid grid-cols-3 gap-3">
            {['5', '7', '11'].map((fmt) => (
              <label key={fmt} className="cursor-pointer group">
                <input
                  className="peer sr-only"
                  name="format"
                  type="radio"
                  value={fmt}
                  checked={format === fmt}
                  onChange={(e) => setFormat(e.target.value)}
                />
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary transition-all h-24 shadow-sm">
                  <span className="material-symbols-outlined text-3xl mb-1">
                    {fmt === '11' ? 'stadium' : (fmt === '7' ? 'groups' : 'sports_soccer')}
                  </span>
                  <span className="font-bold text-sm">Fut {fmt}</span>
                </div>
              </label>
            ))}
          </div>

          {/* Detailed Numeric Configs */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {/* Teams Count */}
            <div className="flex items-center justify-between py-3">
              <div className="flex flex-col">
                <span className="font-medium text-slate-900 dark:text-white">Equipos</span>
                <span className="text-xs text-gray-500">Máximo participantes</span>
              </div>
              <div className="flex items-center gap-3 bg-background-light dark:bg-background-dark p-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setMaxTeams(Math.max(2, maxTeams - 1))}
                  className="w-8 h-8 rounded-lg bg-surface-light dark:bg-surface-dark flex items-center justify-center text-primary hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm font-bold">remove</span>
                </button>
                <span className="font-bold w-4 text-center">{maxTeams}</span>
                <button
                  onClick={() => setMaxTeams(maxTeams + 1)}
                  className="w-8 h-8 rounded-lg bg-surface-light dark:bg-surface-dark flex items-center justify-center text-primary hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm font-bold">add</span>
                </button>
              </div>
            </div>

            {/* Max Players Per Team - NEW FIELD */}
            <div className="flex items-center justify-between py-3">
              <div className="flex flex-col">
                <span className="font-medium text-slate-900 dark:text-white">Jugadores</span>
                <span className="text-xs text-gray-500">Máximo por equipo</span>
              </div>
              <div className="flex items-center gap-3 bg-background-light dark:bg-background-dark p-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setMaxPlayers(Math.max(5, maxPlayers - 1))}
                  className="w-8 h-8 rounded-lg bg-surface-light dark:bg-surface-dark flex items-center justify-center text-primary hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm font-bold">remove</span>
                </button>
                <span className="font-bold w-4 text-center">{maxPlayers}</span>
                <button
                  onClick={() => setMaxPlayers(maxPlayers + 1)}
                  className="w-8 h-8 rounded-lg bg-surface-light dark:bg-surface-dark flex items-center justify-center text-primary hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm font-bold">add</span>
                </button>
              </div>
            </div>

            {/* Match Duration */}
            <div className="flex items-center justify-between py-3 pt-4">
              <div className="flex flex-col">
                <span className="font-medium text-slate-900 dark:text-white">Duración</span>
                <span className="text-xs text-gray-500">Minutos por tiempo</span>
              </div>
              <div className="relative w-28">
                <input
                  value={matchDuration}
                  onChange={(e) => setMatchDuration(parseInt(e.target.value) || 0)}
                  className="w-full bg-background-light dark:bg-background-dark text-right rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-primary h-10 pr-10 font-bold"
                  type="number"
                />
                <span className="absolute right-3 top-2.5 text-xs text-gray-500 font-medium">min</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Switches */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold px-1">Reglas Avanzadas</h2>
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
            {/* Switch Item 1 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <span className="material-symbols-outlined">repeat</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-white">Ida y Vuelta</span>
                  <span className="text-xs text-gray-500">Dos partidos por enfrentamiento</span>
                </div>
              </div>
              <div className="relative inline-block w-12 h-7 align-middle select-none transition duration-200 ease-in">
                <input
                  checked={twoLegged}
                  onChange={(e) => setTwoLegged(e.target.checked)}
                  className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-300 ease-in-out top-1 left-1 border-gray-300 checked:translate-x-full checked:border-primary"
                  id="toggle1"
                  name="toggle"
                  type="checkbox"
                />
                <label className="toggle-label block overflow-hidden h-7 rounded-full bg-gray-200 dark:bg-gray-700 cursor-pointer transition-colors duration-300 checked:bg-primary" htmlFor="toggle1"></label>
              </div>
            </div>
            {/* Switch Item 2 */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                  <span className="material-symbols-outlined">handshake</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-white">Permitir Empates</span>
                  <span className="text-xs text-gray-500">Sin penales al final del tiempo regular</span>
                </div>
              </div>
              <div className="relative inline-block w-12 h-7 align-middle select-none transition duration-200 ease-in">
                <input
                  checked={allowDraws}
                  onChange={(e) => setAllowDraws(e.target.checked)}
                  className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-300 ease-in-out top-1 left-1 border-gray-300 checked:translate-x-full checked:border-primary"
                  id="toggle2"
                  name="toggle"
                  type="checkbox"
                />
                <label className="toggle-label block overflow-hidden h-7 rounded-full bg-gray-200 dark:bg-gray-700 cursor-pointer transition-colors duration-300 checked:bg-primary" htmlFor="toggle2"></label>
              </div>
            </div>
          </div>
        </div>

        {/* Padding for bottom button */}
        <div className="h-8"></div>
      </div>

      {/* Floating Bottom Action */}
      <div className="fixed bottom-[88px] left-0 w-full p-4 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark dark:to-transparent z-40 pb-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSaveLeague}
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 active:scale-[0.98] text-white font-bold text-lg h-14 rounded-2xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span>{isEditing ? 'Guardando...' : 'Creando...'}</span>
            ) : (
              <>
                <span>{isEditing ? 'Guardar Cambios' : 'Crear Liga'}</span>
                <span className="material-symbols-outlined text-2xl">{isEditing ? 'save' : 'arrow_forward'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateLeagueScreen;
