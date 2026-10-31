import React from 'react';
import { View } from 'react-native';
import { cn } from '../../utils/formatters';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <View
      className={cn(
        'rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800',
        className
      )}>
      {children}
    </View>
  );
}
