import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props { children: React.ReactNode }
interface State { error: Error | null }

/**
 * Keeps one bad archive item from blanking the whole app.
 *
 * Post data is derived from filenames and arbitrary archive JSON, so a single
 * malformed record used to be able to throw during render and take the entire
 * tree down with it.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Render failed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-50 text-red-500 flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-xl font-semibold text-black/80">Something went wrong</h2>
          <p className="text-sm text-gray-500">
            This archive could not be rendered. Reloading usually clears it; if it
            persists, clear the cached copy from the archive explorer.
          </p>
          <pre className="text-[11px] text-left text-gray-400 bg-gray-50 rounded-lg p-3 overflow-x-auto">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
