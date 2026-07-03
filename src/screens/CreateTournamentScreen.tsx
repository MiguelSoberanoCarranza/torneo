import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';

const CreateTournamentScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  
  const tournamentId = location.state?.tournament_id;
  const isEditing = !!tournamentId;

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'active' | 'finished'>('draft');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (isEditing) {
      fetchTournament();
    }
  }, [isEditing, tournamentId]);

  const fetchTournament = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (data) {
        setName(data.name);
        setDescription(data.description || '');
        setStatus(data.status || 'draft');
        setStartDate(data.start_date || '');
        setEndDate(data.end_date || '');
        setLogoPreview(data.logo_url);
      }
    } catch (error) {
      console.error('Error fetching tournament:', error);
      showToast('Error al cargar torneo', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Ingresa un nombre para el torneo.', 'error');
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

      // Upload logo if new file
      let logoUrl = logoPreview;
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `tournaments/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('league-logos')
          .upload(filePath, logoFile);

        if (uploadError) {
          console.error('Logo upload error:', uploadError);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('league-logos')
            .getPublicUrl(filePath);
          logoUrl = publicUrlData.publicUrl;
        }
      }

      const tournamentData = {
        name,
        description: description || null,
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        logo_url: logoUrl
      };

      let error;
      if (isEditing) {
        const { error: updateError } = await supabase
          .from('tournaments')
          .update(tournamentData)
          .eq('id', tournamentId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('tournaments')
          .insert([{ ...tournamentData, owner_id: user.id }]);
        error = insertError;
      }

      if (error) throw error;

      showToast(isEditing ? '¡Torneo actualizado!' : '¡Torneo creado!', 'success');
      navigate(isEditing ? `/tournament/${tournamentId}` : '/tournaments');
    } catch (error: any) {
      console.error('Error saving tournament:', error);
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display min-h-screen flex flex-col antialiased pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-10 h-10 rounded-full active:bg-gray-200 dark:active:bg-gray-800 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight">{isEditing ? 'Editar Torneo' : 'Nuevo Torneo'}</h1>
        <div className="w-10"></div>
      </div>

      {/* Content */}
      <div className="flex-1 w-full max-w-md mx-auto flex flex-col px-4 pt-4 gap-6">
        
        {/* Logo Uploader */}
        <div className="flex flex-col items-center gap-3 py-4">
          <label className="relative group cursor-pointer">
            <div
              className="w-32 h-32 rounded-full bg-surface-light dark:bg-surface-dark shadow-sm border-4 border-white dark:border-gray-800 bg-center bg-cover bg-no-repeat overflow-hidden flex items-center justify-center group-active:scale-95 transition-transform duration-200"
              style={{ backgroundImage: logoPreview && !logoFile ? `url('${logoPreview}')` : undefined }}
            >
              {logoFile ? (
                <img src={URL.createObjectURL(logoFile)} className="w-full h-full object-cover" alt="Preview" />
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
            <div className="absolute bottom-0 right-1 bg-primary text-white p-2.5 rounded-full shadow-lg border-[3px] border-background-light dark:border-background-dark">
              <span className="material-symbols-outlined text-lg font-bold">photo_camera</span>
            </div>
          </label>
          <p className="text-primary font-semibold text-sm">Logo del Torneo</p>
        </div>

        {/* Basic Info */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold px-1">Información</h2>
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
            
            {/* Name */}
            <label className="block">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 block ml-1">Nombre del Torneo</span>
              <div className="relative">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-white rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-primary h-12 pl-4 pr-10 placeholder:text-gray-400"
                  placeholder="Ej. Apertura 2024"
                  type="text"
                />
                <span className="material-symbols-outlined absolute right-3 top-3 text-gray-400">emoji_events</span>
              </div>
            </label>

            {/* Description */}
            <label className="block">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 block ml-1">Descripción</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-white rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-primary min-h-[80px] p-4 placeholder:text-gray-400 resize-none"
                placeholder="Detalles del torneo, premios, reglas..."
              />
            </label>
          </div>
        </div>

        {/* Status */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold px-1">Estado</h2>
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex gap-2">
              {(['draft', 'active', 'finished'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-bold transition-all ${
                    status === s
                      ? s === 'draft' ? 'bg-gray-500 text-white' :
                        s === 'active' ? 'bg-emerald-500 text-white' :
                        'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}
                >
                  {s === 'draft' ? 'Borrador' : s === 'active' ? 'Activo' : 'Finalizado'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold px-1">Fechas</h2>
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 block ml-1">Inicio</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-white rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-primary h-12 px-4"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 block ml-1">Fin</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-white rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-primary h-12 px-4"
              />
            </label>
          </div>
        </div>

        <div className="h-8"></div>
      </div>

      {/* Bottom Action */}
      <div className="fixed bottom-[88px] left-0 w-full p-4 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark dark:to-transparent z-40 pb-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 active:scale-[0.98] text-white font-bold text-lg h-14 rounded-2xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>{isEditing ? 'Guardando...' : 'Creando...'}</span>
            ) : (
              <>
                <span>{isEditing ? 'Guardar Cambios' : 'Crear Torneo'}</span>
                <span className="material-symbols-outlined text-2xl">{isEditing ? 'save' : 'arrow_forward'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTournamentScreen;
