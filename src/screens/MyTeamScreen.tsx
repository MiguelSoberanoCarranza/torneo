import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import CreateTeamScreen from './CreateTeamScreen';

const MyTeamScreen: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [myTeam, setMyTeam] = useState<{ id: string, league_id: string } | null>(null);

    useEffect(() => {
        checkTeam();
    }, []);

    const checkTeam = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/admin-login');
                return;
            }

            // Find team managed by this user
            const { data: team } = await supabase
                .from('teams')
                .select('id, league_id')
                .eq('manager_id', user.id)
                .single();

            if (team) {
                setMyTeam(team);
            }
        } catch (error) {
            console.error('Error fetching team:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (myTeam) {
        return <CreateTeamScreen initialTeamId={myTeam.id} initialLeagueId={myTeam.league_id} />;
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-4xl text-slate-400">sentiment_dissatisfied</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">No tienes equipo asignado</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-xs">
                No hemos encontrado un equipo vinculado a tu cuenta. Si crees que es un error, contacta al administrador de la liga.
            </p>
            <button
                onClick={() => navigate('/')}
                className="mt-8 px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-blue-600 transition-colors"
            >
                Volver al Inicio
            </button>
        </div>
    );
};

export default MyTeamScreen;
