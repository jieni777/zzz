import React, { ReactNode } from 'react';

interface GlassContainerProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const GlassContainer: React.FC<GlassContainerProps> = ({ children, className = '', onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`
        backdrop-blur-xl 
        bg-duck-glass 
        border border-duck-glassBorder 
        rounded-2xl 
        shadow-lg 
        transition-all duration-300
        ${onClick ? 'cursor-pointer active:scale-95' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};