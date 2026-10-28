# TASK: Build "FairScore" from scratch: a complete, deployed, working web app

You are a senior full-stack engineer. Build the project below end to end: code, tests, docs, and deployment readiness. Work in the milestone order given. After each milestone the app must run, tests must pass, and you must make a git commit. Never leave the repo in a broken state. Do not use mock data or placeholders in production code paths. Everything the UI shows must come from the real API and database.

## 1. Context
This is a university end-term software engineering project, due 27 Oct 2026, 11:59 PM IST. It is graded on: product understanding (10%), core implementation (25%), engineering and application logic (20%), architecture (15%), UX and reliability (10%), code quality and structure (10%), deployment and documentation (10%). It will NOT count if it is: a static site, UI-only, a tutorial clone, basic CRUD, a thin API wrapper, or has major workflows that don't work. Depth beats feature count. Implement 3-5 workflows properly. There is no AI/LLM in this project, and none should be added.

## 2. Product
Name: FairScore.
Problem: In hackathons, college fests, pitch contests and project reviews, judges usually score different subsets of teams. Raw averages mix up team quality with judge strictness, so a team can lose purely because it drew a strict judge. Organizers have no way to know when a ranking is unreliable.
Users: Organizers of judged events (primary) and judges (secondary).
Solution: An event workflow app: the organizer creates an event, the app plans which judges see which teams (with enough overlap for correction), judges score from private links on their phones, and a dashboard shows a bias-corrected ranking with diagnostics that say when the result can't be trusted. Finished results can be published on a public page.
Honest differentiation (use this wording in docs, do NOT claim it is unique): per-judge normalization already exists in some paid judging platforms. FairScore is free, explains the correction, plans judge overlap, and warns when the data cannot support a reliable correction.

## 3. Workflows (all must fully work)
W1. Create event: name, scoring scale (min/max, default 1-10), team names, judge names, and assignment mode ("all judges score all teams" or "each team gets k judges"). The app returns an admin link and one private link per judge.
W2. Judge scoring (mobile-first, no login): the judge opens their link, sees only their assigned teams, enters scores with per-row autosave (saving/saved/error with retry), sees a progress bar, and can edit until the organizer locks the event.
W3. Organizer dashboard: event status controls (setup -> scoring -> locked -> published, plus reopen from locked to scoring), per-judge progress with copy-link buttons, ranking table with three methods side by side, judge-harshness bars, warnings panel, stability panel, CSV export. It auto-refreshes by polling every 10 seconds, paused while the tab is hidden.
W4. Public results page for published events: final recommended ranking plus a plain-language methodology note and warnings summary.
W5. Quick Analyze (stateless): paste or upload a CSV (judge,team,score) and get the same analysis, with two built-in sample datasets.
Also: a "Create demo event" button that creates an event with realistic simulated scores, so an evaluator can see a populated dashboard instantly.

## 4. Stack and constraints
- Node 20, ESM everywhere. One repo, two packages: /server (Express + Mongoose) and /client (React + Vite + react-router-dom + papaparse). A root package.json has scripts: dev, build, start, test, smoke.
- Server deps: express, mongoose, zod, helmet, express-rate-limit, dotenv. Dev: supertest, mongodb-memory-server. Use Node's built-in node:test for unit tests. Keep dependencies minimal and mainstream. No UI framework: plain CSS with CSS variables, responsive, accessible (labels, focus states, sufficient contrast). Charts are CSS bars only.
- Production: Express serves the built client from client/dist with an SPA fallback for every non-/api route (same origin, so no CORS or cookie problems). In dev, the Vite dev server proxies /api to the Express port.
- Database: MongoDB Atlas free tier via MONGODB_URI. Collections: events (with embedded teams[] and judges[]; each judge has name, token, assignedTeamIds[]) and scores {eventId, judgeId, teamId, value, updatedAt} with a UNIQUE compound index on (eventId, judgeId, teamId). Writes are upserts so re-submitting updates instead of duplicating.
- Auth model (document it in the README): no accounts. Capability links. Tokens are crypto.randomBytes(24).toString('base64url'). Admin token: shown once at creation, stored only as a SHA-256 hash, compared with crypto.timingSafeEqual, sent by the client in an Authorization: Bearer header. Admin link format: /admin/:eventId#t=<token> (the fragment is never sent to the server). Judge tokens are stored raw so the organizer can re-copy links, and are used in /judge/:token. The client saves admin links in localStorage ("My events" list on the home page) and warns the organizer to save the admin link.

## 5. Engine (server/src/engine): pure functions, no I/O, fully unit tested
Input rows: {judge, team, score}. Implement:
1. rawAverage: mean score per team.
2. zScore: per judge, z = (score - judgeMean) / judgeSD (use population SD). If a judge's SD is 0, set that judge's z to 0 and emit a warning. A team's z-score is the mean of its z-values.
3. judgeEffect model: score = teamQuality + judgeBias + noise. Initialize biases to 0, then alternate until max change < 1e-9 or 500 iterations: teamQuality = mean(score - bias) over the team's scores; judgeBias = mean(score - teamQuality) over the judge's scores; re-center biases to sum to 0. Return qualities, biases, iterations, converged.
4. connectivity: union-find or BFS over the judge-team bipartite graph. Return the components.
5. ranks: competition ranking (1,2,2,4), treating differences under 1e-9 as ties.
6. stability: for each judge, remove all of their scores and recompute the model ranking. Skip that removal (with a reason) if it disconnects the graph or leaves any team with no scores. Report each team's max rank shift across removals, whether the top 3 set is unchanged, and mark a team "stable" if its max shift <= 1.
7. analyze(rows) -> { teams: [{team, nScores, raw, rawRank, z, zRank, model, modelRank, shift, stable}], judges: [{judge, nScores, mean, sd, bias}], components, recommended: 'model' | 'zscore', warnings: [{code, severity, message}], stability }.
   recommended = 'model' when the graph is connected, else 'zscore'.
   Warning codes: DISCONNECTED, ZERO_VARIANCE_JUDGE, FEW_SCORES_PER_JUDGE (<3), SINGLE_JUDGE_TEAM, TOP_UNSTABLE, INCOMPLETE (event mode: missing scores), NOT_CONVERGED.
8. Assignment planner: given teams, judges, k. Shuffle the teams with a seeded RNG, then team i gets judges (i + j) mod J for j in 0..k-1 (sliding window). Constraints: 2 <= k <= J. If k = J it is "all". Verify the result is connected and per-judge load differs by at most 2, and fail loudly if not.
Also a seeded RNG (mulberry32) and a sample-data module: "Unlucky team" (12 teams, 6 judges, 3 judges per team, a strict judge sees the strongest teams and a lenient judge the weakest, built deterministically so the raw winner differs from the model winner, with a test asserting this) and "Disconnected" (two judge groups with no shared teams).

## 6. API (all JSON, consistent error shape {error:{code,message}})
- GET /api/health (also checks the DB connection).
- POST /api/analyze {rows} (stateless; max 5000 rows).
- POST /api/events (create; returns eventId, adminToken, judge links). POST /api/events/demo.
- Admin (Bearer token): GET /api/admin/:id (event + judge progress + analysis), POST /api/admin/:id/status {status} (validate transitions; 409 on invalid ones; moving to "scoring" generates assignments if missing), GET /api/admin/:id/export.csv.
- Judge: GET /api/judge/:token (event info, only that judge's assigned teams, only their own scores), PUT /api/judge/:token/scores/:teamId {value}. It is allowed only when status = scoring and the team is assigned. Validate the value is within [min,max] with up to 2 decimals.
- Public: GET /api/results/:id (only when status = published, otherwise 404).
Validate every input with zod. Never pass raw request objects into Mongo queries. Never leak the admin token hash or other judges' scores. Use helmet, a 100kb body limit, rate limiting (stricter on write routes), and a central error handler. Missing resources give 404, bad input 400, unauthorized 401/403, invalid state transitions 409, DB down 503.

## 7. UI routes
/ (home: create event, quick analyze, my events), /new, /analyze, /admin/:id, /judge/:token, /results/:id, and a 404 page. Every data-driven view handles loading, empty, success and error states. Use an error boundary. The judge page must work well at 360px width. Show clear messages when an event is locked ("Scoring is closed"), the link is invalid, or the network fails.

## 8. Milestones (commit after each with a clear message)
M1. Scaffold the repo, Express serving the React build, /api/health, .gitignore, .env.example, and root scripts. Verify `npm run build && NODE_ENV=production npm start` works.
M2. The engine with thorough unit tests (see section 9).
M3. POST /api/analyze, the Quick Analyze page, sample datasets, and ranking/diagnostics components.
M4. Mongoose models, create event, judge links, and the judge scoring page with autosave.
M5. Admin dashboard, status transitions, assignment planner, progress, polling, and CSV export.
M6. Public results page, demo event, and security and error-handling pass.
M7. Smoke test script, README, docs/ALGORITHM.md, and DEPLOY.md.

## 9. Testing (must pass before the final commit)
Engine unit tests: parsing and validation of rows; raw average against a hand-computed example; z-score with a zero-variance judge (no NaN); a noise-free test where scores are built from known team qualities and judge biases and the model must recover the qualities (up to a constant) with biases summing to 0; adding a constant to all scores doesn't change rankings; connectivity with one vs two components; stability skipping a disconnecting removal; ties in ranking; assignment planner balance and connectivity for several (T, J, k) combos; and a seeded simulation (many runs, known true quality) asserting the model's rank agreement with the truth is at least as good as raw average on average. API tests with supertest and mongodb-memory-server covering: create event, auth failures, a judge scoring outside the scale, scoring while locked, scoring an unassigned team, invalid status transitions, upsert not duplicating, and results hidden until published. If mongodb-memory-server cannot be installed, say so explicitly and fall back to unit tests only.
Also write `npm run smoke` (BASE_URL env, default http://localhost:PORT): it creates a demo-style event through the real API, submits scores as several judges, checks the analysis, locks, publishes, and fetches the public results, printing PASS/FAIL for each step. It must work against both local and the deployed URL.

## 10. Documentation (write these for real, no filler)
README.md with sections: Project Name, Problem Statement, Target Users, Solution, Key Features, Tech Stack, Architecture (include a diagram), Local Setup, Environment Variables, Testing, Deployment, Limitations and Honest Notes, Credits (list libraries). Limitations must state that bias correction needs judge overlap, that small samples give noisy estimates, that the model assumes additive judge bias, and that it supports a human decision and doesn't replace it. docs/ALGORITHM.md explains the three methods with a worked example. DEPLOY.md gives exact steps: create a MongoDB Atlas M0 cluster, a database user, and network access from anywhere, copy the connection string with a database name; deploy to Render as a Web Service with build `npm install && npm run build` and start `npm start`, env vars MONGODB_URI and NODE_ENV=production, health check path /api/health; note that the free tier sleeps and the first request can take about a minute; then run `BASE_URL=<live url> npm run smoke`.

## 11. Rules
- Install server and client dependencies properly, make `npm run dev` start both, and make `npm test` run everything.
- No secrets in git. Add .env to .gitignore and keep .env.example current.
- Meaningful, incremental commits (conventional style). Do not squash.
- Keep the code readable: small modules, clear names, comments only where the logic is non-obvious.
- Do not add features beyond this spec. If something is ambiguous, pick the simplest reasonable option and note it in the README.
- When finished, run the tests, the production build, the production start, and the smoke test locally, and paste the real outputs in your final report. List anything you could not verify (for example anything that needs my Atlas or Render accounts). Do not claim the app is deployed unless it actually is.
