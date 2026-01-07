import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';
import Button from '../components/Button';
import Input from '../components/Input';

const CreateMatchScreen: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [teams, setTeams] = useState<any[]>([]);

    // Form State
    const [homeTeamId, setHomeTeamId] = useState('');
    const [awayTeamId, setAwayTeamId] = useState('');
    const [matchDate, setMatchDate] = useState('');
    const [matchTime, setMatchTime] = useState('');
    const [location, setLocation] = useState('');

    useEffect(() => {
        const fetchTeams = async () => {
            // Determine active league context? For now fetch all teams or let user pick league first.
            // To simplify, let's fetch all teams for now or better, pick a league.
            // Simplified: Fetch all teams and filter in UI? No, too many.
            // Let's assume we pass league_id in state or we fetch a default one.
            // Ideally we need a league selector. 
            // For MVP: Fetch all teams ordered by name.
            const { data } = await supabase.from('teams').select('id, name').order('name');
            if (data) setTeams(data);
        };
        fetchTeams();
    }, []);

    const handleSave = async () => {
        if (!homeTeamId || !awayTeamId || !matchDate || !matchTime) {
            showToast('Completa los campos obligatorios', 'error');
            return;
        }

        if (homeTeamId === awayTeamId) {
            showToast('El equipo local y visitante no pueden ser el mismo', 'error');
            return;
        }

        setLoading(true);
        try {
            // Combine date and time
            const timestamp = `${matchDate}T${matchTime}:00`;

            const { error } = await supabase.from('matches').insert([{
                home_team_id: homeTeamId,
                away_team_id: awayTeamId,
                start_time: timestamp,
                location: location,
                status: 'scheduled'
            }]);

            if (error) throw error;
            showToast('Partido creado exitosamente', 'success');
            navigate(-1);
        } catch (error: any) {
            showToast('Error al crear partido: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen font-display text-slate-900 dark:text-white pb-24">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-white">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold">Crear Partido Manual</h1>
                <div className="w-6"></div>
            </div>

            <div className="p-4 flex flex-col gap-4 max-w-md mx-auto">
                {/* Home Team */}
                <div>
                    <label className="block text-sm font-medium mb-1 ml-1 text-slate-500">Equipo Local</label>
                    <select
                        className="w-full h-12 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 px-3 outline-none focus:ring-2 focus:ring-primary"
                        value={homeTeamId}
                        onChange={e => setHomeTeamId(e.target.value)}
                    >
                        <option value="">Seleccionar Equipo</option>
                        {teams.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>

                {/* Away Team */}
                <div>
                    <label className="block text-sm font-medium mb-1 ml-1 text-slate-500">Equipo Visitante</label>
                    <select
                        className="w-full h-12 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 px-3 outline-none focus:ring-2 focus:ring-primary"
                        value={awayTeamId}
                        onChange={e => setAwayTeamId(e.target.value)}
                    >
                        <option value="">Seleccionar Equipo</option>
                        {teams.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1 ml-1 text-slate-500">Fecha</label>
                        <Input
                            type="date"
                            value={matchDate}
                            onChange={e => setMatchDate(e.target.value)}
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1 ml-1 text-slate-500">Hora</label>
                        <Input
                            type="time"
                            value={matchTime}
                            onChange={e => setMatchTime(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1 ml-1 text-slate-500">Ubicación / Cancha</label>
                    <Input
                        placeholder="Ej. Cancha 1"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                    />
                </div>

                <div className="mt-6">
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? 'Creando...' : 'Crear Partido'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CreateMatchScreen;
