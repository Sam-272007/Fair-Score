import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getHealth,
  postAnalyze,
  createEvent,
  createDemoEvent,
  getEvents,
  requireAdminAuth,
  getAdminDashboard,
  updateEventStatus,
  exportCsv,
  getJudgePortal,
  submitJudgeScore,
  getPublicResults
} from '../controllers/eventController.js';

export function createEventRouter(options = {}) {
  const router = Router();
  const isTest = process.env.NODE_ENV === 'test' && !options.enableRateLimit;

  const rateLimitMessage = {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please wait a few minutes and try again.'
    }
  };

  // Stricter rate limiter for writes (120 req / minute)
  const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isTest ? 10000 : (options.writeLimitMax ?? 120),
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    message: rateLimitMessage
  });

  // Dedicated demo event limiter (20 per hour per IP)
  const demoLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: isTest ? 10000 : (options.demoLimitMax ?? 20),
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    message: rateLimitMessage
  });

  // Health check
  router.get('/health', getHealth);

  // Stateless analysis
  router.post('/analyze', postAnalyze);

  // Event creation & listing
  router.post('/events', writeLimiter, createEvent);
  router.post('/events/demo', demoLimiter, createDemoEvent);
  router.get('/events', getEvents);

  // Admin routes (capability token Bearer auth)
  router.get('/admin/:id', requireAdminAuth, getAdminDashboard);
  router.post('/admin/:id/status', writeLimiter, requireAdminAuth, updateEventStatus);
  router.get('/admin/:id/export.csv', requireAdminAuth, exportCsv);

  // Judge scoring routes (mobile-first capability link)
  router.get('/judge/:token', getJudgePortal);
  router.put('/judge/:token/scores/:teamId', writeLimiter, submitJudgeScore);

  // Public results route
  router.get('/results/:id', getPublicResults);

  return router;
}
