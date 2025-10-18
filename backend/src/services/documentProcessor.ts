// apps/backend/src/services/documentProcessor.ts - FIXED VERSION
import axios from 'axios';
import pdf from 'pdf-parse';

export class DocumentProcessor {
  async extractTextFromUrl(fileUrl: string, mimeType: string): Promise<string> {
    try {
      // Download file from Cloudinary
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const fileBuffer = Buffer.from(response.data);

      return await this.extractText(fileBuffer, mimeType);
    } catch (error: any) { // FIX: Add type annotation
      console.error('Error downloading file:', error);
      return `[Unable to process file: ${error.message}]`;
    }
  }

  async extractText(fileBuffer: Buffer, mimeType: string): Promise<string> {
    try {
      switch (mimeType) {
        case 'application/pdf':
          return await this.extractFromPDF(fileBuffer);
        case 'text/plain':
          return fileBuffer.toString('utf-8');
        case 'image/jpeg':
        case 'image/png':
          return await this.extractFromImageOCR(fileBuffer);
        default:
          return `[File type: ${mimeType} - Content extraction not fully implemented]`;
      }
    } catch (error: any) { // FIX: Add type annotation
      console.error(`Error extracting text from ${mimeType}:`, error);
      return `[Error processing ${mimeType} file]`;
    }
  }

  private async extractFromPDF(fileBuffer: Buffer): Promise<string> {
    try {
      const data = await pdf(fileBuffer);
      return data.text || '[No text content found in PDF]';
    } catch (error: any) { // FIX: Add type annotation
      console.error('PDF extraction error:', error);
      return '[PDF content extraction failed]';
    }
  }

  private async extractFromImageOCR(_fileBuffer: Buffer): Promise<string> { // FIX: Add underscore to unused parameter
    // For now, return placeholder until you implement OCR
    return '[Image OCR - implement with Tesseract.js for full functionality]';
  }
}