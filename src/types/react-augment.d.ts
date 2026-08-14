import 'react';

declare module 'react' {
  interface InputHTMLAttributes<T> {
    /**
     * Non-standard attribute that makes a file input select a whole directory.
     * Supported in Chromium and WebKit; used as the fallback picker where the
     * File System Access API is unavailable.
     */
    webkitdirectory?: string;
  }
}
