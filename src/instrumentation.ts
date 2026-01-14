/**
 * Next.js Instrumentation
 * 在服务启动时初始化服务
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeProviders } = await import('@/lib/providers');

    console.info('[Instrumentation] Initializing ONE Engine services...');

    // Initialize Provider Hub
    initializeProviders();

    console.info('[Instrumentation] ONE Engine services initialized');
  }
}
