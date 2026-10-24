import express from 'express';
import { logger } from '../utils/logger';
import { redisClient } from '../lib/redis';
import { isValidWebhookSecret } from '../auth/webhookAuth';

export const webhookRouter = express.Router();

const JOB_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// The engine proves who it is with a shared secret, sent as a header or in the
// callback URL's query string (see webhookCallbackUrl).
const requireWebhookSecret: express.RequestHandler = (req, res, next) => {
    const provided = req.get('x-webhook-secret') ?? req.query.secret;
    if (!isValidWebhookSecret(provided)) {
        logger.warn('[Webhook] Rejected a callback without a valid secret', { path: req.path });
        res.status(401).json({ success: false });
        return;
    }
    next();
};

/**
 * Endpoint for Python AI Engine to hit once it finishes generating a Voice Clone.
 * Webhook URL: /api/webhooks/python/:jobId
 */
webhookRouter.post('/python/:jobId?', requireWebhookSecret, express.json(), async (req, res) => {
    const jobId = req.params.jobId || req.body.jobId;
    if (typeof jobId !== 'string' || !JOB_ID_PATTERN.test(jobId)) {
        res.status(400).json({ success: false, error: 'Invalid job id' });
        return;
    }

    const { success, status, message, audioUrl, error, result } = req.body;
    logger.info(`🔔 [Webhook] Received Python Callback for Job ${jobId} -> Status: ${status}`);

    try {
        if (redisClient) {
            // Keep only the fields getJobStatus and its resolver read; cache for 1 hour
            const record = { jobId, success, status, message, audioUrl, error, result };
            await redisClient.setex(`JOB_STATUS_${jobId}`, 3600, JSON.stringify(record));
        }

        // Return 200 OK fast so Python doesn't hang
        res.status(200).json({ success: true, received: true });
    } catch (err: any) {
        logger.error(`❌ [Webhook] Processing failed for ${jobId}`, err);
        res.status(500).json({ success: false });
    }
});
