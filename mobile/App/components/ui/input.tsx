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
          'rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white',
          error && 'border-red-500'
        )}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
      />
      {error && <Text className="mt-1 text-sm text-red-500">{error}</Text>}
    </View>
  );
}
