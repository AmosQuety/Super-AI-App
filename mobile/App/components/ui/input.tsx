import React from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';
import { cn } from '../../utils/formatters';

interface InputProps extends Omit<TextInputProps, 'className' | 'style'> {
  error?: string;
  // Applied to the wrapper around the text field and its error message.
  className?: string;
}

// Every TextInput prop (keyboardType, autoCapitalize, autoCorrect, onBlur, ...) reaches the
// field; the screens rely on them, for example the email keyboard on sign-in.
export function Input({ error, className = '', ...textInputProps }: InputProps) {
  return (
    <View className={className}>
      <TextInput
        className={cn(
          'rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white',
          error && 'border-red-500'
        )}
        placeholderTextColor="#9CA3AF"
        {...textInputProps}
      />
      {error && <Text className="mt-1 text-sm text-red-500">{error}</Text>}
    </View>
  );
}
