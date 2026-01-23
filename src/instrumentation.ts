/**
 * Next.js Instrumentation
 * 在服务启动时初始化服务
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeProviders } = await import('@/lib/providers');
    const { startWorkers } = await import('@/workers');

    console.info('[Instrumentation] Initializing ONE Engine services...');

    // Initialize Provider Hub
    initializeProviders();

    // Start background workers (AI strategy, PnL settlement, data sync)
    startWorkers();

    console.info('[Instrumentation] ONE Engine services initialized');
  }
}
