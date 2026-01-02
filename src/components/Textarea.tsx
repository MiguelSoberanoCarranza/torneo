import React from 'react';

const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
  return (
    <textarea
      className="w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-white rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-primary min-h-[100px] p-4 placeholder:text-gray-400 dark:placeholder:text-gray-600 resize-none transition-shadow"
      {...props}
    ></textarea>
  );
};

export default Textarea;
