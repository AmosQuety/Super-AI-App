// components/file-picker.tsx
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export const useFilePicker = () => {
  const pickFile = async (): Promise<FileInfo | null> => {
    // Let user choose between camera, gallery, or documents
    const options = ['Camera', 'Gallery', 'Documents', 'Cancel'];
    
    // You can use ActionSheet or custom modal here
    const choice = await showActionSheet(options);
    
    switch (choice) {
      case 'Camera':
        return await pickFromCamera();
      case 'Gallery':
        return await pickFromGallery();
      case 'Documents':
        return await pickDocument();
      default:
        return null;
    }
  };

  const pickFromCamera = async (): Promise<FileInfo | null> => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      return {
        uri: result.assets[0].uri,
        name: `photo_${Date.now()}.jpg`,
        type: 'image/jpeg',
        size: 0 // You might need to get file size
      };
    }
    return null;
  };

  const pickDocument = async (): Promise<FileInfo | null> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'image/*',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      return {
        uri: result.assets[0].uri,
        name: result.assets[0].name!,
        type: result.assets[0].mimeType!,
        size: result.assets[0].size || 0
      };
    }
    return null;
  };

  return { pickFile };
};