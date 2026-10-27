import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container" style={{ padding: '4rem 1.25rem', maxWidth: '600px', textAlign: 'center' }}>
          <div className="alert alert-danger" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Something Went Wrong</h2>
            <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem', color: '#fee2e2' }}>
              {this.state.error?.message || 'An unexpected client application error occurred.'}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
            >
              Return to FairScore Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
