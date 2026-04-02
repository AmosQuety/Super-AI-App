import express from 'express';
import { logger } from '../utils/logger';
import { redisClient } from '../lib/redis';

export const webhookRouter = express.Router();

/**
 * Endpoint for Python AI Engine to hit once it finishes generating a Voice Clone.
 * Webhook URL: /api/webhooks/python/:jobId
 */
webhookRouter.post('/python/:jobId', express.json(), async (req, res) => {
    const { jobId } = req.params;
    const { status, audioUrl, error, result } = req.body;
    
    logger.info(`🔔 [Webhook] Received Python Callback for Job ${jobId} -> Status: ${status}`);

    try {
        if (redisClient) {
            // Cache the job status in Redis for 1 hour
            await redisClient.setex(`JOB_STATUS_${jobId}`, 3600, JSON.stringify(req.body));
        }

        // Return 200 OK fast so Python doesn't hang
        res.status(200).json({ success: true, received: true });
    } catch (err: any) {
        logger.error(`❌ [Webhook] Processing failed for ${jobId}`, err);
        res.status(500).json({ success: false });
    }
});
