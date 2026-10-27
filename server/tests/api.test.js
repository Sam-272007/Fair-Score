import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Event } from '../src/models/Event.js';
import { Score } from '../src/models/Score.js';

let mongod;
let app;

describe('FairScore Full API Integration Suite (supertest + MongoMemoryServer)', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    app = createApp();
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  // 1. Health check with DB connected
  test('GET /api/health returns 200 and database connected', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.database, 'connected');
  });

  // 2. Create Event
  test('POST /api/events creates an event and returns capability links', async () => {
    const res = await request(app)
      .post('/api/events')
      .send({
        name: 'Spring Hackathon 2026',
        scoringScale: { min: 1, max: 10 },
        teams: ['Alpha', 'Beta', 'Gamma'],
        judges: ['Judge X', 'Judge Y'],
        assignmentMode: 'all'
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.eventId);
    assert.ok(res.body.adminToken);
    assert.ok(res.body.adminUrl.includes('#t='));
    assert.equal(res.body.judgeLinks.length, 2);
    assert.equal(res.body.status, 'setup');
  });

  // 3. Auth failures
  test('GET /api/admin/:id rejects missing or invalid capability token', async () => {
    // Create an event
    const createRes = await request(app)
      .post('/api/events')
      .send({
        name: 'Auth Test Event',
        teams: ['T1', 'T2'],
        judges: ['J1', 'J2']
      });

    const eventId = createRes.body.eventId;

    // Missing header -> 401
    const noAuth = await request(app).get(`/api/admin/${eventId}`);
    assert.equal(noAuth.status, 401);
    assert.equal(noAuth.body.error.code, 'UNAUTHORIZED');

    // Wrong token -> 403
    const badAuth = await request(app)
      .get(`/api/admin/${eventId}`)
      .set('Authorization', 'Bearer invalid_admin_token_123');
    assert.equal(badAuth.status, 403);
    assert.equal(badAuth.body.error.code, 'FORBIDDEN');
  });

  // 4. Invalid status transitions
  test('POST /api/admin/:id/status rejects invalid state transitions (409)', async () => {
    const createRes = await request(app)
      .post('/api/events')
      .send({
        name: 'Transition Test Event',
        teams: ['T1', 'T2'],
        judges: ['J1', 'J2']
      });

    const { eventId, adminToken } = createRes.body;

    // In 'setup' state, cannot jump directly to 'published' (must be setup -> scoring -> locked -> published)
    const invalidJump = await request(app)
      .post(`/api/admin/${eventId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'published' });

    assert.equal(invalidJump.status, 409);
    assert.equal(invalidJump.body.error.code, 'INVALID_STATE_TRANSITION');

    // Valid transition: setup -> scoring
    const openScoring = await request(app)
      .post(`/api/admin/${eventId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'scoring' });
    assert.equal(openScoring.status, 200);
    assert.equal(openScoring.body.status, 'scoring');
  });

  // 5. Judge Scoring: scale bounds, unassigned team, and locked event
  test('Judge scoring validation: scale bounds, unassigned team, and locked state', async () => {
    const createRes = await request(app)
      .post('/api/events')
      .send({
        name: 'Scoring Validation Event',
        scoringScale: { min: 1, max: 10 },
        teams: ['Team 1', 'Team 2', 'Team 3'],
        judges: ['Judge 1', 'Judge 2'],
        assignmentMode: 'all'
      });

    const { eventId, adminToken, judgeLinks } = createRes.body;
    const judge1 = judgeLinks[0];

    // Attempt scoring while in 'setup' status -> 403
    const scoringSetup = await request(app)
      .put(`/api/judge/${judge1.token}/scores/t_1`)
      .send({ value: 8.5 });
    assert.equal(scoringSetup.status, 403);
    assert.equal(scoringSetup.body.error.code, 'SCORING_CLOSED');

    // Transition to 'scoring'
    await request(app)
      .post(`/api/admin/${eventId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'scoring' });

    // Scoring outside scale bounds (< min) -> 400
    const scoreTooLow = await request(app)
      .put(`/api/judge/${judge1.token}/scores/t_1`)
      .send({ value: 0.5 });
    assert.equal(scoreTooLow.status, 400);
    assert.equal(scoreTooLow.body.error.code, 'SCORE_OUT_OF_RANGE');

    // Scoring outside scale bounds (> max) -> 400
    const scoreTooHigh = await request(app)
      .put(`/api/judge/${judge1.token}/scores/t_1`)
      .send({ value: 12.0 });
    assert.equal(scoreTooHigh.status, 400);
    assert.equal(scoreTooHigh.body.error.code, 'SCORE_OUT_OF_RANGE');

    // Scoring unassigned team -> 403
    const unassignedScore = await request(app)
      .put(`/api/judge/${judge1.token}/scores/non_existent_team_id`)
      .send({ value: 7.0 });
    assert.equal(unassignedScore.status, 403);
    assert.equal(unassignedScore.body.error.code, 'TEAM_NOT_ASSIGNED');

    // Valid score submission -> 200
    const validScore = await request(app)
      .put(`/api/judge/${judge1.token}/scores/t_1`)
      .send({ value: 8.5 });
    assert.equal(validScore.status, 200);
    assert.equal(validScore.body.success, true);
    assert.equal(validScore.body.score.value, 8.5);

    // Lock the event
    await request(app)
      .post(`/api/admin/${eventId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'locked' });

    // Scoring while locked -> 403
    const lockedScore = await request(app)
      .put(`/api/judge/${judge1.token}/scores/t_1`)
      .send({ value: 9.0 });
    assert.equal(lockedScore.status, 403);
    assert.equal(lockedScore.body.error.code, 'SCORING_CLOSED');
  });

  // 6. Upsert does not duplicate scores
  test('Score writes are upserts and do not duplicate records', async () => {
    const createRes = await request(app)
      .post('/api/events')
      .send({
        name: 'Upsert Test Event',
        teams: ['T1', 'T2'],
        judges: ['J1', 'J2'],
        assignmentMode: 'all'
      });

    const { eventId, adminToken, judgeLinks } = createRes.body;
    const judge1 = judgeLinks[0];

    // Open scoring
    await request(app)
      .post(`/api/admin/${eventId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'scoring' });

    // Submit initial score 7.0
    await request(app)
      .put(`/api/judge/${judge1.token}/scores/t_1`)
      .send({ value: 7.0 });

    // Re-submit updated score 9.0 for the exact same (eventId, judgeId, teamId)
    await request(app)
      .put(`/api/judge/${judge1.token}/scores/t_1`)
      .send({ value: 9.0 });

    // Query database directly to verify exactly 1 score document exists
    const scoresInDb = await Score.find({ eventId, judgeId: judge1.judgeId, teamId: 't_1' });
    assert.equal(scoresInDb.length, 1);
    assert.equal(scoresInDb[0].value, 9.0);
  });

  // 7. Results hidden until published
  test('GET /api/results/:id returns 404 until event status is published', async () => {
    const createRes = await request(app)
      .post('/api/events')
      .send({
        name: 'Public Results Visibility Event',
        teams: ['T1', 'T2'],
        judges: ['J1', 'J2'],
        assignmentMode: 'all'
      });

    const { eventId, adminToken, judgeLinks } = createRes.body;

    // Check results while in 'setup' -> 404
    const resSetup = await request(app).get(`/api/results/${eventId}`);
    assert.equal(resSetup.status, 404);
    assert.equal(resSetup.body.error.code, 'RESULTS_NOT_PUBLISHED');

    // Open scoring and submit a couple of scores
    await request(app)
      .post(`/api/admin/${eventId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'scoring' });

    await request(app).put(`/api/judge/${judgeLinks[0].token}/scores/t_1`).send({ value: 8 });
    await request(app).put(`/api/judge/${judgeLinks[0].token}/scores/t_2`).send({ value: 6 });
    await request(app).put(`/api/judge/${judgeLinks[1].token}/scores/t_1`).send({ value: 7 });
    await request(app).put(`/api/judge/${judgeLinks[1].token}/scores/t_2`).send({ value: 9 });

    // Lock scoring
    await request(app)
      .post(`/api/admin/${eventId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'locked' });

    // Check results while 'locked' -> 404
    const resLocked = await request(app).get(`/api/results/${eventId}`);
    assert.equal(resLocked.status, 404);

    // Publish event
    await request(app)
      .post(`/api/admin/${eventId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'published' });

    // Check results while 'published' -> 200 with final rankings and methodology
    const resPublished = await request(app).get(`/api/results/${eventId}`);
    assert.equal(resPublished.status, 200);
    assert.equal(resPublished.body.name, 'Public Results Visibility Event');
    assert.ok(resPublished.body.rankings.length >= 2);
    assert.ok(resPublished.body.methodologyNote.includes('FairScore'));
  });
});
