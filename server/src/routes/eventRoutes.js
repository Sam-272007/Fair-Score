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

export function createEventRouter() {
  const router = Router();
  const isTest = process.env.NODE_ENV === 'test';

  // Stricter rate limiter for writes (120 req / minute)
  const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isTest ? 10000 : 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many write requests. Please slow down.'
      }
    }
  });

  // Health check
  router.get('/health', getHealth);

  // Stateless analysis
  router.post('/analyze', postAnalyze);

  // Event creation & listing
  router.post('/events', writeLimiter, createEvent);
  router.post('/events/demo', writeLimiter, createDemoEvent);
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
