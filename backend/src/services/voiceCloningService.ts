import axios from 'axios';
import FormData from 'form-data';
import { logger } from '../utils/logger';
import { Upload } from '../resolvers/types/upload';

const PYTHON_SERVICE_URL = process.env.PYTHON_FACE_SERVICE_URL || "http://127.0.0.1:8000";

export class VoiceCloningService {
  /**
   * Register a voice by extracting and storing embeddings in the Python server
   */
  async registerVoice(userId: string, referenceAudio: Promise<Upload>) {
    try {
      const { createReadStream, filename, mimetype } = await referenceAudio;
      const stream = createReadStream();

      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('reference_audio', stream, { filename, contentType: mimetype });

      logger.info(`🎙️ Registering voice for user ${userId}...`);

      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/audio/register`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          timeout: 60000, 
        }
      );

      return response.data;

    } catch (error: any) {
      logger.error('❌ Voice Registration Failed', { error: error.response?.data || error.message });
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to register voice'
      };
    }
  }

  /**
   * Clone a voice using XTTS v2 on the Python server
   */
  async cloneVoice(text: string, referenceAudio?: Promise<Upload>, userId?: string) {
    try {
      const formData = new FormData();
      formData.append('text', text);

      if (referenceAudio) {
        const { createReadStream, filename, mimetype } = await referenceAudio;
        formData.append('reference_audio', createReadStream(), { filename, contentType: mimetype });
      } else if (userId) {
        formData.append('user_id', userId);
      } else {
        throw new Error('Either referenceAudio or userId must be provided');
      }

      logger.info(`🎙️ Requesting voice clone from AI Engine: ${text.substring(0, 30)}...`);

      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/audio/clone`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          responseType: 'arraybuffer',
          timeout: 120000, // 2 minutes for XTTS generation
        }
      );

      // Return the buffer
      return {
        success: true,
        data: Buffer.from(response.data),
        contentType: 'audio/wav'
      };

    } catch (error: any) {
      logger.error('❌ Voice Cloning Failed', { error: error.response?.data || error.message });
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to clone voice'
      };
    }
  }
}
