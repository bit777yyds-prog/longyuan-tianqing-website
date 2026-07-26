// Simple process healthcheck for Docker.
// In Phase 1B this only verifies the process is alive.
console.log(JSON.stringify({ status: 'ok', role: process.env.APP_ROLE ?? 'unknown' }));
