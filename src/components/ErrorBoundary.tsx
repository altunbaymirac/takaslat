import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

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
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      const isChunkError =
        this.state.error.message.includes('Failed to fetch dynamically imported module') ||
        this.state.error.message.includes('Importing a module script failed');

      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="text-5xl">{isChunkError ? '📦' : '⚠️'}</div>
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
