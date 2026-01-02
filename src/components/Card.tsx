import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div
      className={`bg-surface-light dark:bg-surface-dark rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 ${className}`}
    >
      {children}
    </div>
  );
};

export default Card;
