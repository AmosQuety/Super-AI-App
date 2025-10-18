import * as LucideIcons from 'lucide-react-native';
import React from 'react';
import { useThemeColor } from '../../hooks/use-theme';

interface IconProps {
  name: keyof typeof LucideIcons;
  size?: number;
  color?: string;
  className?: string;
}

export function Icon({ name, size = 24, color, className = '' }: IconProps) {
  const defaultColor = useThemeColor({}, 'text');
  const IconComponent = LucideIcons[name] as React.ComponentType<any>;
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in lucide-react-native`);
    return null;
  }

  return (
    <IconComponent
      size={size}
      color={color || defaultColor}
      className={className}
    />
  );
}