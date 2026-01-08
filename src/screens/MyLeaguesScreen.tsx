import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';

const MyLeaguesScreen: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [leagues, setLeagues] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMyLeagues();
    }, []);

    const fetchMyLeagues = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                navigate('/admin-login');
                return;
            }

            const { data, error } = await supabase
                .from('leagues')
                .select('*')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            setLeagues(data || []);
        } catch (error: any) {
            console.error('Error fetching leagues:', error);
            showToast('Error al cargar ligas', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased min-h-screen pb-24">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between py-3">
                        <h1 className="text-xl font-bold tracking-tight">Mis Ligas</h1>
                        <button
                            onClick={() => navigate('/create-league')}
                            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-full font-bold text-sm shadow-md hover:bg-primary-dark transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg">add</span>
                            <span>Crear</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                    </div>
                ) : leagues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-4xl text-slate-400">emoji_events</span>
                        </div>
                        <h3 className="text-lg font-bold mb-2">No tienes ligas aún</h3>
                        <p className="text-slate-500 mb-6 max-w-xs">Crea tu primera liga para comenzar a gestionar el torneo.</p>
                        <button
                            onClick={() => navigate('/create-league')}
                            className="text-primary font-bold hover:underline"
                        >
                            Crear Liga
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {leagues.map((league) => (
                            <button
                                key={league.id}
                                onClick={() => navigate(`/league/${league.id}`)}
                                className="bg-white dark:bg-surface-dark p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4 hover:shadow-md transition-shadow text-left group"
                            >
                                <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-600">
                                    {league.logo_url ? (
                                        <img src={league.logo_url} alt={league.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="material-symbols-outlined text-3xl text-slate-400 group-hover:text-primary transition-colors">emoji_events</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">{league.name}</h3>
                                    <p className="text-xs text-slate-500 truncate">{league.format ? `Fútbol ${league.format}` : 'Formato no definido'}</p>
                                </div>
                                <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyLeaguesScreen;
