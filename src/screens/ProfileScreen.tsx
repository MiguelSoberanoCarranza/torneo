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

    const [role, setRole] = useState('');

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
                .select('full_name, avatar_url, role')
                .eq('id', user.id)
                .single();

            if (data) {
                setFullName(data.full_name || '');
                setAvatarUrl(data.avatar_url || '');
                setRole(data.role || '');
            }
            setLoading(false);
        };

        getProfile();
    }, [navigate]);

    const [showAvatarSelector, setShowAvatarSelector] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // ... existing useEffect ...

    const updateProfile = async () => {
        setUpdating(true);
        let finalAvatarUrl = avatarUrl;

        // Upload File if selected
        if (selectedFile) {
            try {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `${user.id}_${Date.now()}.${fileExt}`; // Unique ID + Timestamp
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('user-avatars')
                    .upload(filePath, selectedFile);

                if (uploadError) {
                    console.error('Error uploading avatar:', uploadError);
                    showToast('Error al subir imagen', 'error');
                    setUpdating(false);
                    return;
                }

                const { data: publicUrlData } = supabase.storage
                    .from('user-avatars')
                    .getPublicUrl(filePath);

                finalAvatarUrl = publicUrlData.publicUrl;
                setAvatarUrl(finalAvatarUrl); // Update local state for immediate feedback

            } catch (error: any) {
                console.error('Upload exception:', error);
                showToast('Excepción al subir imagen', 'error');
                setUpdating(false);
                return;
            }
        }

        const { data, error } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                email: user.email,
                full_name: fullName,
                avatar_url: finalAvatarUrl,
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
            setShowAvatarSelector(false); // Close if open
            setSelectedFile(null);
        }
        setUpdating(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setAvatarUrl(URL.createObjectURL(file)); // Preview immediately
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/admin-login');
    };

    const presetAvatars = [
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Calvin',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Bella',
        'https://api.dicebear.com/7.x/shapes/svg?seed=Geo',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Robot',
    ];

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
                <div className="relative group cursor-pointer" onClick={() => setShowAvatarSelector(!showAvatarSelector)}>
                    <div className="w-28 h-28 rounded-full bg-slate-800 border-4 border-primary/20 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="material-symbols-outlined text-6xl text-slate-500">person</span>
                        )}
                    </div>
                    <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white shadow-lg pointer-events-none">
                        <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                </div>

                {/* Avatar Selector Modal/Expandable */}
                {showAvatarSelector && (
                    <div className="w-full max-w-sm bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg animate-in slide-in-from-top-2">
                        <p className="text-sm font-bold mb-3 text-center">Elige un icono o sube tu foto</p>

                        {/* 1. Presets */}
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            {presetAvatars.map((url) => (
                                <button
                                    key={url}
                                    onClick={() => { setAvatarUrl(url); setSelectedFile(null); }}
                                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${avatarUrl === url ? 'border-primary ring-2 ring-primary/20 scale-95' : 'border-transparent hover:border-slate-400'}`}
                                >
                                    <img src={url} alt="Preset" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>

                        {/* 2. Upload Button */}
                        <div className="relative">
                            <label className="flex items-center justify-center w-full h-12 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors gap-2 text-slate-600 dark:text-slate-300 font-medium">
                                <span className="material-symbols-outlined">cloud_upload</span>
                                <span>Subir Imagen</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileSelect}
                                />
                            </label>
                            {selectedFile && <p className="text-xs text-center mt-2 text-primary truncate">Seleccionado: {selectedFile.name}</p>}
                        </div>
                    </div>
                )}

                {/* Info Display */}
                <div className="text-center">
                    <p className="text-slate-400 text-sm">Correo Electrónico</p>
                    <p className="text-lg font-medium">{user?.email}</p>
                    {role === 'superadmin' && <span className="text-xs bg-purple-500/20 text-purple-600 px-2 py-0.5 rounded-full font-bold mt-1 inline-block">Super Admin</span>}
                    {role === 'admin' && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold mt-1 inline-block">Administrador</span>}
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

                    {role === 'superadmin' && (
                        <button
                            onClick={() => navigate('/user-management')}
                            className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined">admin_panel_settings</span>
                            Administrar Usuarios
                        </button>
                    )}

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
