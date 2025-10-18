import React from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  TouchableOpacityProps
} from 'react-native';
import { cn } from '../../libs/utils';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'default' | 'destructive' | 'outline';
  loading?: boolean;
}

export const Button = React.forwardRef<TouchableOpacity, ButtonProps>(
  ({ title, variant = 'default', loading, className, disabled, ...props }, ref) => {
    const baseClasses = 'px-4 py-3 rounded-lg flex-row items-center justify-center';
    
    const variantClasses = {
      default: 'bg-blue-500 active:bg-blue-600',
      destructive: 'bg-red-500 active:bg-red-600',
      outline: 'border border-gray-300 bg-transparent active:bg-gray-100',
    };

    const textClasses = {
      default: 'text-white',
      destructive: 'text-white',
      outline: 'text-gray-700',
    };

    return (
      <TouchableOpacity
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          disabled && 'opacity-50',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <ActivityIndicator 
            size="small" 
            color={variant === 'outline' ? '#374151' : '#ffffff'} 
            className="mr-2" 
          />
        )}
        <Text className={cn('font-semibold text-base', textClasses[variant])}>
          {title}
        </Text>
      </TouchableOpacity>
    );
  }
);

Button.displayName = 'Button';