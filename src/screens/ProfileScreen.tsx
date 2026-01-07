import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Button from '../components/Button';
import Input from '../components/Input';
import { useToast } from '../context/ToastContext';

const ProfileScreen: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [fullName, setFullName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');

    const { showToast } = useToast();

    useEffect(() => {
        const getProfile = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                navigate('/admin-login');
                return;
            }

            setUser(user);

            const { data } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', user.id)
                .single();

            if (data) {
                setFullName(data.full_name || '');
                setAvatarUrl(data.avatar_url || '');
            }
            setLoading(false);
        };

        getProfile();
    }, [navigate]);

    const updateProfile = async () => {
        setUpdating(true);
        const { data, error } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                email: user.email,
                full_name: fullName,
            })
            .select();

        if (error) {
            console.error('Error updating profile:', error);
            showToast(`Error al actualizar perfil: ${error.message}`, 'error');
        } else if (!data || data.length === 0) {
            console.warn('Upsert successful but no data returned. Check RLS policies.');
            showToast('Error de permisos: No se guardaron datos.', 'error');
        } else {
            showToast('Perfil actualizado correctamente', 'success');
        }
        setUpdating(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/admin-login');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center text-white">
                Cargando...
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen font-display pb-24 text-slate-900 dark:text-white">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-white">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold">Mi Perfil</h1>
                <div className="w-6"></div> {/* Spacer for centering */}
            </div>

            <div className="p-6 flex flex-col items-center gap-6">
                {/* Avatar Section */}
                <div className="relative">
                    <div className="w-28 h-28 rounded-full bg-slate-800 border-4 border-primary/20 flex items-center justify-center overflow-hidden">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="material-symbols-outlined text-6xl text-slate-500">person</span>
                        )}
                    </div>
                    <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white shadow-lg">
                        <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                </div>

                {/* Info Display */}
                <div className="text-center">
                    <p className="text-slate-400 text-sm">Correo Electrónico</p>
                    <p className="text-lg font-medium">{user?.email}</p>
                </div>

                {/* Form */}
                <div className="w-full space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400 ml-1">Nombre Completo</label>
                        <Input
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Ej. Juan Pérez"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="w-full mt-4 space-y-3">
                    <Button onClick={updateProfile} disabled={updating}>
                        {updating ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>

                    <button
                        onClick={handleLogout}
                        className="w-full py-3 text-red-500 font-medium hover:bg-red-500/10 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        Cerrar Sesión
                    </button>
                </div>
            </div>

        </div>
    );
};

export default ProfileScreen;
