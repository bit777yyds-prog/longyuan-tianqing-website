import { runWorker } from './worker.js';
import { runScheduler } from './scheduler.js';

const role = process.env.APP_ROLE ?? 'worker';

async function main() {
  if (role === 'scheduler') {
    await runScheduler();
  } else {
    await runWorker();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
