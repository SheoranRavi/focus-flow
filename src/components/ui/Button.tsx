import React from "react";
import { ButtonProps } from "@/types";

const Button: React.FC<ButtonProps> = ({ children, variant: _variant = 'primary', size: _size = 'md', className = '', ...props }) => {
  // TODO: Implement variant and size styling
  const baseClasses = 'px-4 py-2 rounded font-medium transition-colors';
  
  return (
    <button className={`${baseClasses} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
