import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';

let mongod;

describe('Reverse-Proxy and Rate-Limiter Tests', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  test('without trust proxy, clients with different X-Forwarded-For share the same IP rate limit', async () => {
    const appWithoutProxy = createApp({
      enableRateLimit: true,
      trustProxy: false,
      writeLimitMax: 2
    });

    // Client 1 sends 2 requests with IP 198.51.100.1
    const res1 = await request(appWithoutProxy)
      .post('/api/events')
      .set('X-Forwarded-For', '198.51.100.1')
      .send({ name: 'E1', teams: ['A', 'B'], judges: ['J1', 'J2'] });
    assert.equal(res1.status, 201);

    const res2 = await request(appWithoutProxy)
      .post('/api/events')
      .set('X-Forwarded-For', '198.51.100.1')
      .send({ name: 'E2', teams: ['A', 'B'], judges: ['J1', 'J2'] });
    assert.equal(res2.status, 201);

    // Client 2 with different IP 198.51.100.2 hits rate limit because without trust proxy both are seen as 127.0.0.1
    const res3 = await request(appWithoutProxy)
      .post('/api/events')
      .set('X-Forwarded-For', '198.51.100.2')
      .send({ name: 'E3', teams: ['A', 'B'], judges: ['J1', 'J2'] });
    assert.equal(res3.status, 429);
    assert.equal(res3.body.error.code, 'RATE_LIMITED');
    assert.equal(res3.body.error.message, 'Too many requests. Please wait a few minutes and try again.');
  });

  test('with trust proxy enabled, clients with different X-Forwarded-For have independent rate limits', async () => {
    const appWithProxy = createApp({
      enableRateLimit: true,
      trustProxy: true,
      writeLimitMax: 2
    });

    // Client 1 exhausts their 2 requests
    const res1 = await request(appWithProxy)
      .post('/api/events')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ name: 'E1', teams: ['A', 'B'], judges: ['J1', 'J2'] });
    assert.equal(res1.status, 201);

    const res2 = await request(appWithProxy)
      .post('/api/events')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ name: 'E2', teams: ['A', 'B'], judges: ['J1', 'J2'] });
    assert.equal(res2.status, 201);

    // Client 1 is rate limited
    const res3 = await request(appWithProxy)
      .post('/api/events')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ name: 'E3', teams: ['A', 'B'], judges: ['J1', 'J2'] });
    assert.equal(res3.status, 429);
    assert.equal(res3.body.error.code, 'RATE_LIMITED');
    assert.equal(res3.body.error.message, 'Too many requests. Please wait a few minutes and try again.');

    // Client 2 with a different IP is NOT blocked
    const res4 = await request(appWithProxy)
      .post('/api/events')
      .set('X-Forwarded-For', '203.0.113.20')
      .send({ name: 'E4', teams: ['A', 'B'], judges: ['J1', 'J2'] });
    assert.equal(res4.status, 201);
  });

  test('demo event route enforces dedicated rate limit and friendly JSON error', async () => {
    const appWithDemoLimit = createApp({
      enableRateLimit: true,
      trustProxy: true,
      demoLimitMax: 1
    });

    const res1 = await request(appWithDemoLimit)
      .post('/api/events/demo')
      .set('X-Forwarded-For', '192.0.2.1');
    assert.equal(res1.status, 201);

    const res2 = await request(appWithDemoLimit)
      .post('/api/events/demo')
      .set('X-Forwarded-For', '192.0.2.1');
    assert.equal(res2.status, 429);
    assert.deepEqual(res2.body, {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please wait a few minutes and try again.'
      }
    });
  });
});
