import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

interface League {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  slug: string;
  status: string;
  tournament_id: string | null;
  owner_id: string;
  is_public: boolean;
}

type AccessType = 'owner' | 'follower' | 'team_member' | 'public';

const LeagueSelectorScreen: React.FC = () => {
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Verificar sesión
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/admin-login', { replace: true });
        return;
      }
      setUser(user);

      // 2. Obtener perfil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single();
      setProfile(profileData);

      // 3. Traer TODAS las ligas que el usuario puede ver
      // (la RLS ya filtra: solo owner, follower, team_member, o públicas)
      // Traemos primero las ligas sin joins para evitar problemas de RLS en joins
      const { data: leaguesData, error } = await supabase
        .from('leagues')
        .select('id, name, logo_url, description, slug, status, tournament_id, owner_id, is_public')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLeagues((leaguesData || []) as any);
    } catch (err) {
      console.error('Error fetching leagues:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAccessType = (league: League): AccessType => {
    if (league.owner_id === user?.id) return 'owner';
    return 'public'; // Si la RLS la mostró y no es owner, debe ser por follow/team/public
  };

  const handleLeagueClick = (league: League) => {
    // Si es owner, va a la pantalla de gestión
    if (league.owner_id === user?.id) {
      navigate(`/league/${league.id}`);
    } else {
      // Si no, va a la vista pública
      navigate(`/l/${league.slug}`);
    }
  };

  const filteredLeagues = leagues.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  const myLeagues = filteredLeagues.filter(l => l.owner_id === user?.id);
  const followedLeagues = filteredLeagues.filter(l => l.owner_id !== user?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark pb-24">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-primary via-purple-600 to-pink-600 text-white overflow-hidden">
        <div className="absolute -top-20 -right-20 size-60 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -left-12 size-40 bg-purple-300/20 rounded-full blur-2xl" />
        <div className="relative max-w-2xl mx-auto px-4 py-8">
          <p className="text-sm opacity-80 mb-1">Hola, {profile?.full_name || user?.email?.split('@')[0] || 'Usuario'} 👋</p>
          <h1 className="text-3xl font-black mb-2">Mis Ligas</h1>
          <p className="text-sm opacity-80">
            {myLeagues.length === 0 && followedLeagues.length === 0
              ? 'Aún no tenés ligas. Crea una para empezar.'
              : `Administras ${myLeagues.length} liga${myLeagues.length === 1 ? '' : 's'}${followedLeagues.length > 0 ? ` y sigues ${followedLeagues.length} más` : ''}.`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-2xl mx-auto px-4 py-4 sticky top-0 z-10 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input
            type="text"
            placeholder="Buscar liga..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm"
          />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-8 space-y-6">
        {/* Mis ligas (administradas) */}
        {myLeagues.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-primary">admin_panel_settings</span>
                Administras
              </h2>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{myLeagues.length}</span>
            </div>
            <div className="space-y-2">
              {myLeagues.map(league => (
                <LeagueCard
                  key={league.id}
                  league={league}
                  accessType="owner"
                  onClick={() => handleLeagueClick(league)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Ligas que sigues / públicas */}
        {followedLeagues.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-amber-500">star</span>
                Sigues / Públicas
              </h2>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{followedLeagues.length}</span>
            </div>
            <div className="space-y-2">
              {followedLeagues.map(league => (
                <LeagueCard
                  key={league.id}
                  league={league}
                  accessType="follower"
                  onClick={() => handleLeagueClick(league)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Estado vacío */}
        {myLeagues.length === 0 && followedLeagues.length === 0 && (
          <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
            <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-3xl text-slate-400">emoji_events</span>
            </div>
            <p className="text-slate-700 dark:text-slate-200 font-bold mb-1">
              No tenés ligas todavía
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Crea tu primera liga para empezar a gestionar equipos y partidos.
            </p>
            <button
              onClick={() => navigate('/create-league')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-purple-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Crear Liga
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface LeagueCardProps {
  league: League;
  accessType: AccessType;
  onClick: () => void;
}

const LeagueCard: React.FC<LeagueCardProps> = ({ league, accessType, onClick }) => {
  const badgeColor = accessType === 'owner'
    ? 'bg-gradient-to-r from-primary to-purple-600 text-white'
    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';

  const publicUrl = `${window.location.origin}/l/${league.slug}`;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(publicUrl);
    // Pequeño feedback visual sin necesidad de toast
    const btn = e.currentTarget as HTMLButtonElement;
    const icon = btn.querySelector('span');
    if (icon) {
      const originalText = icon.textContent;
      icon.textContent = 'check';
      setTimeout(() => {
        if (icon.textContent === 'check') icon.textContent = originalText;
      }, 1500);
    }
  };

  return (
    <div className="group w-full bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 hover:shadow-lg transition-all shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onClick}
          className="flex items-center gap-4 flex-1 min-w-0 text-left active:scale-[0.99] transition-transform"
        >
          <div className="size-14 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
            {league.logo_url ? (
              <img src={league.logo_url} alt={league.name} className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-2xl text-slate-400">emoji_events</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-base truncate dark:text-white">{league.name}</h3>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${badgeColor}`}>
                {accessType === 'owner' ? (
                  <>
                    <span className="material-symbols-outlined text-[11px]">admin_panel_settings</span>
                    Admin
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[11px]">visibility</span>
                    Pública
                  </>
                )}
              </span>
              {league.is_public && (
                <code className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                  /l/{league.slug}
                </code>
              )}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          {league.is_public && (
            <button
              onClick={handleCopyLink}
              title="Copiar link público"
              className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">link</span>
            </button>
          )}
          <button
            onClick={onClick}
            className="p-2 rounded-lg text-slate-300 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeagueSelectorScreen;
