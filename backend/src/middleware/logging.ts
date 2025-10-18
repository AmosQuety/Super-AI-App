// src/middleware/logging.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Comprehensive logging middleware for Express
 * Logs all incoming requests and outgoing responses
 */
export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Log request details
  const requestLog = {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    headers: {
      'user-agent': req.get('User-Agent'),
      'content-type': req.get('Content-Type'),
      authorization: req.get('Authorization') ? '***' : undefined,
    },
    ip: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString(),
  };

  // Don't log sensitive data in production
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Incoming Request', requestLog);
  } else {
    logger.info('Incoming Request', {
      method: requestLog.method,
      url: requestLog.url,
      ip: requestLog.ip,
    });
  }

  // Capture response details
  const originalSend = res.send;
  let responseBody: any;

  res.send = function(body: any): Response {
    responseBody = body;
    return originalSend.call(this, body);
  };

  // Log when response is finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const responseLog = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      contentType: res.get('Content-Type'),
      timestamp: new Date().toISOString(),
    };

    // Log based on status code
    if (res.statusCode >= 400) {
      logger.warn('HTTP Response Error', {
        ...responseLog,
        ...(process.env.NODE_ENV === 'development' && { responseBody }),
      });
    } else {
      logger.info('HTTP Response', responseLog);
    }

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow Request Detected', {
        ...responseLog,
        duration: `${duration}ms`,
        threshold: '1000ms',
      });
    }
  });

  // Log request errors
  res.on('error', (error) => {
    logger.error('Response Error', {
      method: req.method,
      url: req.url,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  });

  next();
};

/**
 * GraphQL-specific logging middleware
 * Logs GraphQL operations and their execution time
 */
export const graphQLLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/graphql' && req.body && req.body.operationName) {
    const start = Date.now();
    const originalSend = res.send;

    res.send = function(body: any): Response {
      const duration = Date.now() - start;
      
      const graphQLLog = {
        type: 'GraphQL',
        operationName: req.body.operationName || 'Anonymous',
        query: process.env.NODE_ENV === 'development' ? req.body.query : undefined,
        variables: process.env.NODE_ENV === 'development' ? req.body.variables : undefined,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString(),
      };

      // Log slow GraphQL queries
      if (duration > 2000) {
        logger.warn('Slow GraphQL Query', graphQLLog);
      } else if (duration > 500) {
        logger.info('GraphQL Query', graphQLLog);
      } else {
        logger.debug('GraphQL Query', graphQLLog);
      }

      return originalSend.call(this, body);
    };
  }

  next();
};

/**
 * Error logging middleware
 * Catches and logs unhandled errors
 */
export const errorLoggingMiddleware = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errorLog = {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    method: req.method,
    url: req.url,
    ip: req.ip,
    body: process.env.NODE_ENV === 'development' ? req.body : undefined,
    query: process.env.NODE_ENV === 'development' ? req.query : undefined,
    timestamp: new Date().toISOString(),
  };

  logger.error('Unhandled Error', errorLog);

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Something went wrong',
    });
  } else {
    next(error);
  }
};

/**
 * Security event logging
 * Logs potential security-related events
 */
export const securityLoggingMiddleware = (req: Request, _: Response, next: NextFunction) => {
  // Log potential security issues
  const securityIndicators = {
    sqlInjection: hasSqlInjectionIndicators(req),
    xss: hasXSSIndicators(req),
    pathTraversal: hasPathTraversalIndicators(req),
  };

  if (Object.values(securityIndicators).some(Boolean)) {
    logger.warn('Security Event Detected', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      indicators: securityIndicators,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

// Helper functions for security detection
function hasSqlInjectionIndicators(req: Request): boolean {
  const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'UNION', 'OR 1=1'];
  const searchString = JSON.stringify({ ...req.query, ...req.body }).toUpperCase();
  return sqlKeywords.some(keyword => searchString.includes(keyword));
}

function hasXSSIndicators(req: Request): boolean {
  const xssPatterns = ['<script>', 'javascript:', 'onload=', 'onerror='];
  const searchString = JSON.stringify({ ...req.query, ...req.body });
  return xssPatterns.some(pattern => searchString.includes(pattern));
}

function hasPathTraversalIndicators(req: Request): boolean {
  const traversalPatterns = ['../', '..\\', '/etc/passwd', 'C:\\'];
  const searchString = JSON.stringify({ ...req.query, ...req.body, url: req.url });
  return traversalPatterns.some(pattern => searchString.includes(pattern));
}

/**
 * Performance monitoring middleware
 * Logs performance metrics for monitoring
 */
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime();
  const startMemory = process.memoryUsage();

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds * 1000 + nanoseconds / 1000000;
    const endMemory = process.memoryUsage();

    const performanceLog = {
      method: req.method,
      url: req.url,
      duration: `${duration.toFixed(2)}ms`,
      memory: {
        rss: `${((endMemory.rss - startMemory.rss) / 1024 / 1024).toFixed(2)}MB`,
        heapUsed: `${((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024).toFixed(2)}MB`,
      },
      timestamp: new Date().toISOString(),
    };

    // Log performance metrics for analysis
    logger.debug('Performance Metrics', performanceLog);
  });

  next();
};

export default {
  loggingMiddleware,
  graphQLLoggingMiddleware,
  errorLoggingMiddleware,
  securityLoggingMiddleware,
  performanceMiddleware,
};