# FairScore Deployment Guide

This guide describes the end-to-end production deployment process for **FairScore** using MongoDB Atlas (database) and Render (web service).

---

## 1. Database Setup: MongoDB Atlas (Free Tier M0)

1. **Sign in / Create Account:**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and log in or create a free account.
2. **Create Cluster:**
   - Select **Create a Deployment** and choose the **M0 Free** shared cluster tier.
   - Choose a cloud provider and region closest to your users.
3. **Configure Database Access:**
   - Under **Security > Database Access**, click **Add New Database User**.
   - Authentication Method: **Password**.
   - Create a username and a strong password (save these securely).
   - Database User Privileges: **Read and write to any database** (Atlas admin or `readWriteAnyDatabase`).
4. **Configure Network Access:**
   - Under **Security > Network Access**, click **Add IP Address**.
   - Select **Allow Access from Anywhere** (`0.0.0.0/0`). This allows Render's cloud servers to connect to the database.
5. **Obtain Connection String:**
   - Go to **Deployments > Database**, click **Connect**.
   - Select **Drivers** (Node.js).
   - Copy the connection URI:
     ```text
     mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/fairscore?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with your database user credentials.
   - Make sure to append the database name `/fairscore` before the `?` query parameters.

---

## 2. Web Service Deployment: Render

FairScore runs as a unified single-origin service on Render where Express serves the static React build alongside the `/api` routes.

1. **Connect Repository:**
   - Go to the [Render Dashboard](https://dashboard.render.com/) and click **New > Web Service**.
   - Connect your GitHub repository (`Fair_Score`).
2. **Configure Service Settings:**
   - **Name:** `fairscore` (or your choice)
   - **Environment:** `Node`
   - **Branch:** `master` (or `main`)
   - **Region:** Choose the region matching your Atlas cluster.
   - **Build Command:**
     ```bash
     npm install && npm --prefix client install && npm --prefix server install && npm run build
     ```
   - **Start Command:**
     ```bash
     npm start
     ```
   - **Plan Type:** `Free`
3. **Health Check Path:**
   - Expand **Advanced Settings**.
   - Set **Health Check Path** to `/api/health`.
4. **Environment Variables:**
   - Under the **Environment Variables** section, add:
     - `NODE_ENV`: `production`
     - `MONGODB_URI`: `<your MongoDB Atlas connection string from Step 1>`
5. **Deploy:**
   - Click **Create Web Service**.
   - Render will clone the repository, install dependencies, build the client Vite bundle into `client/dist`, and start the Express production server.

> [!NOTE]
> **Free Tier Sleep Behavior:** Render's free tier spins down web services after 15 minutes of inactivity. When a new request arrives, a cold start can take approximately 50-70 seconds while the container initializes. Once awake, performance returns to normal.

---

## 3. Post-Deployment Verification (Smoke Test)

Once Render reports that your deployment is live, verify the live deployment using the automated end-to-end smoke test script:

```bash
BASE_URL=https://your-service-name.onrender.com npm run smoke
```

The script will automatically execute:
1. `GET /api/health` — Verifies HTTP 200 and live Atlas database connectivity.
2. `POST /api/events` — Creates a real event and generates capability tokens.
3. `POST /api/admin/:id/status` — Transitions status to `scoring`.
4. `PUT /api/judge/:token/scores/:teamId` — Submits real scores across judges.
5. `GET /api/admin/:id` — Checks the dashboard and bias-corrected analysis.
6. `POST /api/admin/:id/status` — Locks scoring.
7. `GET /api/results/:id` — Verifies public results return 404 while locked.
8. `POST /api/admin/:id/status` — Publishes the event.
9. `GET /api/results/:id` — Verifies official published rankings and methodology notes.
10. `POST /api/analyze` — Verifies stateless CSV analysis.

Every step will print `[PASS]` upon successful execution.
