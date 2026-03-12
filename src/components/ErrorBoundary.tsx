import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8 gap-4">
          <p className="text-4xl">🚨</p>
          <p className="text-xl font-black text-red-400">Something went wrong</p>
          <pre className="text-xs text-gray-400 bg-gray-900 rounded-xl p-4 max-w-lg overflow-auto whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2 rounded-xl"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
