import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({ icon, className, ...props }) => {
  const baseClasses = `w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-white rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-primary h-12 transition-shadow ${icon ? 'pl-10' : 'pl-4'} pr-4 placeholder:text-gray-400 dark:placeholder:text-gray-600`;

  return (
    <div className="relative">
      {icon && <span className="material-symbols-outlined absolute left-3 top-3 text-gray-400">{icon}</span>}
      <input
        className={`${baseClasses} ${className}`}
        {...props}
      />
    </div>
  );
};

export default Input;
