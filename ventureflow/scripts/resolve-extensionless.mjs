// Node ESM resolver hook: the app's source uses extensionless relative
// imports ("./businessUpgrades"), which Vite resolves at build time but
// plain Node does not. This lets scripts/test-update.mjs import the REAL
// engine modules instead of a copy.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.js')) {
      return next(`${specifier}.js`, context);
    }
    throw err;
  }
}
