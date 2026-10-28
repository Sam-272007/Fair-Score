# FairScore

> **Explainable bias-corrected ranking, judge overlap planning, and reliability diagnostics for hackathons and scored events.**

[![FairScore CI](https://github.com/Sam-272007/Fair-Score/actions/workflows/ci.yml/badge.svg)](https://github.com/Sam-272007/Fair-Score/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)

---

## 1. Problem Statement

In hackathons, college symposiums, pitch competitions, and capstone project reviews, it is practically impossible for every judge to evaluate every single team. Organizers partition teams among available judges.

When scoring subsets overlap incompletely:
- **Judge Severity Bias:** A harsh judge might score between 5.0 and 7.0, while a lenient judge awards between 8.0 and 9.5.
- **Luck of the Draw:** A stellar team that happens to draw strict judges will receive a lower raw average than a mediocre team evaluated by lenient judges.
- **Hidden Instability:** Organizers have had no automated way to know when an evaluation graph is mathematically disconnected or when a top-3 podium standing hinges precariously on a single judge's opinion.

---

## 2. Target Users

1. **Event Organizers (Primary):** Hackathon leads, university faculty, capstone coordinators, and demo-day hosts who need fair, defensible rankings and overlap planning.
2. **Judges & Evaluators (Secondary):** Industry mentors and academic reviewers who need a frictionless, mobile-first scoring interface without password barriers.

---

## 3. Solution

FairScore provides a complete end-to-end judging workflow application:
1. **Overlap Planning:** Mathematically schedules judge-to-team assignments so that judges overlap with balanced workloads and guaranteed graph connectivity.
2. **Mobile Capability Links:** Generates secure capability links for judges to submit scores with automatic background saving.
3. **Multi-Model Dashboard:** Computes Raw Averages, Z-Scores, and Iterative Judge-Effect Normalization side by side.
4. **Diagnostic Integrity Alerts:** Proactively warns when the evaluation graph is disconnected or when small sample sizes degrade mathematical certainty.
5. **Leave-One-Out Sensitivity Testing:** Tests rank resilience by systematically omitting judges to detect volatile rankings.
6. **Public Results Publication:** Generates an official, public-facing results page with plain-language methodology explanations.

---

## 4. Key Features

- **Three Comparative Methods Side-by-Side:** Raw Arithmetic Mean, Standardized Z-Score Normalization, and Alternating Least-Squares Judge-Effect Model.
- **Zero-Login Capability Auth:** Organizers and judges access events via cryptographic capability URLs without password fatigue.
- **Mobile-First Judge Scoring:** Responsive down to 360px viewport width with debounced per-row autosave, retry handling, and progress feedback.
- **Diverging CSS Judge Harshness Visualizer:** Plain CSS bar charts showing relative judge strictness centered at zero.
- **Bipartite Graph Connectivity Engine:** BFS verification over judge-team scoring pairs with automatic fallback recommendation to Z-scores when disconnected.
- **Podium & Team Stability Panels:** Leave-one-out sensitivity analysis flagging volatile rankings.
- **Stateless Quick Analyze:** Drag-and-drop or paste CSV scoring datasets for instant evaluation with pre-loaded sample datasets.
- **Instant Demo Event Generator:** Creates a populated 12-team, 6-judge demonstration event in one click.

---

## 5. Honest Differentiation

> *Per-judge normalization already exists in some paid judging platforms. FairScore is free, explains the correction, plans judge overlap, and warns when the data cannot support a reliable correction.*

---

## 6. Tech Stack

- **Runtime & Architecture:** Node.js 20+ (ES Modules throughout).
- **Frontend:** React 19, Vite 6, React Router 7, PapaParse.
- **Styling:** Handcrafted CSS with CSS variables, responsive design, focus accessibility, and plain CSS charts (no heavy UI frameworks).
- **Backend:** Express 4, Mongoose 8, Zod, Helmet, Express Rate Limit, Dotenv.
- **Testing:** Node.js built-in `node:test` runner, Vitest for frontend calculation engines, Supertest, and MongoMemoryServer for in-memory integration testing.
- **Database:** MongoDB Atlas (M0 Free Tier) with compound uniqueness constraints.

---

## 7. Architecture

### System Architecture Diagram

```mermaid
flowchart TD
    subgraph Client ["Client (React + Vite SPA)"]
        UI["UI Pages: Home, Create, Admin, Judge, Results, QuickAnalyze"]
        EngCl["Pure Calculation Engines (lib/analyze.js)"]
        AutoSave["Autosave (Judge) & Polling (Admin 10s)"]
    end

    subgraph Server ["Server (Express + Mongoose)"]
        Router["/api Routes (Helmet + RateLimiter + 100kb body)"]
        AuthMiddleware["Capability Auth (crypto.timingSafeEqual)"]
        Controller["Event & Scoring Controller"]
        EngSrv["Server Engine (engine/analyze.js)"]
    end

    subgraph Database ["MongoDB Database"]
        EventsCol[("events Collection\n(embedded teams & judges)")]
        ScoresCol[("scores Collection\n(unique compound index:\neventId + judgeId + teamId)")]
    end

    UI -->|HTTP / JSON| Router
    Router --> AuthMiddleware
    AuthMiddleware --> Controller
    Controller --> EngSrv
    Controller --> EventsCol
    Controller -->|Upsert Writes| ScoresCol
    EngCl -.->|Stateless Instant Eval| UI
```

### Security & Capability Link Model

FairScore utilizes a passwordless capability URL security model:
- **Capability Tokens:** Generated using `crypto.randomBytes(24).toString('base64url')`.
- **Organizer Admin Link:** Formatted as `/admin/:eventId#t=<token>`.
  - The secret token resides in the URL fragment (`#t=...`), which browsers **never send to the server** in HTTP requests.
  - The client reads the fragment and sends it in the `Authorization: Bearer <token>` header.
  - The server stores only the **SHA-256 hash** of the admin token and compares incoming requests using constant-time `crypto.timingSafeEqual` to eliminate timing side-channel attacks.
  - Admin links are cached in local browser storage (`localStorage`) under "My Events".
- **Judge Links:** Formatted as `/judge/:token`. Judge tokens are stored raw so organizers can re-copy and distribute links. Each judge can only view and score their assigned teams.
- **Idempotent Upserts:** Scores use a compound unique index on `(eventId, judgeId, teamId)` to ensure re-submissions update rather than duplicate.

---

## 8. Local Setup

### Prerequisites
- Node.js 20.x or higher
- npm 10.x or higher

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Sam-272007/Fair-Score.git
cd Fair-Score

# 2. Install dependencies across root, server, and client packages
npm install
npm --prefix client install
npm --prefix server install

# 3. Create environment configuration
cp .env.example .env
```

### Running Locally

```bash
# Development mode (runs Vite client on :5173 with proxy to Express server on :5000)
npm run dev

# Production build and run
npm run build
npm start
```
Open your browser at `http://localhost:5000`.

---

## 9. Environment Variables

Configure your `.env` file (copied from `.env.example`):

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | HTTP server port | `5000` |
| `NODE_ENV` | Application environment (`development`, `production`, `test`) | `development` |
| `MONGODB_URI` | MongoDB Atlas or local connection string | *Optional in dev/test* |

---

## 10. Testing

FairScore includes comprehensive automated tests (33 passing tests total) across calculation engines, API endpoints, and graph simulations:

- **Client Tests (Vitest):** 19 tests in `client/tests/engine.test.js` covering CSV parsing, score validation, raw averaging, z-scores, judge-effect model convergence, bipartite connectivity, ranking ties, assignment planner balance, and seeded Monte Carlo simulation.
- **Server API Tests (`node:test` + Supertest):** 7 integration tests in `server/tests/api.test.js` using in-memory MongoDB verifying health checks, event creation, capability auth, invalid status transitions, judge scoring bounds, unassigned/locked scoring rejection, upsert idempotency, and public results visibility.
- **Server Engine Tests (`node:test`):** 7 unit tests in `server/tests/engine.test.js` verifying server-side engine parity, zero-variance handling, and sample datasets.

```bash
# Run all tests across client and server (33 tests)
npm test

# Run client calculation engine tests with Vitest (19 tests)
npm run test:client

# Run server node:test integration and engine suite (14 tests)
npm run test:server

# Run the 10-step end-to-end smoke test suite
npm run smoke
```

### Smoke Test Output Sample
```text
======================================================
🚀 Starting FairScore End-to-End Smoke Test
🎯 Target Base URL: http://localhost:5000
======================================================

[PASS] Step 1: Health Check (/api/health) (HTTP 200, DB: connected)
[PASS] Step 2: Create Event (POST /api/events) (Event ID: 6ae1d77b43cccdebb4b1761e)
[PASS] Step 3: Open Scoring (setup -> scoring) 
[PASS] Step 4: Submit Judge Scores (PUT /api/judge/:token/scores/:teamId) (9 scores recorded)
[PASS] Step 5: Admin Dashboard & Analysis (GET /api/admin/:id) (Model Winner: Team Pegasus)
[PASS] Step 6: Lock Event (scoring -> locked) 
[PASS] Step 7: Results Hidden Until Published (GET /api/results/:id -> 404) (HTTP 404)
[PASS] Step 8: Publish Event (locked -> published) 
[PASS] Step 9: Fetch Public Results (GET /api/results/:id -> 200) (1st place: Team Pegasus)
[PASS] Step 10: Stateless Quick Analyze (POST /api/analyze) (Teams: 2)

======================================================
📊 Smoke Test Summary: 10 / 10 passed
======================================================

✅ ALL SMOKE TEST STEPS PASSED SUCCESSFULLY!
```

---

## 11. Deployment

See [DEPLOY.md](DEPLOY.md) for full instructions on deploying to **MongoDB Atlas** and **Render**.

### Quick Deployment Summary:
1. Create a free **MongoDB Atlas M0** cluster and allow network access from `0.0.0.0/0`.
2. Connect your Git repository to **Render** as a **Web Service**.
3. Set build command: `npm install --include=dev && npm --prefix client install --include=dev && npm --prefix server install --include=dev && npm run build`
4. Set start command: `npm start`
5. Configure environment variables: `NODE_ENV=production` and `MONGODB_URI=<your-atlas-uri>`.
6. Run `BASE_URL=<render-url> npm run smoke` to verify live operation.

---

## 12. Limitations & Honest Notes

- **Requires Judge Overlap:** The additive judge-effect model requires overlapping judges between teams. If an event has disconnected judging groups with no shared judges, mathematical cross-calibration is impossible. In this scenario, FairScore warns the organizer and falls back to Z-score normalization.
- **Small Sample Variability:** If a judge scores fewer than 3 teams, estimates of their personal strictness or variance are noisy. FairScore flags low sample sizes with diagnostic warnings.
- **Additive Assumption:** The model assumes an additive relationship: $\text{Score} = \text{Quality} + \text{Bias} + \text{Noise}$. It does not model non-linear judge behavior or criteria interactions.
- **Supports, Does Not Replace, Human Decisions:** FairScore is a quantitative decision-support tool. It provides visibility into scoring anomalies and rank shifts to assist organizers, committee chairs, and judges in making fair and transparent decisions.

---

## 13. Credits & Libraries

- **Express**: Lightweight web server and middleware routing.
- **Mongoose**: MongoDB object modeling and validation.
- **Zod**: Declarative runtime schema validation.
- **Helmet**: Essential HTTP security headers.
- **Express Rate Limit**: API abuse protection and write rate limiting.
- **React & Vite**: Modern reactive UI and bundle pipeline.
- **PapaParse**: Reliable client-side CSV parsing.
- **Vitest & Node:Test**: Modern testing frameworks.
- **Supertest & MongoMemoryServer**: Zero-setup integration testing.