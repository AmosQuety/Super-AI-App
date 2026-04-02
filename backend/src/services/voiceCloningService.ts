import axios from 'axios';
import FormData from 'form-data';
import { Readable } from 'stream';
import { logger } from '../utils/logger';
import { Upload } from '../resolvers/types/upload';

const PYTHON_SERVICE_URL = process.env.PYTHON_FACE_SERVICE_URL || "http://127.0.0.1:8000";

/** Drain a Readable stream fully into a Buffer before sending anywhere.
 *  This prevents the fs-capacitor temp stream from being GC'd / closed
 *  mid-transfer, which causes Python to see a premature EOF. */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export class VoiceCloningService {
  /**
   * Register a voice by extracting and storing embeddings in the Python server.
   * We buffer the upload fully before forwarding so the fs-capacitor stream
   * cannot be garbage-collected while Python is still reading.
   */
  async registerVoice(userId: string, referenceAudio: Promise<Upload>) {
    try {
      const { createReadStream, filename, mimetype } = await referenceAudio;

      // Fully drain upload into memory — prevents premature EOF on Python side
      const audioBuffer = await streamToBuffer(createReadStream());
      logger.info(`🎙️ Registering voice for user ${userId} — audio buffer: ${audioBuffer.byteLength} bytes, file: ${filename}, mime: ${mimetype}`);

      if (audioBuffer.byteLength === 0) {
        return { success: false, error: 'Received empty audio file' };
      }

      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('reference_audio', audioBuffer, { filename, contentType: mimetype });

      logger.info(`🎙️ [AXIOS] OUTGOING POST to ${PYTHON_SERVICE_URL}/audio/register`);
      logger.info(`🎙️ [AXIOS] Headers Boundary: ${formData.getBoundary()}`);

      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/audio/register`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          timeout: 120000,
        }
      );

      return response.data;

    } catch (error: any) {
      logger.error('❌ Voice Registration Failed', { 
        message: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        responseHeaders: error.response?.headers,
        stack: error.stack
      });
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to register voice'
      };
    }
  }

  /**
   * Clone a voice using XTTS v2 on the Python server.
   */
  async cloneVoice(text: string, referenceAudio?: Promise<Upload>, userId?: string) {
    try {
      const formData = new FormData();
      formData.append('text', text);

      if (referenceAudio) {
        const { createReadStream, filename, mimetype } = await referenceAudio;
        // Buffer here too for consistency
        const audioBuffer = await streamToBuffer(createReadStream());
        logger.info(`🎙️ Clone: audio buffer ${audioBuffer.byteLength} bytes, file: ${filename}`);
        formData.append('reference_audio', audioBuffer, { filename, contentType: mimetype });
      } else if (userId) {
        formData.append('user_id', userId);
      } else {
        throw new Error('Either referenceAudio or userId must be provided');
      }

      logger.info(`🎙️ Requesting voice clone from AI Engine: ${text.substring(0, 30)}...`);
      logger.info(`🎙️ [AXIOS] OUTGOING POST to ${PYTHON_SERVICE_URL}/audio/clone`);

      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/audio/clone`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          responseType: 'arraybuffer',
          timeout: 120000,
        }
      );

      return {
        success: true,
        data: Buffer.from(response.data),
        contentType: 'audio/wav'
      };

    } catch (error: any) {
      logger.error('❌ Voice Cloning Failed', { 
        message: error.message,
        status: error.response?.status,
        responseData: error.response?.data ? (Buffer.isBuffer(error.response.data) ? error.response.data.toString('utf-8') : error.response.data) : null,
        responseHeaders: error.response?.headers,
        stack: error.stack
      });
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to clone voice'
      };
    }
  }
}
