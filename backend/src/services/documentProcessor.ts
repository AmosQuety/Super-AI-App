// src/services/documentProcessor.ts
import axios from 'axios';

// 1. Use the new library
const pdf = require('pdf-extraction');

export class DocumentProcessor {
  
  chunkText(text: string, chunkSize: number = 1000): string[] {
    const chunks: string[] = [];
    let currentChunk = "";
    const sentences = text.split(/([.?!])\s+/);

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > chunkSize) {
        chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    }
    if (currentChunk) chunks.push(currentChunk);
    
    return chunks;
  }

  async extractTextFromUrl(fileUrl: string, mimeType: string): Promise<string> {
    try {
      console.log(`📥 Downloading file for extraction: ${fileUrl}`);
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const fileBuffer = Buffer.from(response.data);

      return await this.extractText(fileBuffer, mimeType);
    } catch (error: any) {
      console.error('Error downloading file:', error.message);
      return `[Unable to process file: ${error.message}]`;
    }
  }

  async extractText(fileBuffer: Buffer, mimeType: string): Promise<string> {
    try {
      if (mimeType === 'application/pdf') {
        console.log("📄 Processing PDF with pdf-extraction...");
        
        // pdf-extraction takes the buffer directly
        const data = await pdf(fileBuffer);
        
        const cleanText = data.text
            .replace(/\n\s*\n/g, '\n') // Remove multiple empty lines
            .trim();
            
        console.log(`✅ PDF Extracted: ${cleanText.length} characters`);
        return cleanText;
      } 
      else if (mimeType.startsWith('text/')) {
        return fileBuffer.toString('utf-8');
      }
      
      console.warn(`⚠️ Unsupported File Type: ${mimeType}`);
      return "";
    } catch (error: any) {
      console.error("Extraction Error:", error);
      // Log the full error to help debug if it fails again
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }
}