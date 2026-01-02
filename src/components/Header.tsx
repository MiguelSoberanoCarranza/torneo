import React from 'react';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ title, onBack, rightAction }) => {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      {onBack ? (
        <button
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-full active:bg-gray-200 dark:active:bg-gray-800 transition-colors text-slate-900 dark:text-white"
        >
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
      ) : (
        <div className="w-10"></div> // Spacer
      )}
      <h1 className="text-lg font-bold tracking-tight">{title}</h1>
      {rightAction ? <div className="w-10">{rightAction}</div> : <div className="w-10"></div>}
    </div>
  );
};

export default Header;
