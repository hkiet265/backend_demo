import React from 'react';
import './Button.css';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  ...props 
}) => {
  const btnClass = `btn btn-${variant} btn-${size} ${className}`.trim();
  
  return (
    <button
      type={type}
      className={btnClass}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
