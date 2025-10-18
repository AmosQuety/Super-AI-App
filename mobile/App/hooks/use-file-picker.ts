// hooks/use-file-picker.ts
import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export interface FileInfo {
  uri: string;
  name: string;
  type: string;
  size: number;
}

export const useFilePicker = () => {
  const [isPicking, setIsPicking] = useState(false);

  const pickFile = async (): Promise<FileInfo | null> => {
    if (isPicking) return null;
    
    setIsPicking(true);
    try {
      // For simplicity, we'll use document picker for all files
      // You can enhance this with ActionSheet for camera/gallery later
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'image/*',
          'application/pdf',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        return {
          uri: asset.uri,
          name: asset.name || 'unknown',
          type: asset.mimeType || 'application/octet-stream',
          size: asset.size || 0,
        };
      }
      return null;
    } catch (error) {
      console.error('File picker error:', error);
      Alert.alert('Error', 'Failed to pick file');
      return null;
    } finally {
      setIsPicking(false);
    }
  };

  return { pickFile, isPicking };
};