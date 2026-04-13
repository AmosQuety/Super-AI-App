// src/services/documentProcessor.ts
import axios from 'axios';
import mammoth from 'mammoth';
import { logger } from '../utils/logger';

// 1. Use the new library
const pdf = require('pdf-extraction');

const DEFAULT_CHUNK_SIZE_CHARS = 2000; // ~500 tokens in typical English text
const DEFAULT_CHUNK_OVERLAP_CHARS = 400; // ~100 tokens overlap for continuity

export class DocumentProcessor {
  
  chunkText(
    text: string,
    chunkSize: number = DEFAULT_CHUNK_SIZE_CHARS,
    overlapSize: number = DEFAULT_CHUNK_OVERLAP_CHARS,
  ): string[] {
    const normalizedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalizedText) {
      return [];
    }

    const words = normalizedText.split(' ').filter(Boolean);
    if (words.length === 0) {
      return [];
    }

    const chunks: string[] = [];
    let currentWords: string[] = [];

    const pushCurrentChunk = () => {
      const chunk = currentWords.join(' ').trim();
      if (chunk) {
        chunks.push(chunk);
      }
    };

    const buildOverlap = (chunk: string): string => {
      if (!overlapSize || chunk.length <= overlapSize) {
        return chunk.trim();
      }

      const chunkWords = chunk.split(' ').filter(Boolean);
      const overlapWords: string[] = [];

      for (let i = chunkWords.length - 1; i >= 0; i--) {
        const candidate = [chunkWords[i], ...overlapWords].join(' ').trim();
        if (candidate.length > overlapSize && overlapWords.length > 0) {
          break;
        }

        overlapWords.unshift(chunkWords[i]);

        if (candidate.length >= overlapSize) {
          break;
        }
      }

      return overlapWords.join(' ').trim();
    };

    for (const word of words) {
      if (word.length > chunkSize) {
        const longWordChunks = word.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || [];
        for (const longChunk of longWordChunks) {
          if (currentWords.length > 0) {
            pushCurrentChunk();
            currentWords = [];
          }

          if (longChunk.trim()) {
            chunks.push(longChunk.trim());
          }
        }
        continue;
      }

      const candidate = [...currentWords, word].join(' ').trim();

      if (candidate.length <= chunkSize) {
        currentWords.push(word);
        continue;
      }

      pushCurrentChunk();
      const overlap = buildOverlap(chunks[chunks.length - 1] || '');
      currentWords = overlap ? overlap.split(' ') : [];

      const retryCandidate = [...currentWords, word].join(' ').trim();
      if (retryCandidate.length <= chunkSize) {
        currentWords.push(word);
      } else {
        // If overlap still leaves the chunk too large, start a fresh chunk with the word.
        currentWords = [word];
      }
    }

    pushCurrentChunk();

    return chunks.filter((chunk) => chunk.trim().length > 0);
  }

  async extractTextFromUrl(fileUrl: string, mimeType: string): Promise<string> {
    try {
      logger.debug('[document] downloading file for extraction');
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const fileBuffer = Buffer.from(response.data);

      return await this.extractText(fileBuffer, mimeType);
    } catch (error: any) {
      logger.error('[document] download failed', { message: error.message });
      throw new Error(`Unable to download file for extraction: ${error.message}`);
    }
  }

  async extractText(fileBuffer: Buffer, mimeType: string): Promise<string> {
    try {
      if (mimeType === 'application/pdf') {
        logger.debug('[document] processing pdf');
        
        // pdf-extraction takes the buffer directly
        const data = await pdf(fileBuffer);
        
        const cleanText = data.text
            .replace(/\n\s*\n/g, '\n') // Remove multiple empty lines
            .trim();
            
        logger.debug('[document] pdf extracted');
        return cleanText;
      }
      // DOCX — Office Open XML (most common modern Word format)
      else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        logger.debug('[document] processing docx');
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        const cleanText = result.value.replace(/\n\s*\n/g, '\n').trim();
        logger.debug('[document] docx extracted');
        return cleanText;
      }
      // DOC — Legacy binary Word format (mammoth handles this too)
      else if (mimeType === 'application/msword') {
        logger.debug('[document] processing legacy doc');
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        const cleanText = result.value.replace(/\n\s*\n/g, '\n').trim();
        logger.debug('[document] doc extracted');
        return cleanText;
      }
      else if (mimeType.startsWith('text/')) {
        return fileBuffer.toString('utf-8');
      }
      
      logger.warn('[document] unsupported file type', { mimeType });
      return "";
    } catch (error: any) {
      logger.error('[document] extraction failed', error);
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }
}