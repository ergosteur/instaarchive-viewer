/**
 * Build-time constants.
 *
 * This file deliberately has no imports or exports: that keeps it an ambient
 * script rather than a module, so the declarations below are global.
 */

/** Release version, injected by `define` in vite.config.ts. */
declare const __APP_VERSION__: string;
