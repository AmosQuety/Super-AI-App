import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { cn } from '../../utils/formatters';

interface InputProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  secureTextEntry?: boolean;
  error?: string;
  className?: string;
}

export function Input({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  error,
  className = '',
}: InputProps) {
  return (
    <View className={className}>
      <TextInput
        className={cn(
          'border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white bg-white dark:bg-gray-800',
          error && 'border-red-500'
        )}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
      />
      {error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
    </View>
  );
}