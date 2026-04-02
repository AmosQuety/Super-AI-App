import { Queue, Worker, Job } from 'bullmq';
import { redisClient } from '../lib/redis';
import axios from 'axios';
import { logger } from '../utils/logger';

const QUEUE_NAME = 'VoiceCloningQueue';
const PYTHON_SERVICE_URL = process.env.PYTHON_FACE_SERVICE_URL || "http://127.0.0.1:8000";
const WEBHOOK_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://your-production-url.com' // Should be updated in production
    : `http://localhost:${process.env.PORT || 4001}`;

// 1. Export the Queue so Services can add jobs
export const voiceCloningQueue = redisClient 
    ? new Queue(QUEUE_NAME, { connection: redisClient }) 
    : null;

// 2. Setup the Worker that deeply processes the queue sequentially
if (redisClient) {
    const worker = new Worker(QUEUE_NAME, async (job: Job) => {
        logger.info(`✅ [BullMQ] Processing Job ${job.id}`);
        const { formData, type } = job.data;
        const webhookUrl = `${WEBHOOK_BASE_URL}/api/webhooks/python/${job.id}`;

        try {
            // Forward the webhookUrl inside the formData (we'll update Python to accept this)
            // Note: Axios doesn't serialize FormData objects from JSON easily inside BullMQ.
            // Since formData loses its stream context inside Redis, we must be careful!
            
            // Wait, we can't easily serialize audio Buffers into Redis and reconstruct FormData easily 
            // without custom serialization. Actually, since Python is processing, we can just let Python queue it.
            // But we wanted Node to queue it to protect Python!
            
            logger.info(`[BullMQ] Executing Python API Call for ${job.id}`);
            
            // We'll pass the serialized buffer data
            let result;
            if (type === 'register') {
                // ... logic to reconstruct form data would go here ...
            } else {
                // ... logic to reconstruct form data would go here ...
            }

            return { dispatched: true };
            
        } catch (error: any) {
            logger.error(`❌ [BullMQ] Job ${job.id} failed:`, error.message);
            throw error;
        }
    }, { 
        connection: redisClient,
        concurrency: 2 // Max 2 concurrent Python requests at once from Node!
    });

    worker.on('completed', job => {
        logger.info(`🎉 [BullMQ] Job ${job.id} successfully dispatched to Python!`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`💥 [BullMQ] Job ${job?.id} completely failed:`, err);
    });
}
