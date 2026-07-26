import { setTimeout } from 'node:timers/promises';

export async function runWorker() {
  console.log('[worker] started', { id: process.env.WORKER_ID ?? 'worker-1' });

  // Phase 1B stub: keep process alive with a heartbeat.
  while (true) {
    console.log('[worker] heartbeat');
    await setTimeout(30_000);
  }
}
