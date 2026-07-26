import { setTimeout } from 'node:timers/promises';

export async function runScheduler() {
  console.log('[scheduler] started');

  // Phase 1B stub: keep process alive with a heartbeat.
  while (true) {
    console.log('[scheduler] heartbeat');
    await setTimeout(60_000);
  }
}
