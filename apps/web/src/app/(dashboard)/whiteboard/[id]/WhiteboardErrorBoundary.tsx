'use client';

import { Component, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';

interface State { error: Error | null }
interface Props { children: ReactNode }

/**
 * Faengt Render-Crashes im tldraw-Canvas ab. Ohne diese Boundary zeigt
 * Next.js bei einem React-Error einen weissen Bildschirm — der User
 * weiss nicht ob der Browser haengt oder Code crasht. Mit Boundary sehen
 * wir die Fehlermeldung + Stack und koennen zurueck navigieren.
 */
export class WhiteboardErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    // Persistiert in Browser-Console damit ich den Stack sehen kann.
    // eslint-disable-next-line no-console
    console.error('[WhiteboardErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-[#fafafa] dark:bg-[#0c0e1c] p-6">
          <div className="max-w-lg w-full rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200 dark:border-white/10 p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="font-display-serif text-lg font-medium text-gray-900 dark:text-white">
                  Whiteboard konnte nicht geladen werden
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Ein Render-Fehler hat das Canvas abgebrochen
                </p>
              </div>
            </div>
            <pre className="text-xs text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono">
              {this.state.error.message}
            </pre>
            <div className="flex items-center gap-2 mt-5">
              <Link
                href="/whiteboard"
                className="inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Zurück zur Liste
              </Link>
              <button
                onClick={() => { this.setState({ error: null }); window.location.reload(); }}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Neu laden
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
