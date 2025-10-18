import React from 'react';
import { StyleSheet } from 'react-native';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';

export const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={[styles.success, styles.base]}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.text1}
      text2Style={styles.text2}
      text1NumberOfLines={1}
      text2NumberOfLines={2}
    />
  ),
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={[styles.error, styles.base]}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.text1}
      text2Style={styles.text2}
      text1NumberOfLines={1}
      text2NumberOfLines={2}
    />
  ),
  info: (props: any) => (
    <BaseToast
      {...props}
      style={[styles.info, styles.base]}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.text1}
      text2Style={styles.text2}
      text1NumberOfLines={1}
      text2NumberOfLines={2}
    />
  ),
};

const styles = StyleSheet.create({
  base: {
    borderLeftWidth: 0,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  success: {
    backgroundColor: '#10b981',
  },
  error: {
    backgroundColor: '#ef4444',
  },
  info: {
    backgroundColor: '#3b82f6',
  },
  contentContainer: {
    paddingHorizontal: 15,
  },
  text1: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  text2: {
    fontSize: 12,
    color: '#f8fafc',
  },
});

export function AppToast() {
  return <Toast config={toastConfig} />;
}

// Hook for easy toast usage
export function useToast() {
  const showToast = (type: 'success' | 'error' | 'info', text1: string, text2?: string) => {
    Toast.show({
      type,
      text1,
      text2,
      position: 'bottom',
      visibilityTime: 4000,
    });
  };

  return {
    showSuccess: (message: string, description?: string) => 
      showToast('success', message, description),
    showError: (message: string, description?: string) => 
      showToast('error', message, description),
    showInfo: (message: string, description?: string) => 
      showToast('info', message, description),
  };
}