import { z } from 'zod';
import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { Score } from '../models/Score.js';
import { generateToken, hashToken, verifyToken } from '../utils/auth.js';
import { analyze } from '../engine/analyze.js';
import { planAssignments } from '../engine/assignmentPlanner.js';
import { UNLUCKY_TEAM_ROWS } from '../engine/sampleScores.js';
import { validateAndRoundScore } from '../engine/validate.js';
import { isDbConnected } from '../config/db.js';

// Zod schemas for request validation
const analyzeSchema = z.object({
  rows: z
    .array(
      z.object({
        judge: z.string().min(1, 'Judge identifier is required'),
        team: z.string().min(1, 'Team identifier is required'),
        score: z.number().finite('Score must be a finite number')
      })
    )
    .min(1, 'At least 1 score row required')
    .max(5000, 'Maximum 5000 rows allowed per analysis')
});

const createEventSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(120),
  scoringScale: z
    .object({
      min: z.number().default(1),
      max: z.number().default(10)
    })
    .refine((s) => s.max > s.min, { message: 'Max score must be greater than min score' })
    .default({ min: 1, max: 10 }),
  teams: z.array(z.string().min(1).trim()).min(2, 'At least 2 teams required'),
  judges: z.array(z.string().min(1).trim()).min(2, 'At least 2 judges required'),
  assignmentMode: z.enum(['all', 'k_judges']).default('all'),
  k: z.number().int().positive().optional().nullable(),
  initialScores: z
    .array(
      z.object({
        judge: z.string(),
        team: z.string(),
        score: z.number()
      })
    )
    .optional()
});

const statusSchema = z.object({
  status: z.enum(['setup', 'scoring', 'locked', 'published'])
});

const scoreSchema = z.object({
  value: z.number().finite()
});

/**
 * Health check endpoint
 */
export async function getHealth(req, res) {
  const connected = isDbConnected();
  if (!connected) {
    return res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      error: {
        code: 'DATABASE_DISCONNECTED',
        message: 'Database connection is not ready'
      }
    });
  }

  res.status(200).json({
    status: 'ok',
    database: 'connected',
    timestamp: new Date().toISOString()
  });
}

/**
 * POST /api/analyze (Stateless CSV/rows analysis)
 */
export async function postAnalyze(req, res, next) {
  try {
    const parseResult = analyzeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: parseResult.error.errors.map((e) => e.message).join(', ')
        }
      });
    }

    const { rows } = parseResult.data;
    const report = analyze(rows);
    res.status(200).json(report);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        error: {
          code: err.code || 'VALIDATION_ERROR',
          message: err.message,
          details: err.details
        }
      });
    }
    next(err);
  }
}

/**
 * Helper to ensure database is ready
 */
function assertDbConnected() {
  if (!isDbConnected()) {
    const err = new Error('Database connection is unavailable');
    err.status = 503;
    err.code = 'DATABASE_UNAVAILABLE';
    throw err;
  }
}

/**
 * POST /api/events (Create event)
 */
export async function createEvent(req, res, next) {
  try {
    assertDbConnected();

    const parseResult = createEventSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: parseResult.error.errors.map((e) => e.message).join(', ')
        }
      });
    }

    const data = parseResult.data;

    // Deduplicate names
    const uniqueTeamNames = Array.from(new Set(data.teams.map((t) => t.trim())));
    const uniqueJudgeNames = Array.from(new Set(data.judges.map((j) => j.trim())));

    if (uniqueTeamNames.length < 2) {
      return res.status(400).json({
        error: { code: 'INSUFFICIENT_TEAMS', message: 'At least 2 unique team names required' }
      });
    }
    if (uniqueJudgeNames.length < 2) {
      return res.status(400).json({
        error: { code: 'INSUFFICIENT_JUDGES', message: 'At least 2 unique judge names required' }
      });
    }

    const adminToken = generateToken();
    const adminTokenHash = hashToken(adminToken);

    // Build team and judge records
    const teams = uniqueTeamNames.map((name, idx) => ({
      id: `t_${idx + 1}`,
      name
    }));

    const judges = uniqueJudgeNames.map((name, idx) => ({
      id: `j_${idx + 1}`,
      name,
      token: generateToken(),
      assignedTeamIds: []
    }));

    // If assignment mode is 'all', pre-assign all teams to all judges
    if (data.assignmentMode === 'all') {
      const allTeamIds = teams.map((t) => t.id);
      for (const j of judges) {
        j.assignedTeamIds = [...allTeamIds];
      }
    } else if (data.assignmentMode === 'k_judges' && data.k) {
      const plan = planAssignments(teams, judges, data.k);
      for (const j of judges) {
        j.assignedTeamIds = plan.judgeAssignments.get(j.id) || [];
      }
    }

    const event = new Event({
      name: data.name,
      status: 'setup',
      scoringScale: data.scoringScale,
      assignmentMode: data.assignmentMode,
      k: data.assignmentMode === 'k_judges' ? data.k : null,
      adminTokenHash,
      teams,
      judges
    });

    await event.save();

    // If initial scores were provided (e.g. from Quick Analyze or demo import)
    if (data.initialScores && Array.isArray(data.initialScores)) {
      const scoreDocs = [];
      const teamNameToId = new Map(teams.map((t) => [t.name.toLowerCase(), t.id]));
      const judgeNameToId = new Map(judges.map((j) => [j.name.toLowerCase(), j.id]));

      for (const s of data.initialScores) {
        const teamId = teamNameToId.get(s.team.trim().toLowerCase());
        const judgeId = judgeNameToId.get(s.judge.trim().toLowerCase());
        if (teamId && judgeId) {
          try {
            const roundedVal = validateAndRoundScore(s.score, event.scoringScale.min, event.scoringScale.max);
            scoreDocs.push({
              eventId: event._id,
              judgeId,
              teamId,
              value: roundedVal
            });
          } catch {
            // Skip invalid score
          }
        }
      }

      if (scoreDocs.length > 0) {
        await Score.insertMany(scoreDocs, { ordered: false }).catch(() => {});
      }
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const judgeLinks = judges.map((j) => ({
      judgeId: j.id,
      name: j.name,
      token: j.token,
      url: `${baseUrl}/judge/${j.token}`
    }));

    res.status(201).json({
      eventId: event._id.toString(),
      name: event.name,
      adminToken,
      adminUrl: `${baseUrl}/admin/${event._id}#t=${adminToken}`,
      judgeLinks,
      status: event.status
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/events/demo (Create populated demo event)
 */
export async function createDemoEvent(req, res, next) {
  try {
    assertDbConnected();

    const uniqueJudgeNames = Array.from(new Set(UNLUCKY_TEAM_ROWS.map((r) => r.judge)));
    const uniqueTeamNames = Array.from(new Set(UNLUCKY_TEAM_ROWS.map((r) => r.team)));

    const adminToken = generateToken();
    const adminTokenHash = hashToken(adminToken);

    const teams = uniqueTeamNames.map((name, idx) => ({
      id: `t_${idx + 1}`,
      name
    }));

    const judges = uniqueJudgeNames.map((name, idx) => ({
      id: `j_${idx + 1}`,
      name,
      token: generateToken(),
      assignedTeamIds: []
    }));

    // Map rows to assigned teams
    const teamNameToId = new Map(teams.map((t) => [t.name, t.id]));
    const judgeNameToId = new Map(judges.map((j) => [j.name, j.id]));

    const judgeAssignedMap = new Map();
    for (const j of judges) judgeAssignedMap.set(j.id, new Set());

    const scoresToInsert = [];
    for (const r of UNLUCKY_TEAM_ROWS) {
      const tId = teamNameToId.get(r.team);
      const jId = judgeNameToId.get(r.judge);
      judgeAssignedMap.get(jId).add(tId);
      const validatedScore = validateAndRoundScore(r.score, 1, 10);
      scoresToInsert.push({
        teamId: tId,
        judgeId: jId,
        value: validatedScore
      });
    }

    for (const j of judges) {
      j.assignedTeamIds = Array.from(judgeAssignedMap.get(j.id));
    }

    const event = new Event({
      name: 'Hackathon 2026 Grand Finale (Demo)',
      status: 'scoring',
      scoringScale: { min: 1, max: 10 },
      assignmentMode: 'k_judges',
      k: 3,
      adminTokenHash,
      teams,
      judges
    });

    await event.save();

    for (const s of scoresToInsert) {
      s.eventId = event._id;
    }
    await Score.insertMany(scoresToInsert);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const judgeLinks = judges.map((j) => ({
      judgeId: j.id,
      name: j.name,
      token: j.token,
      url: `${baseUrl}/judge/${j.token}`
    }));

    res.status(201).json({
      eventId: event._id.toString(),
      name: event.name,
      adminToken,
      adminUrl: `${baseUrl}/admin/${event._id}#t=${adminToken}`,
      judgeLinks,
      status: event.status
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/events (Recent events list)
 */
export async function getEvents(req, res, next) {
  try {
    assertDbConnected();
    const events = await Event.find({}, 'name status createdAt teams judges')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const summary = events.map((e) => ({
      id: e._id.toString(),
      name: e.name,
      status: e.status,
      teamCount: e.teams?.length || 0,
      judgeCount: e.judges?.length || 0,
      createdAt: e.createdAt
    }));

    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: Verify Admin Bearer Token
 */
export async function requireAdminAuth(req, res, next) {
  try {
    assertDbConnected();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' }
      });
    }

    const token = authHeader.slice(7).trim();
    const eventId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Event not found' }
      });
    }

    const event = await Event.findById(eventId).select('+adminTokenHash');
    if (!event) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Event not found' }
      });
    }

    const isValid = verifyToken(token, event.adminTokenHash);
    if (!isValid) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Invalid admin capability token' }
      });
    }

    req.event = event;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/:id (Dashboard data, judge progress, analysis)
 */
export async function getAdminDashboard(req, res, next) {
  try {
    const event = req.event;
    const scores = await Score.find({ eventId: event._id }).lean();

    const teamIdToName = new Map(event.teams.map((t) => [t.id, t.name]));
    const judgeIdToName = new Map(event.judges.map((j) => [j.id, j.name]));

    // Build judge progress
    const judgeScoresMap = new Map();
    for (const s of scores) {
      if (!judgeScoresMap.has(s.judgeId)) judgeScoresMap.set(s.judgeId, new Set());
      judgeScoresMap.get(s.judgeId).add(s.teamId);
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const judgesProgress = event.judges.map((j) => {
      const assignedCount = j.assignedTeamIds.length;
      const submittedSet = judgeScoresMap.get(j.id) || new Set();
      const completedCount = submittedSet.size;

      return {
        id: j.id,
        name: j.name,
        token: j.token,
        url: `${baseUrl}/judge/${j.token}`,
        assignedCount,
        completedCount,
        progressPercent: assignedCount > 0 ? Math.round((completedCount / assignedCount) * 100) : 0
      };
    });

    // Run analysis if there are enough scores
    let analysisResult = null;
    const analysisRows = scores.map((s) => ({
      judge: judgeIdToName.get(s.judgeId) || s.judgeId,
      team: teamIdToName.get(s.teamId) || s.teamId,
      score: s.value
    }));

    if (analysisRows.length >= 2) {
      try {
        analysisResult = analyze(analysisRows);

        // Check if there are missing expected scores in scoring mode
        const totalExpected = event.judges.reduce((acc, j) => acc + j.assignedTeamIds.length, 0);
        if (event.status === 'scoring' && scores.length < totalExpected) {
          analysisResult.warnings.push({
            code: 'INCOMPLETE',
            severity: 'info',
            message: `Scoring in progress: ${scores.length} of ${totalExpected} expected scores submitted.`
          });
        }
      } catch (analysisErr) {
        // Partial or degenerate dataset
        analysisResult = {
          teams: [],
          judges: [],
          warnings: [{ code: 'INCOMPLETE_DATA', severity: 'info', message: analysisErr.message }]
        };
      }
    }

    res.status(200).json({
      eventId: event._id.toString(),
      name: event.name,
      status: event.status,
      scoringScale: event.scoringScale,
      assignmentMode: event.assignmentMode,
      k: event.k,
      teams: event.teams.map((t) => ({ id: t.id, name: t.name })),
      judges: judgesProgress,
      scoresCount: scores.length,
      analysis: analysisResult
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/:id/status (Transition status: setup -> scoring -> locked -> published; locked -> scoring)
 */
export async function updateEventStatus(req, res, next) {
  try {
    const event = req.event;

    const parseResult = statusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: { code: 'INVALID_STATUS', message: 'Status must be setup, scoring, locked, or published' }
      });
    }

    const nextStatus = parseResult.data.status;
    const current = event.status;

    // Allowed transitions:
    // setup -> scoring
    // scoring -> locked
    // locked -> published
    // locked -> scoring (reopen)
    const allowedTransitions = {
      setup: ['scoring'],
      scoring: ['locked'],
      locked: ['published', 'scoring'],
      published: []
    };

    if (!allowedTransitions[current] || !allowedTransitions[current].includes(nextStatus)) {
      return res.status(409).json({
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: `Cannot transition event from "${current}" to "${nextStatus}".`
        }
      });
    }

    // When moving to scoring: generate assignments if missing
    if (nextStatus === 'scoring') {
      const hasMissingAssignments = event.judges.some((j) => !j.assignedTeamIds || j.assignedTeamIds.length === 0);
      if (hasMissingAssignments) {
        if (event.assignmentMode === 'all') {
          const allTeamIds = event.teams.map((t) => t.id);
          for (const j of event.judges) {
            j.assignedTeamIds = [...allTeamIds];
          }
        } else if (event.assignmentMode === 'k_judges' && event.k) {
          const plan = planAssignments(event.teams, event.judges, event.k);
          for (const j of event.judges) {
            j.assignedTeamIds = plan.judgeAssignments.get(j.id) || [];
          }
        }
      }
    }

    event.status = nextStatus;
    await event.save();

    res.status(200).json({
      success: true,
      status: event.status
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/:id/export.csv (Export event scores / rankings)
 */
export async function exportCsv(req, res, next) {
  try {
    const event = req.event;
    const scores = await Score.find({ eventId: event._id }).lean();

    const teamIdToName = new Map(event.teams.map((t) => [t.id, t.name]));
    const judgeIdToName = new Map(event.judges.map((j) => [j.id, j.name]));

    const header = 'judge,team,score,updatedAt\n';
    const lines = scores.map((s) => {
      const jName = (judgeIdToName.get(s.judgeId) || s.judgeId).replace(/"/g, '""');
      const tName = (teamIdToName.get(s.teamId) || s.teamId).replace(/"/g, '""');
      return `"${jName}","${tName}",${s.value},"${s.updatedAt?.toISOString() || ''}"`;
    });

    const csvContent = header + lines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="fairscore-${event._id}-scores.csv"`);
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/judge/:token (Judge scoring portal data)
 */
export async function getJudgePortal(req, res, next) {
  try {
    assertDbConnected();
    const token = req.params.token;

    const event = await Event.findOne({ 'judges.token': token });
    if (!event) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Judge link is invalid or expired' }
      });
    }

    const judge = event.judges.find((j) => j.token === token);
    if (!judge) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Judge record not found' }
      });
    }

    // Only get this judge's scores
    const myScores = await Score.find({ eventId: event._id, judgeId: judge.id }).lean();
    const scoreMap = new Map(myScores.map((s) => [s.teamId, s.value]));

    // Only return assigned teams
    const assignedTeamSet = new Set(judge.assignedTeamIds);
    const assignedTeams = event.teams
      .filter((t) => assignedTeamSet.has(t.id))
      .map((t) => ({
        id: t.id,
        name: t.name,
        score: scoreMap.has(t.id) ? scoreMap.get(t.id) : null
      }));

    res.status(200).json({
      eventName: event.name,
      eventStatus: event.status,
      scoringScale: event.scoringScale,
      judgeName: judge.name,
      judgeId: judge.id,
      assignedTeams
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/judge/:token/scores/:teamId (Autosave score submission)
 */
export async function submitJudgeScore(req, res, next) {
  try {
    assertDbConnected();
    const { token, teamId } = req.params;

    const event = await Event.findOne({ 'judges.token': token });
    if (!event) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Judge link is invalid' }
      });
    }

    if (event.status !== 'scoring') {
      return res.status(403).json({
        error: {
          code: 'SCORING_CLOSED',
          message:
            event.status === 'locked' || event.status === 'published'
              ? 'Scoring is closed for this event.'
              : 'Scoring has not opened yet.'
        }
      });
    }

    const judge = event.judges.find((j) => j.token === token);
    if (!judge) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Judge record not found' }
      });
    }

    if (!judge.assignedTeamIds.includes(teamId)) {
      return res.status(403).json({
        error: { code: 'TEAM_NOT_ASSIGNED', message: 'You are not assigned to score this team' }
      });
    }

    const { min, max } = event.scoringScale;

    // Validate scale and up to 2 decimal places using shared helper
    let roundedValue;
    try {
      roundedValue = validateAndRoundScore(req.body?.value, min, max);
    } catch (err) {
      return res.status(400).json({
        error: {
          code: err.code || 'INVALID_SCORE',
          message: err.message
        }
      });
    }

    // Upsert score record so it updates instead of duplicating
    const scoreDoc = await Score.findOneAndUpdate(
      { eventId: event._id, judgeId: judge.id, teamId },
      { $set: { value: roundedValue, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      score: {
        teamId: scoreDoc.teamId,
        value: scoreDoc.value,
        updatedAt: scoreDoc.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/results/:id (Public published results page)
 */
export async function getPublicResults(req, res, next) {
  try {
    assertDbConnected();
    const eventId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Results not found' }
      });
    }

    const event = await Event.findById(eventId).lean();
    if (!event) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Results not found' }
      });
    }

    // Allowed ONLY when status is published!
    if (event.status !== 'published') {
      return res.status(404).json({
        error: {
          code: 'RESULTS_NOT_PUBLISHED',
          message: 'Official results have not been published yet.'
        }
      });
    }

    const scores = await Score.find({ eventId: event._id }).lean();
    const teamIdToName = new Map(event.teams.map((t) => [t.id, t.name]));
    const judgeIdToName = new Map(event.judges.map((j) => [j.id, j.name]));

    const analysisRows = scores.map((s) => ({
      judge: judgeIdToName.get(s.judgeId) || s.judgeId,
      team: teamIdToName.get(s.teamId) || s.teamId,
      score: s.value
    }));

    const analysisResult = analyze(analysisRows);

    res.status(200).json({
      name: event.name,
      publishedAt: event.updatedAt,
      scoringScale: event.scoringScale,
      recommended: analysisResult.recommended,
      rankings: analysisResult.teams.map((t) => ({
        rank: analysisResult.recommended === 'model' ? t.modelRank : t.zRank,
        team: t.team,
        score: analysisResult.recommended === 'model' ? t.model : t.z,
        rawMean: t.raw,
        shift: t.shift,
        stable: t.stable
      })),
      warnings: analysisResult.warnings,
      methodologyNote:
        'Rankings were computed using FairScore iterative judge-effect normalization. ' +
        'By modeling individual judge strictness and re-centering evaluations, raw score inflation and deflation ' +
        'are decoupled from inherent project quality. Sensitivity analysis checks verify ranking robustness across judge subsets.'
    });
  } catch (err) {
    next(err);
  }
}
