import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Button from '../components/Button';
import Input from '../components/Input';

const AdminLoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const validateForm = () => {
    if (!email || !password) {
      setErrorInfo('Por favor completa todos los campos.');
      return false;
    }
    if (password.length < 6) {
      setErrorInfo('La contraseña debe tener al menos 6 caracteres.');
      return false;
    }
    if (isSignUp && password !== confirmPassword) {
      setErrorInfo('Las contraseñas no coinciden.');
      return false;
    }
    return true;
  };

  const handleAuth = async () => {
    setErrorInfo(null);
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (isSignUp) {
        // Sign Up Logic
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        // Optionally create profile if user creation was successful
        if (data.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{ id: data.user.id, email: data.user.email, role: 'admin' }]);

          if (profileError) {
            console.error('Error creating profile:', profileError);
          }
          setRegistrationSuccess(true);
        }
      } else {
        // Sign In Logic
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/');
      }
    } catch (error: any) {
      setErrorInfo(error.message || 'Ha ocurrido un error durante la autenticación.');
    } finally {
      setLoading(false);
    }
  };

  if (registrationSuccess) {
    return (
      <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#192233] border border-[#324467] rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 text-green-500">
            <span className="material-symbols-outlined text-5xl">mark_email_read</span>
          </div>
          <h2 className="text-white text-2xl font-bold mb-2">¡Confirma tu correo!</h2>
          <p className="text-slate-400 mb-6">
            Hemos enviado un enlace de confirmación a <span className="text-white font-medium">{email}</span>.
            <br />
            Por favor, revisa tu bandeja de entrada para activar tu cuenta.
          </p>
          <Button onClick={() => setRegistrationSuccess(false)}>
            <span>Volver al Inicio</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased min-h-screen flex flex-col">
      {/* Hero / Header Section */}
      <div className="relative w-full h-[35vh] flex flex-col justify-end">
        {/* Background Image with Gradient Overlay */}
        <div
          className="absolute inset-0 z-0 w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDlWIAfz9obc5LHlq9TNtnwGo3_lqjhKDASmoLDzz6zcmAG97RY1fWuKcVuY7fKJu-geSBr6ZFzKeokGjGhGC0ER3l6lRRkwbokSMda5k-ammUOEVzhIpmaRb8bGK8Ls5ldtFftsdn0JkYpice2XdDMRG-l_ueb1-VMT-lsaKr-mFgn2JDJWtM6tF9afDQz5SVqed4iFF_DOGftRS4Nt2q5lKp8JhzzUjISYZb0i8Qmi00CYzEtOiMoR9VNSRD2Ycquvl46ZHXGFWQ')` }}
        ></div>
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#101622]/30 via-[#101622]/60 to-[#101622]"></div>
        {/* Logo/Title Area */}
        <div className="relative z-10 px-6 pb-6 w-full flex flex-col items-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
            <span className="material-symbols-outlined text-white text-4xl">sports_soccer</span>
          </div>
          <h1 className="text-white text-3xl font-bold tracking-tight text-center">LigaControl Admin</h1>
          <p className="text-slate-400 text-sm mt-2 text-center max-w-[250px]">Gestiona equipos, marcadores y estadísticas en tiempo real.</p>
        </div>
      </div>

      {/* Main Content / Form Section */}
      <div className="flex-1 flex flex-col px-6 pt-4 pb-8 w-full max-w-md mx-auto">
        {/* Login Form */}
        <div className="flex flex-col gap-5">
          {/* Headline inside form for context */}
          <div className="mb-2 flex justify-between items-end">
            <div>
              <h2 className="text-white text-xl font-semibold">{isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}</h2>
              <p className="text-slate-400 text-sm">{isSignUp ? 'Regístrate para comenzar' : 'Bienvenido de nuevo'}</p>
            </div>
          </div>

          {errorInfo && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              {errorInfo}
            </div>
          )}

          {/* Email Field */}
          <div className="group">
            <label className="block text-slate-300 text-sm font-medium mb-2 pl-1">Correo Electrónico</label>
            <Input
              icon="mail"
              type="email"
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              placeholder="admin@liga.com"
              className="bg-[#192233] border border-[#324467] text-white"
            />
          </div>
          {/* Password Field */}
          <div className="group">
            <label className="block text-slate-300 text-sm font-medium mb-2 pl-1">Contraseña</label>
            <div className="relative">
              <Input
                icon="lock"
                type="password"
                value={password}
                onChange={(e: any) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-[#192233] border border-[#324467] text-white pr-12"
              />
              <button className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white transition-colors focus:outline-none">
                <span className="material-symbols-outlined">visibility_off</span>
              </button>
            </div>
            {isSignUp && <p className="text-slate-500 text-xs mt-1 ml-1">Mínimo 6 caracteres</p>}
          </div>

          {/* Confirm Password Field (New) */}
          {isSignUp && (
            <div className="group animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-slate-300 text-sm font-medium mb-2 pl-1">Confirmar Contraseña</label>
              <Input
                icon="lock_reset"
                type="password"
                value={confirmPassword}
                onChange={(e: any) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-[#192233] border border-[#324467] text-white"
              />
            </div>
          )}

          {/* Options Row: Remember Me & Forgot Password */}
          {!isSignUp && (
            <div className="flex items-center justify-between mt-1">
              <label className="flex items-center space-x-2 cursor-pointer group">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-[#324467] bg-[#192233] text-primary focus:ring-primary focus:ring-offset-[#101622]"
                />
                <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">Recordarme</span>
              </label>
              <a href="#" className="text-sm font-medium text-primary hover:text-blue-400 transition-colors">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
          )}

          {/* Action Button */}
          <Button className="mt-4" onClick={handleAuth} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Procesando...
              </span>
            ) : (
              <>
                <span>{isSignUp ? 'Registrarse' : 'Acceder al Panel'}</span>
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </>
            )}
          </Button>

          <div className="flex justify-center mt-2">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorInfo(null);
                setConfirmPassword('');
              }}
              className="text-slate-400 text-sm hover:text-white transition-colors"
            >
              {isSignUp ? '¿Ya tienes cuenta? Iniciar Sesión' : '¿No tienes cuenta? Regístrate'}
            </button>
          </div>

          {/* Social Login Section - TEMPORARILY DISABLED
          <div className="relative flex items-center py-4">
            <div className="flex-grow border-t border-[#324467]"></div>
            <span className="flex-shrink-0 mx-4 text-slate-500 text-xs">O continúa con</span>
            <div className="flex-grow border-t border-[#324467]"></div>
          </div>

          <div className="flex gap-4">
            <button className="flex-1 flex items-center justify-center gap-2 bg-[#192233] hover:bg-[#232f48] border border-[#324467] rounded-xl py-3 text-white transition-all hover:scale-[1.02]">
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
              <span className="text-sm font-medium">Google</span>
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 bg-[#192233] hover:bg-[#232f48] border border-[#324467] rounded-xl py-3 text-white transition-all hover:scale-[1.02]">
              <span className="material-symbols-outlined text-[22px]">apple</span>
              <span className="text-sm font-medium">Apple</span>
            </button>
          </div>
          */}
        </div>

        {/* Footer / Help */}
        <div className="mt-auto pt-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <span className="material-symbols-outlined text-lg">shield</span>
            <span>Acceso seguro SSL</span>
          </div>
          <p className="text-slate-600 text-xs text-center">
            Versión 2.4.0 • © 2023 LigaControl Inc.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginScreen;
