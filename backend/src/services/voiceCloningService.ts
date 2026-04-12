import axios from 'axios';
import FormData from 'form-data';
import http from 'http';
import https from 'https';
import { Readable } from 'stream';
import { logger } from '../utils/logger';
import { Upload } from '../resolvers/types/upload';
import { redisClient } from '../lib/redis';

const PYTHON_SERVICE_URL = process.env.PYTHON_FACE_SERVICE_URL || "http://127.0.0.1:8000";

const aiEngineClient = axios.create({
  baseURL: PYTHON_SERVICE_URL,
  httpAgent: new http.Agent({ keepAlive: true, keepAliveMsecs: 30000 }),
  httpsAgent: new https.Agent({ keepAlive: true, keepAliveMsecs: 30000 }),
});

const POLL_INTERVAL_MS = 4000;    // Check every 4 seconds
const POLL_TIMEOUT_MS  = 360000;  // Give up after 6 minutes

/** Drain a Readable stream fully into a Buffer before sending anywhere. */
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

/** Poll the Python /audio/status/:jobId endpoint until it resolves or times out. */
async function pollJobStatus(jobId: string): Promise<any> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
    try {
      const { data } = await aiEngineClient.get(`/audio/status/${jobId}`, { timeout: 10000 });
      if (data.status === 'COMPLETED' || data.status === 'FAILED') {
        return data;
      }
      logger.info(`⏳ [${jobId}] Still ${data.status}...`);
    } catch (pollErr: any) {
      logger.warn(`⚠️ [${jobId}] Poll error: ${pollErr.message}`);
    }
  }
  throw new Error('Voice synthesis timed out. Please try again with shorter text.');
}

export class VoiceCloningService {
  /**
   * Register a voice — enqueue on Python, return jobId immediately,
   * then poll until the job completes or fails.
   */
  async registerVoice(userId: string, referenceAudio: Promise<Upload>) {
    try {
      const { createReadStream, filename, mimetype } = await referenceAudio;
      const audioBuffer = await streamToBuffer(createReadStream());
      logger.info(`🎙️ Registering voice for user ${userId} — ${audioBuffer.byteLength} bytes`);

      if (audioBuffer.byteLength === 0) {
        return { success: false, error: 'Received empty audio file' };
      }

      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('reference_audio', audioBuffer, { filename, contentType: mimetype });

      // Build the webhook URL and pass it to Python
      const WEBHOOK_BASE_URL = process.env.APP_URL || 'http://localhost:4001';
      
      formData.append('webhook_url', `${WEBHOOK_BASE_URL}/api/webhooks/python`);

      // Enqueue — returns instantly with a jobId
      const { data: queued } = await aiEngineClient.post(
        `/audio/register`,
        formData,
        { headers: { ...formData.getHeaders() }, timeout: 30000 }
      );

      if (!queued.jobId) {
        return { success: false, error: queued.error || 'Failed to queue registration' };
      }

      logger.info(`🎙️ Register queued — job ${queued.jobId}. Waiting via Webhook or Polling.`);

      // Poll until done (We still poll on GraphQL, but Python will hit webhook when done)
      // Ideally, GraphQL Subscriptions replaces this poll entirely in the React frontend!
      const result = await pollJobStatus(queued.jobId);
      if (result.status === 'FAILED') {
        return { success: false, error: result.error || 'Voice registration failed' };
      }

      return { success: true, message: result.message || 'Voice registered successfully', jobId: queued.jobId };
    } catch (error: any) {
      logger.error('❌ Voice Registration Failed', {
        message: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        stack: error.stack
      });
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to register voice'
      };
    }
  }

  /**
   * Clone a voice — enqueue on Python and return jobId immediately.
   * The caller should poll getVoiceJobStatus to get the result.
   */
  async cloneVoice(text: string, referenceAudio?: Promise<Upload>, userId?: string) {
    try {
      const formData = new FormData();
      formData.append('text', text);

      const WEBHOOK_BASE_URL = process.env.APP_URL || 'http://localhost:4001';
          
      // Python will append the Job ID when it hits this URL
      formData.append('webhook_url', `${WEBHOOK_BASE_URL}/api/webhooks/python`);

      if (referenceAudio) {
        const { createReadStream, filename, mimetype } = await referenceAudio;
        const audioBuffer = await streamToBuffer(createReadStream());
        formData.append('reference_audio', audioBuffer, { filename, contentType: mimetype });
      } else if (userId) {
        formData.append('user_id', userId);
      } else {
        throw new Error('Either referenceAudio or userId must be provided');
      }

      logger.info(`🎙️ Requesting voice clone job from AI Engine`);

      // Enqueue — returns instantly
      const { data: queued } = await aiEngineClient.post(
        `/audio/clone`,
        formData,
        { headers: { ...formData.getHeaders() }, timeout: 30000 }
      );

      if (!queued.jobId) {
        return { success: false, error: queued.error || 'Failed to queue voice clone' };
      }

      logger.info(`🎙️ Clone queued — job ${queued.jobId}. Python Webhook will receive updates.`);
      return { success: true, jobId: queued.jobId, status: 'PROCESSING' };

    } catch (error: any) {
      logger.error('❌ Voice Clone Enqueue Failed', {
        message: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        stack: error.stack
      });
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to start voice synthesis'
      };
    }
  }

  /** Poll a job by ID — called by the getVoiceJobStatus resolver. */
  async getJobStatus(jobId: string) {
    try {
      // 1. FAST PATH: Check if the Webhook has already populated Redis
      if (redisClient) {
        const cached = await redisClient.get(`JOB_STATUS_${jobId}`);
        if (cached) {
            return JSON.parse(cached);
        }
      }

      // 2. SLOW PATH: Fallback to directly asking Python (if webhook missed or still processing)
      const { data } = await aiEngineClient.get(
        `/audio/status/${jobId}`,
        { timeout: 10000 }
      );
      return data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { status: 'FAILED', success: false, error: 'Job not found or has expired.' };
      }
      logger.error('❌ getJobStatus error', { message: error.message });
      return { status: 'FAILED', success: false, error: 'Could not retrieve job status.' };
    }
  }

  /**
   * Verify a voice — sends audio and challenge code to Python for
   * Speaker Verification + STT anti-replay check.
   */
  async verifyVoice(userId: string, challengeCode: string, audio: Promise<Upload>) {
    try {
      const { createReadStream, filename, mimetype } = await audio;
      const audioBuffer = await streamToBuffer(createReadStream());
      
      logger.info(`🎙️ Verifying voice for user ${userId} with challenge ${challengeCode}`);

      if (audioBuffer.byteLength === 0) {
        return { success: false, error: 'Received empty audio file' };
      }

      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('challenge_code', challengeCode);
      formData.append('file', audioBuffer, { filename, contentType: mimetype });

      const { data } = await aiEngineClient.post(
        `/audio/verify`,
        formData,
        { 
            headers: { ...formData.getHeaders() }, 
            timeout: 60000 // Verification might take longer due to STT
        }
      );

      return {
        success: data.access === 'GRANTED',
        message: data.message,
        similarity: data.similarity,
        error: data.error
      };
    } catch (error: any) {
      logger.error('❌ Voice Verification Request Failed', {
        message: error.message,
        status: error.response?.status,
        responseData: error.response?.data
      });
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Verification service unreachable'
      };
    }
  }
}
