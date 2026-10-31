import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

export const asyncContext = new AsyncLocalStorage<Map<string, string>>();

const latencyWindow: Record<string, number[]> = {};

export const recordLatency = (operationName: string, durationMs: number) => {
  if (!latencyWindow[operationName]) latencyWindow[operationName] = [];
  latencyWindow[operationName].push(durationMs);
  
  if (latencyWindow[operationName].length > 100) {
     latencyWindow[operationName].shift();
  }
};

export const getP95Latency = (operationName: string): number | null => {
   const samples = latencyWindow[operationName];
   if (!samples || samples.length === 0) return null;
   
   const sorted = [...samples].sort((a, b) => a - b);
   const index = Math.floor(sorted.length * 0.95);
   return sorted[index];
};

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  // Production keeps warnings and errors: enough to see what went wrong without logging every request.
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: logFormat,
  defaultMeta: { 
    service: 'backend-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
    ] : [
      // Standard output is what a host such as Render shows in its Logs page and serves through its
      // logs API; the files below live on a disk that is wiped on every deploy and restart.
      // process.stdout is written directly because quietConsole silences console.* in production.
      new winston.transports.Stream({ stream: process.stdout }),
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log',
        maxsize: 5242880,
        maxFiles: 5,
      }),
    ])
  ],
});

// Request logging middleware
export const requestLogger = {
  logRequest: (req: any, res: any, next: any) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info('HTTP Request', {
        method: req.method,
        path: req.originalUrl?.split('?')[0] ?? req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    });
    
    next();
  }
};