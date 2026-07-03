import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';

const LeagueInviteScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  
  const [user, setUser] = useState<any>(null);
  const [inviteCode, setInviteCode] = useState(searchParams.get('code') || '');
  const [loading, setLoading] = useState(false);
  const [league, setLeague] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [checking, setChecking] = useState(false);

  // Invitations state
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);

  useEffect(() => {
    checkUser();
    if (inviteCode) {
      findLeagueByCode(inviteCode);
    }
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) {
      fetchInvitations();
    }
  };

  const fetchInvitations = async () => {
    if (!user) return;
    
    setLoadingInvitations(true);
    try {
      // Get user email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      if (profile) {
        // Fetch pending invitations for this user
        const { data } = await supabase
          .from('league_invitations')
          .select(`
            *,
            league:leagues(id, name, logo_url, format)
          `)
          .eq('email', profile.email)
          .eq('status', 'pending');

        if (data) {
          setInvitations(data);
        }
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setLoadingInvitations(false);
    }
  };

  const findLeagueByCode = async (code: string) => {
    if (!code.trim()) return;

    setChecking(true);
    try {
      const normalizedCode = code.toLowerCase().trim();

      // Usamos maybeSingle en vez de single para evitar PGRST116
      // cuando el código no existe o la RLS lo bloquea.
      const { data, error } = await supabase
        .from('leagues')
        .select('id, name, logo_url, format, description, invite_code')
        .eq('invite_code', normalizedCode)
        .maybeSingle();

      if (error) {
        console.error('Error finding league:', error);
        setLeague(null);
        return;
      }

      if (!data) {
        // Diagnóstico: ver qué códigos existen realmente
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          const { data: allCodes } = await supabase
            .from('leagues')
            .select('id, name, invite_code')
            .not('invite_code', 'is', null)
            .limit(20);
          console.log('[DIAGNÓSTICO] Códigos visibles para tu usuario:', allCodes);
          console.log('[DIAGNÓSTICO] Buscaste:', normalizedCode);
        } else {
          console.log('[DIAGNÓSTICO] No hay sesión activa. La RLS puede estar bloqueando.');
        }
        setLeague(null);
        return;
      }

      setLeague(data);
      
      // Check if already following
      if (user) {
        const { data: follow } = await supabase
          .from('league_followers')
          .select('id')
          .eq('user_id', user.id)
          .eq('league_id', data.id)
          .single();
        
        setIsFollowing(!!follow);
      }
    } catch (error) {
      console.error('Error finding league:', error);
      setLeague(null);
    } finally {
      setChecking(false);
    }
  };

  const handleSearch = () => {
    findLeagueByCode(inviteCode);
  };

  const handleJoinLeague = async () => {
    if (!league) return;

    // Si el usuario no está logueado, simplemente lo llevamos a ver la liga.
    if (!user) {
      navigate(`/league/${league.id}`);
      return;
    }

    setLoading(true);
    try {
      // Follow the league
      const { error } = await supabase
        .from('league_followers')
        .insert([{ user_id: user.id, league_id: league.id }]);

      if (error) {
        if (error.code === '23505') {
          showToast('Ya estás siguiendo esta liga', 'info');
        } else {
          throw error;
        }
      } else {
        showToast(`¡Te uniste a ${league.name}!`, 'success');
        setIsFollowing(true);
        navigate(`/league/${league.id}`);
      }
    } catch (error: any) {
      console.error('Error joining league:', error);
      showToast('Error al unirse', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async (invitation: any) => {
    if (!user) return;

    setLoading(true);
    try {
      // Accept invitation
      await supabase
        .from('league_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);

      // Follow the league
      await supabase
        .from('league_followers')
        .insert([{ user_id: user.id, league_id: invitation.league_id }]);

      showToast(`¡Te uniste a ${invitation.league?.name}!`, 'success');
      fetchInvitations();
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      showToast('Error al aceptar invitación', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      await supabase
        .from('league_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      showToast('Invitación rechazada', 'info');
      fetchInvitations();
    } catch (error) {
      console.error('Error declining invitation:', error);
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
        <h1 className="text-lg font-bold tracking-tight">Unirse a Liga</h1>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 w-full max-w-md mx-auto flex flex-col px-4 pt-6 gap-6">
        
        {/* Invitaciones Pendientes */}
        {user && invitations.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Invitaciones Pendientes</h2>
            <div className="space-y-3">
              {invitations.map((inv) => (
                <div 
                  key={inv.id}
                  className="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                      {inv.league?.logo_url ? (
                        <img src={inv.league.logo_url} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-2xl text-slate-400">sports_soccer</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold">{inv.league?.name}</h3>
                      <p className="text-xs text-slate-500">Te invitaron a unirte</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptInvitation(inv)}
                      disabled={loading}
                      className="flex-1 bg-primary text-white font-bold py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
                    >
                      Aceptar
                    </button>
                    <button
                      onClick={() => handleDeclineInvitation(inv.id)}
                      className="px-4 py-2.5 text-slate-500 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buscar por código */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Buscar por Código</h2>
          <p className="text-sm text-slate-500">
            Ingresa el código de invitación que te proporcionaron para unirte a una liga.
          </p>
          
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toLowerCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Código de invitación"
                className="w-full bg-surface-light dark:bg-surface-dark text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 h-12 px-4 pr-12 placeholder:text-slate-400"
              />
              {checking && (
                <div className="absolute right-4 top-3.5">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
                </div>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={!inviteCode.trim() || checking}
              className="h-12 px-6 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Buscar
            </button>
          </div>
        </div>

        {/* Resultado de búsqueda */}
        {league && (
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                {league.logo_url ? (
                  <img src={league.logo_url} className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-3xl text-slate-400">emoji_events</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">{league.name}</h3>
                <p className="text-sm text-slate-500">Fútbol {league.format}</p>
                {league.description && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{league.description}</p>
                )}
              </div>
            </div>

            {isFollowing ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 py-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold">
                  <span className="material-symbols-outlined">check_circle</span>
                  Ya estás siguiendo esta liga
                </div>
                <button
                  onClick={() => navigate(`/league/${league.id}`)}
                  className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">visibility</span>
                  Ver Liga
                </button>
              </div>
            ) : (
              <button
                onClick={handleJoinLeague}
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                ) : (
                  <>
                    {user ? (
                      <>
                        <span className="material-symbols-outlined">add</span>
                        Unirme a la Liga
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">visibility</span>
                        Ver Liga
                      </>
                    )}
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Código inválido */}
        {inviteCode && !league && !checking && (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">search_off</span>
            <p className="text-slate-500">No se encontró ninguna liga con ese código.</p>
            <p className="text-sm text-slate-400 mt-1">Verifica el código e intenta de nuevo.</p>
          </div>
        )}

        {/* Info para no logueados */}
        {!user && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-500">info</span>
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Puedes ver la liga sin cuenta
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Inicia sesión solo si quieres seguirla y recibir actualizaciones.
                </p>
                <button
                  onClick={() => navigate('/admin-login')}
                  className="mt-3 text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Iniciar Sesión
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeagueInviteScreen;
