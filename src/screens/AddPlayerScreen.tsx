import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';
import Button from '../components/Button';
import Input from '../components/Input';

const AddPlayerScreen: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { league_id } = location.state || {};
    const { showToast } = useToast();

    const [loading, setLoading] = useState(false);
    const [teams, setTeams] = useState<any[]>([]);

    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [name, setName] = useState('');
    const [number, setNumber] = useState('');
    const [position, setPosition] = useState('Delantero');
    const [photo, setPhoto] = useState<File | null>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    useEffect(() => {
        if (!league_id) {
            showToast('Error: No se ha especificado una liga.', 'error');
            navigate(-1);
            return;
        }

        const fetchTeams = async () => {
            const { data } = await supabase
                .from('teams')
                .select('id, name')
                .eq('league_id', league_id)
                .order('name');

            if (data) {
                setTeams(data);
                if (data.length > 0) setSelectedTeamId(data[0].id);
            }
        };
        fetchTeams();
    }, [league_id, navigate, showToast]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setPhoto(e.target.files[0]);
        }
    };

    const handleSave = async () => {
        if (!name.trim() || !selectedTeamId) {
            showToast('Completa todos los campos obligatorios', 'error');
            return;
        }

        setLoading(true);
        try {
            let photoUrl = null;

            if (photo) {
                setUploadingPhoto(true);
                const fileExt = photo.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('player-photos')
                    .upload(filePath, photo);

                if (uploadError) {
                    console.error('Error uploading photo:', uploadError);
                    // Continue without photo or warn user? We'll warn but continue if possible or fail?
                    // Let's fail for now to let them know.
                    throw new Error('Error al subir la foto: ' + uploadError.message);
                }

                const { data: publicUrlData } = supabase.storage
                    .from('player-photos')
                    .getPublicUrl(filePath);

                photoUrl = publicUrlData.publicUrl;
                setUploadingPhoto(false);
            }

            const { error } = await supabase
                .from('players')
                .insert([{
                    team_id: selectedTeamId,
                    name: name,
                    number: parseInt(number) || 0,
                    position: position,
                    photo_url: photoUrl
                }]);

            if (error) throw error;

            showToast('Jugador agregado exitosamente', 'success');
            navigate(-1); // Go back to league management
        } catch (error: any) {
            showToast('Error al agregar jugador: ' + error.message, 'error');
        } finally {
            setLoading(false);
            setUploadingPhoto(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen font-display text-slate-900 dark:text-white pb-24">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-white">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold">Agregar Jugador</h1>
                <div className="w-6"></div>
            </div>

            <div className="p-4 flex flex-col gap-4 max-w-md mx-auto">
                {/* Team Selection */}
                <div>
                    <label className="block text-sm font-medium mb-1 ml-1 text-slate-500">Equipo</label>
                    <select
                        className="w-full h-12 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 px-3 outline-none focus:ring-2 focus:ring-primary"
                        value={selectedTeamId}
                        onChange={e => setSelectedTeamId(e.target.value)}
                    >
                        {teams.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                    {teams.length === 0 && <p className="text-xs text-red-400 mt-1 ml-1">No hay equipos en esta liga.</p>}
                </div>

                {/* Photo Upload */}
                <div>
                    <label className="block text-sm font-medium mb-1 ml-1 text-slate-500">Foto (Opcional)</label>
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-300 dark:border-slate-600">
                            {photo ? (
                                <img src={URL.createObjectURL(photo)} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <span className="material-symbols-outlined text-3xl text-slate-400">person</span>
                            )}
                        </div>
                        <label className="flex-1 cursor-pointer">
                            <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary text-slate-700 dark:text-slate-300 font-bold py-2 px-4 rounded-xl text-center text-sm transition-all shadow-sm">
                                {photo ? 'Cambiar Foto' : 'Subir Foto'}
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handlePhotoChange}
                            />
                        </label>
                    </div>
                </div>


                <div className="flex gap-4">
                    <div className="flex-[2]">
                        <label className="block text-sm font-medium mb-1 ml-1 text-slate-500">Nombre</label>
                        <Input
                            placeholder="Nombre del jugador"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1 ml-1 text-slate-500">Dorsal</label>
                        <Input
                            placeholder="#"
                            type="number"
                            value={number}
                            onChange={e => setNumber(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1 ml-1 text-slate-500">Posición</label>
                    <select
                        className="w-full h-12 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 px-3 outline-none focus:ring-2 focus:ring-primary"
                        value={position}
                        onChange={e => setPosition(e.target.value)}
                    >
                        <option>Portero</option>
                        <option>Defensa</option>
                        <option>Medio</option>
                        <option>Delantero</option>
                    </select>
                </div>

                <div className="mt-4">
                    <Button onClick={handleSave} disabled={loading || uploadingPhoto || teams.length === 0}>
                        {uploadingPhoto ? 'Subiendo foto...' : (loading ? 'Guardando...' : 'Guardar Jugador')}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AddPlayerScreen;
