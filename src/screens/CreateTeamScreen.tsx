import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';

interface Player {
  id: string;
  name: string;
  number: number | string;
  position: string;
  photo_url?: string | null;
}

interface CreateTeamScreenProps {
  initialTeamId?: string;
  initialLeagueId?: string;
}

const CreateTeamScreen: React.FC<CreateTeamScreenProps> = ({ initialTeamId, initialLeagueId }) => {
  // ... (rest of component)
  // Wrapping the replacement in a larger chunk to ensure context, but actually I need to target two specific areas.
  // I will split this into two calls or use multi-replace if the tool allowed, but replace_file_content is for contiguous. 
  // Ah, the instruction says "Use this tool ONLY when you are making a SINGLE CONTIGUOUS block...".
  // The interface is at the top, the function is in the middle. I should use multi_replace_file_content.
  // Wait, I will cancel this tool call and use multi_replace.

  const navigate = useNavigate();
  const location = useLocation();
  const { league_id: locLeagueId, teamId: locTeamId } = location.state || {};
  const league_id = initialLeagueId || locLeagueId;
  const teamId = initialTeamId || locTeamId;

  const isEditing = !!teamId;

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [captainEmail, setCaptainEmail] = useState(''); // Added captain email

  // Shield State
  const [shieldFile, setShieldFile] = useState<File | null>(null);
  const [shieldPreview, setShieldPreview] = useState<string | null>(null);

  // Colors state
  const [primaryColor, setPrimaryColor] = useState('#ef4444');
  const [secondaryColor, setSecondaryColor] = useState('#3b82f6');

  // Players state
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newPlayerPosition, setNewPlayerPosition] = useState('Delantero');
  const [newPlayerPhoto, setNewPlayerPhoto] = useState<File | null>(null);
  const [loadingPlayer, setLoadingPlayer] = useState(false);

  // Edit Player State
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editPhoto, setEditPhoto] = useState<File | null>(null);

  const { showToast } = useToast();

  useEffect(() => {
    if (!league_id && !teamId) {
      showToast('Error: No se ha especificado una liga.', 'error');
      navigate(-1);
      return;
    }

    if (isEditing) {
      const fetchTeamAndPlayers = async () => {
        setLoading(true);
        // Fetch Team
        const { data: teamData } = await supabase
          .from('teams')
          .select('*')
          .eq('id', teamId)
          .single();

        if (teamData) {
          setName(teamData.name);
          setCaptainName(teamData.captain_name || '');
          setCaptainEmail(teamData.captain_email || '');
          setPrimaryColor(teamData.home_kit_color || '#ef4444');
          setSecondaryColor(teamData.away_kit_color || '#3b82f6');
          setShieldPreview(teamData.shield_url);
        }

        // Fetch Players
        const { data: playersData } = await supabase
          .from('players')
          .select('*')
          .eq('team_id', teamId)
          .order('number', { ascending: true });

        if (playersData) {
          setPlayers(playersData);
        }

        setLoading(false);
      };
      fetchTeamAndPlayers();
    }
  }, [league_id, teamId, isEditing, navigate, showToast]);

  const handleSaveTeam = async () => {
    if (!name.trim()) {
      showToast('Por favor ingresa un nombre para el equipo.', 'error');
      return;
    }

    // Basic email validation if provided
    if (captainEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(captainEmail)) {
      showToast('Por favor ingresa un correo electrónico válido para el capitán.', 'error');
      return;
    }

    setLoading(true);
    try {
      // Upload Shield if exists
      let shieldUrl = shieldPreview;
      if (shieldFile) {
        const fileExt = shieldFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('team-shields')
          .upload(filePath, shieldFile);

        if (uploadError) {
          console.error('Error uploading shield:', uploadError);
          showToast('No se pudo subir el escudo.', 'error');
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('team-shields')
            .getPublicUrl(filePath);
          shieldUrl = publicUrlData.publicUrl;
        }
      }

      // Lookup Manager by Email
      let managerId = null;
      if (captainEmail) {
        // Query profiles by email. Note: 'profiles' usually matches 'auth.users' on ID/Email. 
        // We assume 'email' column exists in 'profiles' as per schema line 8.
        const { data: userData } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('email', captainEmail)
          .single();

        if (userData) {
          managerId = userData.id;
          // Automatically upgrade user role to captain if they are a standard user
          if (userData.role === 'user' || !userData.role) {
            await supabase.from('profiles').update({ role: 'captain' }).eq('id', managerId);
          }
        }
      }

      // Map state to database columns
      const teamData = {
        name,
        captain_name: captainName,
        captain_email: captainEmail,
        manager_id: managerId,
        home_kit_color: primaryColor,
        away_kit_color: secondaryColor,
        shield_url: shieldUrl,
      };

      let error;
      let newTeamId = teamId;

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('teams')
          .update(teamData)
          .eq('id', teamId);
        error = updateError;
      } else {
        const { data: insertData, error: insertError } = await supabase
          .from('teams')
          .insert([
            {
              league_id: league_id,
              ...teamData
            }
          ])
          .select()
          .single(); // Select the inserted row to get ID
        error = insertError;
        if (insertData) newTeamId = insertData.id;
      }

      if (error) throw error;

      if (isEditing) {
        showToast('¡Equipo actualizado!', 'success');
        navigate(-1);
      } else {
        // Automatically redirect to adding players (edit mode) after creation
        showToast('¡Equipo registrado! Ahora puedes agregar jugadores.', 'success');
        navigate('/create-team', { state: { league_id, teamId: newTeamId }, replace: true });
      }
    } catch (error: any) {
      console.error('Error saving team:', error);
      showToast(`Error al guardar: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    if (!teamId) return;

    setLoadingPlayer(true);
    try {
      let photoUrl = null;

      if (newPlayerPhoto) {
        const fileExt = newPlayerPhoto.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('player-photos')
          .upload(filePath, newPlayerPhoto);

        if (uploadError) {
          console.error('Error uploading photo:', uploadError);
          showToast('No se pudo subir la foto, se guardará sin ella.', 'error');
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('player-photos')
            .getPublicUrl(filePath);
          photoUrl = publicUrlData.publicUrl;
        }
      }

      const { data, error } = await supabase
        .from('players')
        .insert([{
          team_id: teamId,
          name: newPlayerName,
          number: parseInt(newPlayerNumber) || 0,
          position: newPlayerPosition,
          photo_url: photoUrl
        }])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setPlayers([...players, data]);
        setNewPlayerName('');
        setNewPlayerNumber('');
        setNewPlayerPosition('Delantero');
        setNewPlayerPhoto(null);
        showToast('Jugador agregado', 'success');
      }
    } catch (error: any) {
      showToast('Error al agregar jugador: ' + error.message, 'error');
    } finally {
      setLoadingPlayer(false);
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    try {
      const { error } = await supabase.from('players').delete().eq('id', playerId);
      if (error) throw error;
      setPlayers(players.filter(p => p.id !== playerId));
      showToast('Jugador eliminado', 'success');
    } catch (error: any) {
      showToast('Error: ' + error.message, 'error');
    }
  };

  const openEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setEditName(player.name);
    setEditNumber(player.number.toString());
    setEditPosition(player.position);
    setEditPhoto(null);
  };

  const handleUpdatePlayer = async () => {
    console.log('Attempting to update player:', { editingPlayer, editName, editNumber, editPosition });
    if (!editingPlayer || !editName.trim()) {
      console.warn('Validation failed: missing player or name');
      return;
    }

    setLoadingPlayer(true);
    try {
      let photoUrl = editingPlayer.photo_url;

      if (editPhoto) {
        console.log('Uploading new photo...');
        const fileExt = editPhoto.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('player-photos')
          .upload(filePath, editPhoto);

        if (uploadError) {
          console.error('Error uploading photo:', uploadError);
          showToast('No se pudo subir la foto nueva.', 'error');
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('player-photos')
            .getPublicUrl(filePath);
          photoUrl = publicUrlData.publicUrl;
          console.log('Photo uploaded, new URL:', photoUrl);
        }
      }

      console.log('Updating database record...');
      const { data, error } = await supabase
        .from('players')
        .update({
          name: editName,
          number: parseInt(editNumber) || 0,
          position: editPosition,
          photo_url: photoUrl
        })
        .eq('id', editingPlayer.id)
        .select();

      console.log('Update response:', { data, error });

      if (error) throw error;

      if (data && data.length > 0) {
        const updatedPlayer = data[0];
        setPlayers(players.map(p => p.id === updatedPlayer.id ? updatedPlayer : p));
        setEditingPlayer(null);
        showToast('Jugador actualizado', 'success');
      } else {
        console.warn('Update successful (200 OK) but no data returned. Check RLS policies?');
        // Fallback: Optimistically update UI if no data is returned but no error
        const optimisticPlayer = {
          ...editingPlayer,
          name: editName,
          number: parseInt(editNumber) || 0,
          position: editPosition,
          photo_url: photoUrl
        };
        setPlayers(players.map(p => p.id === editingPlayer.id ? optimisticPlayer : p));
        setEditingPlayer(null);
        showToast('Jugador actualizado (sin confirmación de datos)', 'success');
      }
    } catch (error: any) {
      console.error('Exception in handleUpdatePlayer:', error);
      showToast('Error al actualizar: ' + error.message, 'error');
    } finally {
      setLoadingPlayer(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased">
      <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden">
        {/* Top Navigation Bar */}
        <div className="sticky top-0 z-50 flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between border-b border-gray-200 dark:border-border-dark/30 backdrop-blur-md bg-opacity-90 dark:bg-opacity-90">
          <button
            onClick={() => initialTeamId ? navigate('/') : navigate(-1)}
            className="text-slate-900 dark:text-white flex size-12 shrink-0 items-center justify-start focus:outline-none"
          >
            <span className="material-symbols-outlined text-2xl">arrow_back_ios</span>
          </button>
          <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
            {isEditing ? 'Editar Equipo' : 'Crear Equipo'}
          </h2>
          <div className="flex w-12 items-center justify-end">
            <button
              onClick={handleSaveTeam}
              disabled={loading}
              className="text-primary text-base font-bold leading-normal tracking-[0.015em] shrink-0 focus:outline-none hover:text-primary/80 transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 flex flex-col pb-24">
          {/* Badge Upload Section */}
          <div className="w-full flex flex-col items-center justify-center pt-8 pb-6 bg-gradient-to-b from-background-light to-white dark:from-background-dark dark:to-surface-dark/30">
            <label className="relative group cursor-pointer">
              {/* Placeholder Circle */}
              <div className="w-32 h-32 rounded-full bg-white dark:bg-surface-dark border-2 border-dashed border-gray-300 dark:border-border-dark flex items-center justify-center overflow-hidden shadow-lg transition-all group-hover:border-primary">
                {shieldPreview || shieldFile ? (
                  <img src={shieldFile ? URL.createObjectURL(shieldFile) : shieldPreview!} alt="Escudo" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-text-secondary text-4xl group-hover:text-primary transition-colors">add_a_photo</span>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setShieldFile(e.target.files[0]);
                  }
                }}
              />
              {/* Edit Badge Button */}
              <div className="absolute bottom-0 right-0 bg-primary rounded-full p-2 border-4 border-background-light dark:border-background-dark shadow-sm">
                <span className="material-symbols-outlined text-white text-sm font-bold">edit</span>
              </div>
            </label>
            <p className="text-text-secondary text-sm mt-4 font-medium">Subir Escudo</p>
          </div>
          <div className="h-px w-full bg-gray-200 dark:bg-border-dark/50 my-2"></div>

          {/* Form Section: Basic Info */}
          <div className="flex flex-col gap-4 px-4 py-4">
            <h3 className="text-slate-900 dark:text-white tracking-tight text-xl font-bold leading-tight pt-2">Información General</h3>
            {/* Team Name Input */}
            <label className="flex flex-col flex-1 group">
              <p className="text-slate-700 dark:text-white text-base font-medium leading-normal pb-2 transition-colors group-focus-within:text-primary">Nombre del Equipo</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-slate-900 dark:text-white focus:outline-0 focus:ring-0 border border-gray-300 dark:border-border-dark bg-white dark:bg-surface-dark focus:border-primary dark:focus:border-primary h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal shadow-sm transition-all"
                placeholder="Ej. Leones FC"
                type="text"
              />
            </label>
            {/* Captain Name Input */}
            <label className="flex flex-col flex-1 group mt-2">
              <p className="text-slate-700 dark:text-white text-base font-medium leading-normal pb-2 transition-colors group-focus-within:text-primary">Nombre del Capitán</p>
              <input
                value={captainName}
                onChange={(e) => setCaptainName(e.target.value)}
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-slate-900 dark:text-white focus:outline-0 focus:ring-0 border border-gray-300 dark:border-border-dark bg-white dark:bg-surface-dark focus:border-primary dark:focus:border-primary h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal shadow-sm transition-all"
                placeholder="Ej. Juan Pérez"
                type="text"
              />
            </label>
            {/* Captain Email Input */}
            <label className="flex flex-col flex-1 group mt-2">
              <p className="text-slate-700 dark:text-white text-base font-medium leading-normal pb-2 transition-colors group-focus-within:text-primary">Email del Capitán</p>
              <input
                value={captainEmail}
                onChange={(e) => setCaptainEmail(e.target.value)}
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-slate-900 dark:text-white focus:outline-0 focus:ring-0 border border-gray-300 dark:border-border-dark bg-white dark:bg-surface-dark focus:border-primary dark:focus:border-primary h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal shadow-sm transition-all"
                placeholder="capitan@email.com"
                type="email"
              />
              <p className="text-xs text-text-secondary mt-1 ml-1">Para enviar el código de invitación a la liga.</p>
            </label>
          </div>

          {/* Style Section: Colors */}
          <div className="flex flex-col gap-4 px-4 py-4 mt-2">
            <h3 className="text-slate-900 dark:text-white tracking-tight text-xl font-bold leading-tight">Colores del Uniforme</h3>
            <div className="flex gap-4">
              {/* Home Kit Color */}
              <div className="flex-1 bg-white dark:bg-surface-dark rounded-xl p-4 border border-gray-300 dark:border-border-dark flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 transition-all shadow-sm active:scale-95">
                <div className="relative">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                  />
                  <div className="w-12 h-12 rounded-full border-2 border-gray-100 dark:border-white/10 shadow-inner" style={{ backgroundColor: primaryColor }}></div>
                  <div className="absolute -bottom-1 -right-1 bg-white dark:bg-surface-dark rounded-full p-0.5 border border-gray-200 dark:border-border-dark pointer-events-none">
                    <span className="material-symbols-outlined text-xs text-text-secondary block">colorize</span>
                  </div>
                </div>
                <span className="text-slate-600 dark:text-text-secondary text-sm font-medium">Principal</span>
              </div>
              {/* Away Kit Color */}
              <div className="flex-1 bg-white dark:bg-surface-dark rounded-xl p-4 border border-gray-300 dark:border-border-dark flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 transition-all shadow-sm active:scale-95">
                <div className="relative">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                  />
                  <div className="w-12 h-12 rounded-full border-2 border-gray-100 dark:border-white/10 shadow-inner" style={{ backgroundColor: secondaryColor }}></div>
                  <div className="absolute -bottom-1 -right-1 bg-white dark:bg-surface-dark rounded-full p-0.5 border border-gray-200 dark:border-border-dark pointer-events-none">
                    <span className="material-symbols-outlined text-xs text-text-secondary block">colorize</span>
                  </div>
                </div>
                <span className="text-slate-600 dark:text-text-secondary text-sm font-medium">Secundario</span>
              </div>
            </div>
          </div>

          {/* Players Roster Section (Only in Edit Mode) */}
          {isEditing && (
            <div className="flex flex-col gap-4 px-4 py-4 mt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-slate-900 dark:text-white tracking-tight text-xl font-bold leading-tight">Plantilla de Jugadores</h3>
                <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500">{players.length} Jugadores</span>
              </div>

              {/* List of Players */}
              <div className="flex flex-col gap-2">
                {players.map((player) => (
                  <div key={player.id} className="flex items-center justify-between bg-white dark:bg-surface-dark p-3 rounded-xl border border-gray-200 dark:border-border-dark">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-xs overflow-hidden">
                        {(player as any).photo_url ? (
                          <img src={(player as any).photo_url} alt={player.name} className="w-full h-full object-cover" />
                        ) : (
                          player.number
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{player.name}</span>
                        <span className="text-xs text-text-secondary">{player.position}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditPlayer(player)} className="text-primary p-2 hover:bg-primary/10 rounded-full transition-colors">
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                      <button onClick={() => handleDeletePlayer(player.id)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors">
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
                {players.length === 0 && (
                  <div className="text-center py-4 text-text-secondary text-sm italic border border-dashed border-gray-300 dark:border-border-dark rounded-xl">
                    No hay jugadores registrados aún.
                  </div>
                )}
              </div>

              {/* Add Player Form */}
              <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-border-dark/50">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Agregar Jugador</p>
                  {/* Photo Upload Thumbnail in Quick Add */}
                  <label className="cursor-pointer group relative">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-surface-dark border border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden hover:border-primary transition-colors">
                      {newPlayerPhoto ? (
                        <img src={URL.createObjectURL(newPlayerPhoto)} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-slate-400 text-xl group-hover:text-primary">add_a_photo</span>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files && setNewPlayerPhoto(e.target.files[0])}
                    />
                    {newPlayerPhoto && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-50 dark:border-slate-800"></div>
                    )}
                  </label>
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    className="flex-[2] form-input h-10 rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-surface-dark px-3 text-sm"
                    placeholder="Nombre"
                    value={newPlayerName}
                    onChange={e => setNewPlayerName(e.target.value)}
                  />
                  <input
                    className="flex-1 form-input h-10 rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-surface-dark px-3 text-sm"
                    placeholder="#"
                    type="number"
                    value={newPlayerNumber}
                    onChange={e => setNewPlayerNumber(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    className="flex-[2] form-select h-10 rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-surface-dark px-3 text-sm text-slate-900 dark:text-white"
                    value={newPlayerPosition}
                    onChange={e => setNewPlayerPosition(e.target.value)}
                  >
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Portero</option>
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Defensa</option>
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Medio</option>
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Delantero</option>
                  </select>
                  <button
                    onClick={handleAddPlayer}
                    disabled={loadingPlayer}
                    className="flex-1 bg-black dark:bg-white text-white dark:text-black font-bold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {loadingPlayer ? '...' : 'Agregar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Live Preview Card */}
          <div className="flex flex-col gap-4 px-4 py-4 mt-2">
            <h3 className="text-slate-900 dark:text-white tracking-tight text-xl font-bold leading-tight">Vista Previa</h3>
            <div className="bg-white dark:bg-surface-dark rounded-xl p-4 flex items-center justify-between border border-gray-200 dark:border-border-dark shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 bg-cover bg-center flex items-center justify-center overflow-hidden" data-alt="Preview of team shield">
                  {shieldPreview || shieldFile ? (
                    <img src={shieldFile ? URL.createObjectURL(shieldFile) : shieldPreview!} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 text-2xl">shield</span>
                  )}
                </div>
                <div>
                  <p className="text-slate-900 dark:text-white font-bold text-lg leading-none mb-1">{name || 'Nombre Equipo'}</p>
                  <p className="text-text-secondary text-sm leading-none">{captainName ? `C: ${captainName}` : 'Sin Capitán'}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <div className="w-3 h-8 rounded-sm shadow-sm" style={{ backgroundColor: primaryColor }} title="Local"></div>
                <div className="w-3 h-8 rounded-sm shadow-sm" style={{ backgroundColor: secondaryColor }} title="Visitante"></div>
              </div>
            </div>
            <p className="text-xs text-text-secondary px-1 text-center mt-2">Así aparecerá el equipo en la tabla de posiciones y calendario.</p>
          </div>
        </div>

        {/* Edit Player Modal */}
        {editingPlayer && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-card-dark w-full max-w-sm rounded-2xl shadow-xl p-4 flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-2">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Editar Jugador</h3>
                <button onClick={() => setEditingPlayer(null)} className="text-slate-500 hover:text-slate-700 dark:hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex justify-center py-2">
                <label className="cursor-pointer group relative">
                  <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 flex items-center justify-center overflow-hidden hover:border-primary transition-colors">
                    {editPhoto ? (
                      <img src={URL.createObjectURL(editPhoto)} className="w-full h-full object-cover" />
                    ) : (editingPlayer as any).photo_url ? (
                      <img src={(editingPlayer as any).photo_url} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-slate-400 text-3xl group-hover:text-primary">add_a_photo</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files && setEditPhoto(e.target.files[0])}
                  />
                  <div className="absolute bottom-0 right-0 bg-primary p-1 rounded-full border border-white">
                    <span className="material-symbols-outlined text-white text-[10px] block">edit</span>
                  </div>
                </label>
              </div>

              <div className="flex flex-col gap-3">
                <input
                  className="form-input h-10 rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-surface-dark px-3 text-sm"
                  placeholder="Nombre"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
                <div className="flex gap-2">
                  <input
                    className="flex-1 form-input h-10 rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-surface-dark px-3 text-sm"
                    placeholder="#"
                    type="number"
                    value={editNumber}
                    onChange={e => setEditNumber(e.target.value)}
                  />
                  <select
                    className="flex-[2] form-select h-10 rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-surface-dark px-3 text-sm text-slate-900 dark:text-white"
                    value={editPosition}
                    onChange={e => setEditPosition(e.target.value)}
                  >
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Portero</option>
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Defensa</option>
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Medio</option>
                    <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Delantero</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setEditingPlayer(null)}
                  className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdatePlayer}
                  disabled={loadingPlayer}
                  className="flex-1 bg-primary text-white py-2 rounded-lg font-bold text-sm disabled:opacity-50"
                >
                  {loadingPlayer ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Footer Action */}
        <div className="fixed bottom-[88px] left-0 w-full p-4 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl border-t border-gray-200 dark:border-border-dark/50 z-40">
          <button
            onClick={handleSaveTeam}
            disabled={loading}
            className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-xl text-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined">{isEditing ? 'save' : 'add_circle'}</span>
            {isEditing ? 'Guardar Cambios' : 'Registrar Equipo'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTeamScreen;
