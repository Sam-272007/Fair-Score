import { MongoMemoryServer } from '../server/node_modules/mongodb-memory-server/index.js';
import mongoose from '../server/node_modules/mongoose/index.js';
import { createApp } from '../server/src/app.js';
import { spawn } from 'node:child_process';

async function main() {
  console.log('[Smoke Runner] Starting in-memory MongoDB for local smoke test...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  const app = createApp();
  const PORT = 5055;
  const server = app.listen(PORT, async () => {
    console.log(`[Smoke Runner] Test server listening on http://localhost:${PORT}`);

    const smoke = spawn('node', ['scripts/smoke.js'], {
      env: { ...process.env, BASE_URL: `http://localhost:${PORT}` },
      stdio: 'inherit',
      shell: true
    });

    smoke.on('close', async (code) => {
      server.close();
      await mongoose.disconnect();
      await mongod.stop();
      process.exit(code);
    });
  });
}

main().catch((err) => {
  console.error('[Smoke Runner] Fatal error:', err);
  process.exit(1);
});
