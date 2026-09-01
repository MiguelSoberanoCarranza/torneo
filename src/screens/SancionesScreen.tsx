import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';
import { buildSanctionTotals } from '../utils/standings';
import { filterActiveLeagues } from '../utils/leagues';

interface TeamSanction {
  id: string;
  league_id: string;
  team_id: string;
  points_delta: number;
  reason: string;
  created_at: string;
  team?: { name: string; shield_url: string | null };
  creator?: { full_name: string | null; email: string };
}

type SanctionAction = 'subtract' | 'add';

const SancionesScreen: React.FC = () => {
  const { showToast } = useToast();
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [sanctions, setSanctions] = useState<TeamSanction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [action, setAction] = useState<SanctionAction>('subtract');
  const [points, setPoints] = useState('1');
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchLeagues();
  }, []);

  useEffect(() => {
    if (selectedLeagueId) {
      fetchSanctionsData(selectedLeagueId);
    }
  }, [selectedLeagueId]);

  const fetchLeagues = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLeagues([]);
      setLoading(false);
      return;
    }

    const { data: myLeagues, error } = await supabase
      .from('leagues')
      .select('*')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching owned leagues', error);
      showToast('Error al cargar tus ligas', 'error');
      setLeagues([]);
      setLoading(false);
      return;
    }

    const ownedLeagues = filterActiveLeagues(myLeagues || []);
    setLeagues(ownedLeagues);

    if (ownedLeagues.length > 0) {
      setSelectedLeagueId((prev) =>
        prev && ownedLeagues.some((l) => l.id === prev) ? prev : ownedLeagues[0].id
      );
    } else {
      setLoading(false);
    }
  };

  const fetchSanctionsData = async (leagueId: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: leagueData } = await supabase
        .from('leagues')
        .select('owner_id')
        .eq('id', leagueId)
        .single();

      const isOwner = Boolean(user && leagueData?.owner_id === user.id);
      setCanManage(isOwner);

      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, shield_url')
        .eq('league_id', leagueId)
        .order('name');

      if (teamsError) throw teamsError;
      setTeams(teamsData || []);
      if (teamsData && teamsData.length > 0) {
        setSelectedTeamId((prev) =>
          teamsData.some((t) => t.id === prev) ? prev : teamsData[0].id
        );
      }

      const { data: sanctionsData, error: sanctionsError } = await supabase
        .from('team_sanctions')
        .select(`
          id, league_id, team_id, points_delta, reason, created_at,
          team:team_id(name, shield_url),
          creator:created_by(full_name, email)
        `)
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false });

      if (sanctionsError) throw sanctionsError;
      setSanctions(
        (sanctionsData || []).map((row: any) => ({
          ...row,
          team: Array.isArray(row.team) ? row.team[0] : row.team,
          creator: Array.isArray(row.creator) ? row.creator[0] : row.creator,
        }))
      );
    } catch (error) {
      console.error('Error loading sanctions', error);
      showToast('Error al cargar sanciones', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeagueId || !selectedTeamId || !reason.trim()) {
      showToast('Completa todos los campos', 'error');
      return;
    }

    const amount = parseInt(points, 10);
    if (!amount || amount <= 0) {
      showToast('Indica una cantidad de puntos válida', 'error');
      return;
    }

    const pointsDelta = action === 'subtract' ? -amount : amount;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('team_sanctions').insert({
        league_id: selectedLeagueId,
        team_id: selectedTeamId,
        points_delta: pointsDelta,
        reason: reason.trim(),
        created_by: user?.id || null,
      });

      if (error) throw error;

      showToast(
        action === 'subtract'
          ? `Se restaron ${amount} punto(s) al equipo`
          : `Se sumaron ${amount} punto(s) al equipo`,
        'success'
      );

      setReason('');
      setPoints('1');
      setShowForm(false);
      await fetchSanctionsData(selectedLeagueId);
    } catch (error: any) {
      console.error('Error saving sanction', error);
      showToast(error.message || 'Error al registrar la sanción', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sanction: TeamSanction) => {
    if (!canManage) return;
    const teamName = sanction.team?.name || 'equipo';
    const confirmDelete = window.confirm(
      `¿Eliminar esta sanción de ${teamName}? Se revertirá el ajuste de ${sanction.points_delta} punto(s) en la tabla.`
    );
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('team_sanctions')
        .delete()
        .eq('id', sanction.id);

      if (error) throw error;
      showToast('Sanción eliminada', 'success');
      if (selectedLeagueId) await fetchSanctionsData(selectedLeagueId);
    } catch (error: any) {
      console.error('Error deleting sanction', error);
      showToast(error.message || 'Error al eliminar', 'error');
    }
  };

  const sanctionTotals = buildSanctionTotals(
    sanctions.map((s) => ({ team_id: s.team_id, points_delta: s.points_delta }))
  );

  const teamsWithAdjustments = teams
    .map((team) => ({
      ...team,
      adjustment: sanctionTotals.get(team.id) || 0,
    }))
    .filter((t) => t.adjustment !== 0)
    .sort((a, b) => a.adjustment - b.adjustment);

  const currentLeagueName =
    leagues.find((l) => l.id === selectedLeagueId)?.name || 'Seleccionar Liga';

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="bg-slate-50 dark:bg-slate-900 font-display antialiased text-gray-900 dark:text-white min-h-screen">
      <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-24">
        <div className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="max-w-3xl mx-auto w-full p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Sanciones</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ajustes disciplinarios de puntos por equipo
                </p>
              </div>
              {leagues.length > 0 && (
                <select
                  className="bg-slate-100 dark:bg-slate-800 border-none text-sm font-semibold rounded-lg p-2 max-w-[150px] truncate outline-none focus:ring-2 focus:ring-primary"
                  value={selectedLeagueId || ''}
                  onChange={(e) => setSelectedLeagueId(e.target.value)}
                >
                  {leagues.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {!loading && leagues.length === 0 ? (
          <div className="max-w-3xl mx-auto w-full p-8 flex flex-col items-center justify-center text-center gap-3">
            <span className="material-symbols-outlined text-5xl text-slate-300">gavel</span>
            <h3 className="text-lg font-bold">Acceso restringido</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Solo los administradores de liga pueden gestionar sanciones disciplinarias.
            </p>
          </div>
        ) : (
        <div className="max-w-3xl mx-auto w-full p-4 flex flex-col gap-4">
          {canManage && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-white font-bold shadow-md hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined">gavel</span>
              Registrar sanción
            </button>
          )}

          {teamsWithAdjustments.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">
                Saldo por equipo — {currentLeagueName}
              </h3>
              <div className="flex flex-col gap-2">
                {teamsWithAdjustments.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex items-center justify-center text-[10px] font-bold">
                        {team.shield_url ? (
                          <img src={team.shield_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          team.name.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <span className="font-semibold text-sm">{team.name}</span>
                    </div>
                    <span
                      className={`font-black text-sm ${
                        team.adjustment < 0
                          ? 'text-red-500'
                          : team.adjustment > 0
                          ? 'text-emerald-500'
                          : 'text-slate-400'
                      }`}
                    >
                      {team.adjustment > 0 ? '+' : ''}
                      {team.adjustment} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-400">Cargando...</div>
            ) : sanctions.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2 block opacity-50">
                  gavel
                </span>
                No hay sanciones registradas en esta liga.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {sanctions.map((sanction) => (
                  <div key={sanction.id} className="p-4 flex gap-3">
                    <div
                      className={`shrink-0 size-10 rounded-full flex items-center justify-center font-black text-sm ${
                        sanction.points_delta < 0
                          ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                      }`}
                    >
                      {sanction.points_delta > 0 ? '+' : ''}
                      {sanction.points_delta}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold truncate">
                          {sanction.team?.name || 'Equipo'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(sanction.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {sanction.reason}
                      </p>
                      {sanction.creator && (
                        <p className="text-xs text-slate-400 mt-1">
                          Por: {sanction.creator.full_name || sanction.creator.email}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <button
                        onClick={() => handleDelete(sanction)}
                        className="shrink-0 size-8 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Eliminar sanción"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-lg">Nueva sanción</h3>
              <button
                onClick={() => setShowForm(false)}
                className="size-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                  Equipo
                </label>
                <select
                  className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  required
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                  Acción
                </label>
                <div className="flex h-12 w-full items-center rounded-xl bg-slate-100 dark:bg-slate-900 p-1">
                  {[
                    { value: 'subtract' as SanctionAction, label: 'Restar puntos' },
                    { value: 'add' as SanctionAction, label: 'Sumar puntos' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer h-full grow items-center justify-center rounded-lg px-2 has-[:checked]:bg-white dark:has-[:checked]:bg-slate-800 has-[:checked]:shadow-sm has-[:checked]:text-primary text-slate-500 text-sm font-bold transition-all"
                    >
                      <span>{opt.label}</span>
                      <input
                        type="radio"
                        name="action"
                        value={opt.value}
                        checked={action === opt.value}
                        onChange={() => setAction(opt.value)}
                        className="invisible w-0 absolute"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                  Puntos
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                  Motivo
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej: Conducta antideportiva, no presentación, etc."
                  rows={3}
                  className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saving || teams.length === 0}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Aplicar sanción'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SancionesScreen;
