import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';

const UserManagementScreen: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentUser, setCurrentUser] = useState<any>(null);

    const roles = [
        { value: 'superadmin', label: 'Super Admin' },
        { value: 'admin', label: 'Administrador' },
        { value: 'referee', label: 'Árbitro' },
        { value: 'captain', label: 'Capitán' },
        { value: 'player', label: 'Jugador' },
        { value: 'user', label: 'Usuario' },
    ];

    useEffect(() => {
        checkAdminAndFetchUsers();
    }, []);

    const checkAdminAndFetchUsers = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/admin-login');
                return;
            }
            setCurrentUser(user);

            // Verify superadmin role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (profile?.role !== 'superadmin') {
                showToast('No tienes permisos de super administrador', 'error');
                navigate('/');
                return;
            }

            // Fetch all profiles
            const { data: allUsers, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(allUsers || []);

        } catch (error: any) {
            console.error('Error fetching users:', error);
            showToast('Error al cargar usuarios', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;

            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
            showToast('Rol actualizado correctamente', 'success');
        } catch (error: any) {
            console.error('Error updating role:', error);
            showToast(`Error al actualizar rol: ${error.message}`, 'error');
        }
    };

    const filteredUsers = users.filter(u =>
        (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
                Cargando...
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen font-display pb-24 text-slate-900 dark:text-white">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-slate-900 dark:text-white">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold">Gestión de Usuarios</h1>
                <div className="w-10"></div>
            </div>

            <div className="max-w-3xl mx-auto p-4 flex flex-col gap-6">
                {/* Search Bar */}
                <div className="relative flex items-center w-full h-12 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 transition-shadow shadow-sm">
                    <div className="grid place-items-center h-full w-12 text-slate-400">
                        <span className="material-symbols-outlined">search</span>
                    </div>
                    <input
                        className="peer h-full w-full outline-none bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 pr-4 font-normal"
                        placeholder="Buscar por nombre o correo..."
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex flex-col gap-3">
                    {filteredUsers.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            No se encontraron usuarios.
                        </div>
                    ) : (
                        filteredUsers.map((userItem) => (
                            <div key={userItem.id} className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                                {/* User Info */}
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="size-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                        {userItem.avatar_url ? (
                                            <img src={userItem.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="material-symbols-outlined text-slate-400">person</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <p className="font-bold text-slate-900 dark:text-white truncate">
                                            {userItem.full_name || 'Usuario sin nombre'}
                                            {userItem.id === currentUser?.id && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Tú</span>}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{userItem.email}</p>
                                    </div>
                                </div>

                                {/* Role Selector */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs font-medium text-slate-500">Rol:</span>
                                    <select
                                        className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm px-3 py-2 font-medium focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                                        value={userItem.role || 'user'}
                                        onChange={(e) => handleRoleChange(userItem.id, e.target.value)}
                                        disabled={userItem.id === currentUser?.id} // Prevent changing own role to lock yourself out
                                    >
                                        {roles.map(role => (
                                            <option key={role.value} value={role.value}>
                                                {role.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserManagementScreen;
