/**
 * ErrorBoundary.tsx — NawwatOS
 * Catches any runtime error in a child component tree and renders a
 * user-friendly recovery UI instead of a blank screen.
 */
import React, { Component, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
    hasError: boolean;
    error: Error | null;
}

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    pathname?: string;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.pathname !== this.props.pathname && this.state.hasError) {
            this.setState({ hasError: false, error: null });
        }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
        // TODO: supabase.from('error_logs').insert({ message: error.message, stack: info.componentStack })
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? (
                <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <AlertTriangle size={32} className="text-red-400" />
                    </div>
                    <div>
                        <h2 className="font-nunito font-black text-white text-xl mb-2">
                            حدث خطأ غير متوقع
                        </h2>
                        <p className="text-content-3 text-sm max-w-md leading-relaxed">
                            {this.state.error?.message ?? 'An unexpected error occurred in this module.'}
                        </p>
                    </div>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="flex items-center gap-2 bg-cyan text-midnight font-bold px-6 py-2.5 rounded-xl hover:scale-105 transition-transform shadow-[0_0_15px_rgba(0,229,255,0.2)]"
                    >
                        <RefreshCw size={16} /> إعادة المحاولة
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
