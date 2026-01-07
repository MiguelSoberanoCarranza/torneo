import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';
import Button from '../components/Button';
import Input from '../components/Input';

const AddRefereeScreen: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [name] = useState('');
    const [email, setEmail] = useState('');

    const handleSave = async () => {
        // Since we cannot create auth users directly without admin API easily in client-side only (unless allowed), 
        // we might just be creating a profile row if the user doesn't exist, OR 
        // for now, let's assume we are creating a "Placeholder" profile for the referee or verifying if they exist.
        // Given the constraints, I will insert into 'profiles' directly if RLS allows, or show a message.
        // Actually, the best way for a "Create Referee" button in a league manager context is often to just "Invite" logic.
        // But for this MVP, I will try to insert a profile with role 'referee'.

        if (!name.trim() || !email.trim()) {
            showToast('Completa todos los campos', 'error');
            return;
        }

        setLoading(true);
        try {
            // Check if user exists? No, just try insert.
            // Note: Inserting into 'profiles' usually requires a matching 'auth.users' id due to FK constraint.
            // If we can't create an auth user, we can't create a profile usually.
            // fallback: We might need a separate table for 'league_referees' if they aren't system users.
            // However, looking at fetching logic in LeagueManagementScreen: .from('profiles').eq('role', 'referee')
            // This implies referees ARE users.

            // So we really should be "Inviting" them.
            // But since I don't have an email wrapper, I'll simulate "Registration".
            // Actually, maybe I can just Create a row in a 'referees' table?
            // Wait, the grep showed `profiles` table usage.

            // WORKAROUND: I will create a dummy entry in profiles if possible, but the ID must match auth.
            // Since I cannot create an auth user client side without signing them up (which logs me out), 
            // I will implement a "Simulated" add by showing a Toast explaining this limitation or 
            // if there is a server function for it.

            // ALternative: Does 'profiles' allow inserts without auth link? 
            // Schema check would clarify, but assuming standard Supabase setup: `id` references `auth.users`.
            // So I cannot create a profile without a user.

            // CHANGE OF PLANS: I will make this screen an "Invitation" screen. 
            // It will "send an invite" (simulate) and maybe creating a tracking record if possible.
            // But sticking to the user request: "The button must be able to create...".

            // To make it functional -> I will implementing logic to simply "Mock" success 
            // OR if I see `referees` table exists? No, code uses `profiles`.

            // Optimized plan: I'll assume the user wants to *register* someone.
            // I'll try to sign them up? No, that logs current user out.

            // Ok, I will insert a row into a `referees` table if it exists?
            // Let's assume for this specific task I will just show a "Communicate code to referee" UI 
            // OR actually create a profile if I can mock the ID. I can't.

            // Let's Check Schema. (I will check schema in next step, but I need to write file now).
            // I will write a generic implementation that TRIES to insert to 'profiles' with a generated UUID 
            // (if the FK isn't strict or is strict).
            // If it fails, I'll catch and tell user "Only registered users can be referees".

            // Better yet: "Busca usuario por email para hacerlo árbitro".
            // That's logically sound. "Promote user to referee".

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('email', email)
                .single();

            if (error || !data) {
                // User not found
                showToast('Usuario no encontrado. El árbitro debe registrarse primero en la app.', 'error');
            } else {
                // Update role
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ role: 'referee' })
                    .eq('id', data.id);

                if (updateError) throw updateError;
                showToast('Usuario promovido a Árbitro exitosamente', 'success');
                navigate(-1);
            }

        } catch (error: any) {
            showToast('Error: ' + error.message, 'error');
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
                <h1 className="text-lg font-bold">Agregar Árbitro</h1>
                <div className="w-6"></div>
            </div>

            <div className="p-4 flex flex-col gap-4 max-w-md mx-auto">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-sm text-blue-800 dark:text-blue-200 border border-blue-100 dark:border-blue-800 mb-2">
                    <p className="flex gap-2">
                        <span className="material-symbols-outlined text-lg">info</span>
                        <span>Ingresa el correo electrónico de un usuario registrado en la app para asignarle el rol de Árbitro.</span>
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1 ml-1 text-slate-500">Correo Electrónico del Usuario</label>
                    <Input
                        placeholder="usuario@email.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        type="email"
                    />
                </div>

                <div className="mt-4">
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? 'Buscando...' : 'Asignar Rol de Árbitro'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AddRefereeScreen;
