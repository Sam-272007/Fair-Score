import { createApp } from '../server/src/app.js';
import http from 'node:http';

async function testM1() {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(5099, resolve));
  console.log('Test server listening on port 5099');

  try {
    // 1. Test /api/health
    const healthRes = await fetch('http://localhost:5099/api/health');
    const healthBody = await healthRes.json();
    console.log('Health check status:', healthRes.status, healthBody);
    // When DB is disconnected, health check returns 503 with degraded status
    if (healthRes.status !== 503 && healthRes.status !== 200) {
      throw new Error(`Unexpected health status: ${healthRes.status}`);
    }

    // 2. Test SPA index serving
    const spaRes = await fetch('http://localhost:5099/');
    const spaHtml = await spaRes.text();
    console.log('SPA response status:', spaRes.status, 'HTML contains root div:', spaHtml.includes('id="root"'));
    if (spaRes.status !== 200 || !spaHtml.includes('id="root"')) {
      throw new Error('SPA did not serve index.html properly');
    }

    console.log('M1 verification passed successfully!');
  } finally {
    server.close();
  }
}

testM1().catch((err) => {
  console.error('M1 verification failed:', err);
  process.exit(1);
});
