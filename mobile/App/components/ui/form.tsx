import React from 'react';
import { Controller } from 'react-hook-form';
import { Text, TextInputProps, View } from 'react-native';
import { Input } from './input';

interface FormFieldProps extends TextInputProps {
  control: any;
  name: string;
  label?: string;
  rules?: any;
}


export function FormField({ control, name, label, rules, className, ...props }: FormFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View className="mb-4">
          {label && (
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {label}
            </Text>
          )}
          <Input
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            hasError={!!error}
            className={className}
            {...props}
          />
          {error && (
            <Text className="text-red-500 text-xs mt-1">{error.message}</Text>
          )}
        </View>
      )}
    />
  );
}

interface FormProps {
  children: React.ReactNode;
}

export function Form({ children }: FormProps) {
  return <View className="w-full">{children}</View>;
}