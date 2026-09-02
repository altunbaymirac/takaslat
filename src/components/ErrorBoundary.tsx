import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { reportError } from '../lib/monitoring';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    reportError(error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      const isChunkError =
        this.state.error.message.includes('Failed to fetch dynamically imported module') ||
        this.state.error.message.includes('Importing a module script failed');

      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374L10.052 3.38c.866-1.5 3.03-1.5 3.896 0l7.355 12.746zM12 16.5h.008v.008H12V16.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {isChunkError ? 'Güncelleme gerekiyor' : 'Bir şeyler yanlış gitti'}
          </h2>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {isChunkError
              ? 'Uygulama güncellendi. Sayfayı yenileyerek devam edebilirsin.'
              : this.state.error.message}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                this.setState({ error: null });
                if (isChunkError) window.location.reload();
              }}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {isChunkError ? 'Yenile' : 'Tekrar Dene'}
            </button>
            <Link
              to="/"
              onClick={() => this.setState({ error: null })}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Ana Sayfa
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
