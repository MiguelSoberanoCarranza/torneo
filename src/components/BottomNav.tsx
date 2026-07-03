import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const BottomNav: React.FC = () => {
  const [role, setRole] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        setRole(profile?.role || 'user');
      } else {
        setRole(null);
      }
    };

    fetchRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchRole();
      } else if (event === 'SIGNED_OUT') {
        setRole(null);
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin-login');
  };

  // Items del BottomNav - solo si está autenticado
  if (!user) return null;

  const displayItems = [
    { name: 'Inicio', icon: 'home', path: '/' },
  ];

  // Torneos solo para admins
  if (role && ['admin', 'superadmin'].includes(role)) {
    displayItems.push({ name: 'Torneos', icon: 'emoji_events', path: '/tournaments' });
  }

  // Calendario para admin / referee
  if (role && ['admin', 'superadmin', 'referee'].includes(role)) {
    displayItems.push({ name: 'Calendario', icon: 'calendar_month', path: '/calendar' });
  }

  // Mi Equipo solo para captain
  if (role === 'captain') {
    displayItems.push({ name: 'Mi Equipo', icon: 'groups', path: '/my-team' });
  }

  return (
    <div className="fixed bottom-6 left-0 w-full flex justify-center z-40 pointer-events-none px-4">
      <nav className="pointer-events-auto bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-full px-2 py-2 shadow-2xl shadow-slate-200/50 dark:shadow-black/50 flex items-center gap-1 transition-all duration-300 ease-out hover:scale-[1.02]">
        {displayItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-300 ${isActive
                ? 'bg-primary/10 text-primary scale-105'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`material-symbols-outlined text-2xl transition-all duration-300 ${isActive ? '-translate-y-1' : ''
                    }`}
                  style={isActive ? { fontVariationSettings: "'FILL' 1, 'wght' 600" } : { fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                >
                  {item.icon}
                </span>
                <span
                  className={`text-[9px] font-bold absolute bottom-1.5 transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                    }`}
                >
                  {item.name}
                </span>
              </>
            )}
          </NavLink>
        ))}

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="relative flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-300 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          title="Cerrar sesión"
        >
          <span className="material-symbols-outlined text-2xl">logout</span>
          <span className="text-[9px] font-bold absolute bottom-1.5 opacity-0">Salir</span>
        </button>
      </nav>
    </div>
  );
};

export default BottomNav;
