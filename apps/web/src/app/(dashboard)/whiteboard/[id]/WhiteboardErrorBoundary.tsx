'use client';

import { Component, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, Copy, Check } from 'lucide-react';

interface State { error: Error | null; errorInfo: any }
interface Props { children: ReactNode }

/**
 * Faengt Render-Crashes im tldraw-Canvas ab. Zeigt vollen Stack im UI
 * damit der User den Fehler kopieren kann ohne in DevTools zu suchen.
 *
 * Ergaenzt durch GlobalErrorListener — der faengt auch Async-Fehler
 * (Promises, setTimeout, Event-Listener) ab. ErrorBoundary alleine
 * faengt nur Render-Errors.
 */
export class WhiteboardErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, info: any) {
    this.setState({ error, errorInfo: info });
    // eslint-disable-next-line no-console
    console.error('[WhiteboardErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorScreen
          title="Whiteboard konnte nicht geladen werden"
          subtitle="Ein Render-Fehler hat das Canvas abgebrochen"
          error={this.state.error}
          info={this.state.errorInfo}
          onRetry={() => { this.setState({ error: null, errorInfo: null }); window.location.reload(); }}
        />
      );
    }
    return (
      <>
        <GlobalErrorListener />
        {this.props.children}
      </>
    );
  }
}

/**
 * Faengt window.onerror und unhandledrejection ab. Diese Fehler werden
 * von React-ErrorBoundaries NICHT erwischt (z.B. crash im setTimeout
 * der Auto-Save-Loop, oder unhandled rejection im fetch).
 */
function GlobalErrorListener() {
  const [error, setError] = useState<{ message: string; stack?: string } | null>(null);

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      setError({ message: e.message, stack: e.error?.stack });
      // eslint-disable-next-line no-console
      console.error('[GlobalErrorListener] window.onerror', e);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const message = typeof reason === 'string' ? reason : reason?.message || String(reason);
      setError({ message, stack: reason?.stack });
      // eslint-disable-next-line no-console
      console.error('[GlobalErrorListener] unhandledrejection', e);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  if (!error) return null;

  // Kleines schwebendes Toast unten — der eigentliche Canvas bleibt
  // sichtbar, aber der User sieht den Fehler nicht erst nach dem
  // weiss-werden. Klick auf Schliessen → Toast weg.
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-lg w-[90vw] rounded-xl bg-red-600 dark:bg-red-700 text-white shadow-2xl px-4 py-3 animate-fade-in">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold mb-1">JavaScript-Fehler im Whiteboard</div>
          <pre className="text-[11px] font-mono break-all whitespace-pre-wrap opacity-90 max-h-40 overflow-y-auto">
            {error.message}
            {error.stack && '\n\n' + error.stack.split('\n').slice(0, 8).join('\n')}
          </pre>
        </div>
        <button
          onClick={() => setError(null)}
          className="flex-shrink-0 rounded p-1 hover:bg-white/20 transition-colors"
          title="Toast schliessen (Fehler bleibt in der Console)"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function ErrorScreen({
  title, subtitle, error, info, onRetry,
}: {
  title: string;
  subtitle: string;
  error: Error;
  info: any;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const fullText = [
    `Error: ${error.message}`,
    '',
    'Stack:',
    error.stack ?? '(no stack)',
    '',
    'Component-Stack:',
    info?.componentStack ?? '(no component stack)',
  ].join('\n');

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#fafafa] dark:bg-[#0c0e1c] p-6 overflow-y-auto">
      <div className="max-w-2xl w-full rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200 dark:border-white/10 p-8 my-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="font-display-serif text-lg font-medium text-gray-900 dark:text-white">
              {title}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
          </div>
        </div>
        <div className="relative">
          <pre className="text-[11px] text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-900/10 rounded-lg p-3 overflow-auto whitespace-pre-wrap break-all font-mono max-h-[50vh]">
            {fullText}
          </pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(fullText).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg bg-white dark:bg-[#1a1d2e] border border-gray-200 dark:border-white/10 px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300 shadow-sm hover:shadow-md transition-shadow"
          >
            {copied ? <><Check className="h-3 w-3 text-green-600" /> Kopiert</> : <><Copy className="h-3 w-3" /> Kopieren</>}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-5">
          <Link
            href="/whiteboard"
            className="inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Zurück zur Liste
          </Link>
          <button
            onClick={onRetry}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Neu laden
          </button>
        </div>
      </div>
    </div>
  );
}
