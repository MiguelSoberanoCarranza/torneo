import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ children, className, ...props }) => {
  return (
    <button
      className={`bg-primary hover:bg-primary/90 active:scale-[0.98] text-white font-bold text-lg h-14 rounded-2xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
