import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { validateAndRoundScore } from '../src/engine/validate.js';

let mongod;
let app;
let judgeToken1_10;
let judgeToken0_1;

describe('Decimal Score Validation Suite', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    app = createApp();

    // Setup 1-10 scale event
    const event1_10Res = await request(app)
      .post('/api/events')
      .send({
        name: 'Decimal Test Event 1-10',
        scoringScale: { min: 1, max: 10 },
        teams: ['Alpha', 'Beta'],
        judges: ['Judge A', 'Judge B'],
        assignmentMode: 'all'
      });
    const event1_10 = event1_10Res.body;
    judgeToken1_10 = event1_10.judgeLinks[0].token;

    await request(app)
      .post(`/api/admin/${event1_10.eventId}/status`)
      .set('Authorization', `Bearer ${event1_10.adminToken}`)
      .send({ status: 'scoring' });

    // Setup 0-1 scale event
    const event0_1Res = await request(app)
      .post('/api/events')
      .send({
        name: 'Decimal Test Event 0-1',
        scoringScale: { min: 0, max: 1 },
        teams: ['Alpha', 'Beta'],
        judges: ['Judge A', 'Judge B'],
        assignmentMode: 'all'
      });
    const event0_1 = event0_1Res.body;
    judgeToken0_1 = event0_1.judgeLinks[0].token;

    await request(app)
      .post(`/api/admin/${event0_1.eventId}/status`)
      .set('Authorization', `Bearer ${event0_1.adminToken}`)
      .send({ status: 'scoring' });
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  describe('Shared Validation Helper: validateAndRoundScore', () => {
    test('shared helper exists and validates precision and range', () => {
      assert.equal(typeof validateAndRoundScore, 'function');
      assert.equal(validateAndRoundScore(8.5, 1, 10), 8.5);
      assert.equal(validateAndRoundScore(7.25, 1, 10), 7.25);
      assert.equal(validateAndRoundScore(6.1, 1, 10), 6.1);
      assert.equal(validateAndRoundScore(9.7, 1, 10), 9.7);
      assert.equal(validateAndRoundScore(5.55, 1, 10), 5.55);
      assert.equal(validateAndRoundScore(0.1 + 0.2, 0, 1), 0.3);

      assert.throws(() => validateAndRoundScore(7.255, 1, 10));
      assert.throws(() => validateAndRoundScore(10.001, 1, 10));
      assert.throws(() => validateAndRoundScore(0.5, 1, 10));
      assert.throws(() => validateAndRoundScore(11, 1, 10));
    });
  });

  describe('Judge Scoring Route: Valid Decimal Values', () => {
    const valid1_10Values = [1, 10, 8.5, 7.25, 6.1, 9.7, 5.55];

    for (const val of valid1_10Values) {
      test(`accepts valid score ${val} on 1-10 scale`, async () => {
        const res = await request(app)
          .put(`/api/judge/${judgeToken1_10}/scores/t_1`)
          .send({ value: val });
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.score.value, val);
      });
    }

    test('accepts valid score 0.1 + 0.2 (0.30000000000000004) on 0-1 scale', async () => {
      const res = await request(app)
        .put(`/api/judge/${judgeToken0_1}/scores/t_1`)
        .send({ value: 0.1 + 0.2 });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.score.value, 0.3);
    });
  });

  describe('Judge Scoring Route: Invalid Values Rejected with HTTP 400', () => {
    const invalidCases = [
      { name: 'below min (0.5)', body: { value: 0.5 } },
      { name: 'above max (10.5)', body: { value: 10.5 } },
      { name: '10.001 (exceeds max and decimals)', body: { value: 10.001 } },
      { name: '7.255 (3 decimal places)', body: { value: 7.255 } },
      { name: 'NaN', body: { value: NaN } },
      { name: 'Infinity', body: { value: Infinity } },
      { name: 'null', body: { value: null } },
      { name: 'string abc', body: { value: 'abc' } },
      { name: 'empty string', body: { value: '' } },
      { name: 'boolean true', body: { value: true } },
      { name: 'object', body: { value: { score: 8 } } }
    ];

    for (const { name, body } of invalidCases) {
      test(`rejects invalid input ${name} with HTTP 400 and code`, async () => {
        const res = await request(app)
          .put(`/api/judge/${judgeToken1_10}/scores/t_1`)
          .send(body);
        assert.equal(res.status, 400, `Expected 400 for ${name}, got ${res.status}`);
        assert.ok(res.body.error, `Expected error object for ${name}`);
        assert.ok(res.body.error.code, `Expected error.code for ${name}`);
        assert.ok(res.body.error.message, `Expected error.message for ${name}`);
      });
    }
  });
});
