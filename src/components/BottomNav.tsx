import React from 'react';
import { NavLink } from 'react-router-dom';

const BottomNav: React.FC = () => {
  const navItems = [
    { name: 'Inicio', icon: 'home', path: '/' },
    { name: 'Tabla', icon: 'table_chart', path: '/league-table' },
    { name: 'Calendario', icon: 'calendar_month', path: '/calendar' },
    { name: 'Menú', icon: 'menu', path: '/directory' },
  ];

  return (
    <nav className="fixed bottom-0 w-full bg-white dark:bg-surface-dark border-t border-slate-200 dark:border-slate-800 pt-2 pb-6 px-6 flex justify-between items-center z-40">
      {navItems.map((item) => (
        <NavLink
          key={item.name}
          to={item.path}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 w-12 group transition-colors ${isActive
              ? 'text-primary'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`material-symbols-outlined text-2xl transition-transform ${isActive ? 'filled scale-110' : ''
                  }`}
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              <span className="text-[10px] font-medium">{item.name}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
