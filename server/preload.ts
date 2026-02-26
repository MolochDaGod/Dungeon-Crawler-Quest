process.on('SIGHUP', () => {
  console.log('[preload] SIGHUP received — ignoring');
});

process.on('uncaughtException', (err) => {
  if (err.message?.includes('service is no longer running')) {
    console.log('[preload] esbuild service crash caught — continuing');
    return;
  }
  console.error('[preload] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason: any) => {
  if (reason?.message?.includes('service is no longer running')) {
    console.log('[preload] esbuild rejection caught — continuing');
    return;
  }
  console.error('[preload] Unhandled rejection:', reason);
});
