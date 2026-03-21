import React, { Component, ErrorInfo } from 'react';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    pathname?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    componentDidUpdate(prevProps: Props) {
        if (prevProps.pathname !== this.props.pathname && this.state.hasError) {
            this.setState({ hasError: false, error: null });
        }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <h2>Unexpected Error Occurred.</h2>
                    <p>{this.state.error?.message}</p>
                    <button onClick={() => this.setState({ hasError: false, error: null })}>
                        Try Again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
