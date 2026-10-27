import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createEventRouter } from './routes/eventRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

export function createApp() {
  const app = express();

  // Basic security headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    })
  );

  // 100kb request body limit as required
  app.use(express.json({ limit: '100kb' }));

  // General rate limiter
  const isTest = process.env.NODE_ENV === 'test';
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isTest ? 10000 : 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.'
      }
    }
  });

  app.use('/api', generalLimiter);

  // Mount API router
  app.use('/api', createEventRouter());

  // Serve static client build if present
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
  }

  // SPA fallback for all non-/api routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    const indexPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    // Fallback if client is not built
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head><title>FairScore API Server</title></head>
        <body style="font-family:sans-serif;padding:2rem;">
          <h1>FairScore Server is running</h1>
          <p>Client build not found at <code>${clientDistPath}</code>.</p>
          <p>Run <code>npm run build</code> to compile the client UI.</p>
        </body>
      </html>
    `);
  });

  // Catch-all 404 for unhandled API routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `API route ${req.method} ${req.path} not found`
      }
    });
  });

  // Central error handler returning consistent { error: { code, message } }
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    const code = err.code || 'INTERNAL_SERVER_ERROR';
    const message = err.message || 'An unexpected error occurred';

    if (process.env.NODE_ENV !== 'test') {
      console.error(`[Error ${status} ${code}]:`, err);
    }

    res.status(status).json({
      error: {
        code,
        message
      }
    });
  });

  return app;
}
