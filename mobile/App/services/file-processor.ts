// services/file-processor.ts
import { uploadToCloudinary } from './cloudinary-service';
import * as FileSystem from 'expo-file-system';

export class FileProcessor {
  static async processFileForAI(fileInfo: FileInfo): Promise<ProcessedFile> {
    const { uri, name, type, size } = fileInfo;

    // Strategy 1: Small text files - process locally
    if (type === 'text/plain' && size < 100000) { // 100KB
      return await this.processTextFile(uri, name);
    }

    // Strategy 2: Images - upload to cloudinary + prepare for OCR
    if (type.startsWith('image/')) {
      return await this.processImageFile(uri, name, type);
    }

    // Strategy 3: PDFs & other files - upload + backend processing
    return await this.processDocumentFile(uri, name, type);
  }

  private static async processTextFile(uri: string, name: string): Promise<ProcessedFile> {
    const content = await FileSystem.readAsStringAsync(uri);
    return {
      type: 'text',
      content: content,
      metadata: { fileName: name, size: content.length },
      needsBackendProcessing: false
    };
  }

  private static async processImageFile(uri: string, name: string, type: string): Promise<ProcessedFile> {
    const cloudinaryResult = await uploadToCloudinary(uri, type);
    return {
      type: 'image',
      content: '', // Backend will extract text via OCR
      fileUrl: cloudinaryResult.url,
      metadata: { 
        fileName: name, 
        publicId: cloudinaryResult.publicId,
        mimeType: type 
      },
      needsBackendProcessing: true
    };
  }

  private static async processDocumentFile(uri: string, name: string, type: string): Promise<ProcessedFile> {
    const cloudinaryResult = await uploadToCloudinary(uri, type);
    return {
      type: 'document',
      content: '', // Backend will extract text
      fileUrl: cloudinaryResult.url,
      metadata: { 
        fileName: name, 
        publicId: cloudinaryResult.publicId,
        mimeType: type 
      },
      needsBackendProcessing: true
    };
  }
}

export interface FileInfo {
  uri: string;
  name: string;
  type: string;
  size: number;
}

export interface ProcessedFile {
  type: 'text' | 'image' | 'document';
  content: string;
  fileUrl?: string;
  metadata: any;
  needsBackendProcessing: boolean;
}