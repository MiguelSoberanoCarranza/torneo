import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Header from '../components/Header';
import { useToast } from '../context/ToastContext';
import { supabase } from '../supabaseClient';

const FixtureGeneratorScreen: React.FC = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');

  // Config state
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [matchDuration, setMatchDuration] = useState<number>(40);
  const [breakDuration, setBreakDuration] = useState<number>(10);
  const [selectedDays, setSelectedDays] = useState<string[]>(['Sat']);

  const [loading, setLoading] = useState(false);

  // Load Leagues
  useEffect(() => {
    const fetchLeagues = async () => {
      const { data } = await supabase.from('leagues').select('id, name, match_duration');
      if (data) {
        setLeagues(data);
        if (data.length > 0) {
          setSelectedLeagueId(data[0].id);
          if (data[0].match_duration) setMatchDuration(data[0].match_duration);
        }
      }
    };
    fetchLeagues();
  }, []);

  // Update default duration when league changes
  useEffect(() => {
    const league = leagues.find(l => l.id === selectedLeagueId);
    if (league?.match_duration) {
      setMatchDuration(league.match_duration);
    }
  }, [selectedLeagueId, leagues]);

  const generateFixture = async () => {
    if (!selectedLeagueId) {
      showToast('Selecciona una liga', 'error');
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch Teams
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name')
        .eq('league_id', selectedLeagueId);

      if (!teams || teams.length < 2) {
        showToast('Se necesitan al menos 2 equipos para generar un fixture.', 'error');
        setLoading(false);
        return;
      }

      // 2. Round Robin Algorithm
      const matches = [];
      let roundTeams = [...teams];

      if (roundTeams.length % 2 !== 0) {
        roundTeams.push({ id: 'BYE', name: 'Descansa' });
      }

      const numRounds = roundTeams.length - 1;
      const matchesPerRound = roundTeams.length / 2;

      const slotDurationMinutes = Number(matchDuration) + Number(breakDuration);

      // Start Date Logic
      const [sy, sm, sd] = startDate.split('-').map(Number);
      let currentDate = new Date(sy, sm - 1, sd);

      // Parse Start Time
      const [startHour, startMinute] = startTime.split(':').map(Number);

      for (let round = 0; round < numRounds; round++) {
        // Find next valid day
        while (!isValidDay(currentDate, selectedDays)) {
          currentDate.setDate(currentDate.getDate() + 1);
        }

        // Set START TIME for the day from user config
        let currentHour = startHour;
        let currentMinute = startMinute;

        for (let i = 0; i < matchesPerRound; i++) {
          const home = roundTeams[i];
          const away = roundTeams[roundTeams.length - 1 - i];

          if (home.id !== 'BYE' && away.id !== 'BYE') {
            const matchDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour, currentMinute);
            const isoTimestamp = matchDate.toISOString();

            matches.push({
              league_id: selectedLeagueId,
              home_team_id: home.id,
              away_team_id: away.id,
              start_time: isoTimestamp,
              status: 'scheduled',
              round_number: round + 1,
              location: 'Cancha Principal'
            });

            // Increment time
            currentMinute += slotDurationMinutes;
            while (currentMinute >= 60) {
              currentMinute -= 60;
              currentHour += 1;
            }
          }
        }

        roundTeams = [
          roundTeams[0],
          roundTeams[roundTeams.length - 1],
          ...roundTeams.slice(1, roundTeams.length - 1)
        ];

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // 3. Bulk Insert
      const matchesToInsert = matches.map(m => ({
        league_id: m.league_id,
        home_team_id: m.home_team_id,
        away_team_id: m.away_team_id,
        start_time: m.start_time,
        status: m.status,
        location: m.location,
        round_number: m.round_number
      }));

      const { error } = await supabase.from('matches').insert(matchesToInsert);

      if (error) throw error;

      showToast(`¡Fixture generado! ${matches.length} partidos creados.`, 'success');
      navigate(-1);

    } catch (error: any) {
      console.error(error);
      showToast('Error al generar: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const isValidDay = (date: Date, allowedDays: string[]) => {
    const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = daysMap[date.getDay()];
    return allowedDays.includes(dayName);
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-[#111418] dark:text-white font-display overflow-x-hidden antialiased selection:bg-primary selection:text-white pb-24 min-h-screen flex flex-col">
      <Header title="Generador de Fixture" onBack={() => navigate(-1)} />

      <div className="flex-1 flex flex-col gap-6 p-4 max-w-md mx-auto w-full">
        {/* League Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-[#111418] dark:text-white text-base font-medium leading-normal">Seleccionar Liga</label>
          <div className="relative">
            <select
              value={selectedLeagueId}
              onChange={(e) => setSelectedLeagueId(e.target.value)}
              className="form-select w-full rounded-xl border border-[#dce0e5] dark:border-border-dark bg-white dark:bg-surface-dark text-[#111418] dark:text-white h-14 pl-4 pr-10 text-base font-normal focus:border-primary focus:ring-1 focus:ring-primary appearance-none outline-none transition-colors"
              disabled={loading}
            >
              {leagues.length === 0 && <option>Cargando ligas...</option>}
              {leagues.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary flex items-center">
              <span className="material-symbols-outlined">expand_more</span>
            </div>
          </div>
        </div>

        {/* Start Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[#111418] dark:text-white text-base font-medium leading-normal">Fecha Inicio</label>
            <div className="relative flex w-full items-center rounded-xl border border-[#dce0e5] dark:border-border-dark bg-white dark:bg-surface-dark h-14">
              <input
                className="flex w-full min-w-0 flex-1 resize-none bg-transparent text-[#111418] dark:text-white focus:outline-none h-full pl-4 pr-2 text-base font-normal leading-normal border-none"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[#111418] dark:text-white text-base font-medium leading-normal">Hora Inicio</label>
            <div className="relative flex w-full items-center rounded-xl border border-[#dce0e5] dark:border-border-dark bg-white dark:bg-surface-dark h-14">
              <input
                className="flex w-full min-w-0 flex-1 resize-none bg-transparent text-[#111418] dark:text-white focus:outline-none h-full pl-4 pr-2 text-base font-normal leading-normal border-none"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Durations */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[#111418] dark:text-white text-base font-medium leading-normal">Duración (min)</label>
            <div className="relative flex w-full items-center rounded-xl border border-[#dce0e5] dark:border-border-dark bg-white dark:bg-surface-dark h-14">
              <input
                className="flex w-full bg-transparent text-[#111418] dark:text-white focus:outline-none h-full pl-4 pr-4 text-base font-normal border-none"
                type="number"
                value={matchDuration}
                onChange={(e) => setMatchDuration(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[#111418] dark:text-white text-base font-medium leading-normal">Descanso (min)</label>
            <div className="relative flex w-full items-center rounded-xl border border-[#dce0e5] dark:border-border-dark bg-white dark:bg-surface-dark h-14">
              <input
                className="flex w-full bg-transparent text-[#111418] dark:text-white focus:outline-none h-full pl-4 pr-4 text-base font-normal border-none"
                type="number"
                value={breakDuration}
                onChange={(e) => setBreakDuration(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Days */}
        <div className="flex flex-col gap-2">
          <label className="text-[#111418] dark:text-white text-base font-medium leading-normal">Días de Juego Principal</label>
          <div className="flex flex-wrap gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${selectedDays.includes(day) ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}
              >
                {day}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">El sistema buscará el próximo día disponible a partir de la fecha de inicio.</p>
        </div>

      </div>

      {/* Fixed Bottom Action */}
      <div className="fixed bottom-[88px] left-0 right-0 p-4 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-lg border-t border-transparent dark:border-[#324467]/30 z-20">
        <div className="max-w-md mx-auto w-full">
          <Button
            className="w-full"
            onClick={generateFixture}
            disabled={loading || leagues.length === 0}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin">refresh</span>
                Generando...
              </span>
            ) : (
              <>
                <span className="material-symbols-outlined">auto_fix_high</span>
                Generar Calendario
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FixtureGeneratorScreen;
