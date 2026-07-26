import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/app/components/ui/button'
import { trackError } from '@/app/utils/telemetry'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    trackError('ui_crash')
    if (window.logging) {
      window.logging.error('ErrorBoundary caught an error', 'ErrorBoundary', { error: error.toString(), componentStack: errorInfo.componentStack })
    } else {
      console.error('ErrorBoundary caught an error', error, errorInfo.componentStack)
    }
    this.setState({
      error,
      errorInfo
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="page-container">
          <div className="nebula-bg" aria-hidden="true" />
          <div className="page-content">
            <div className="glass-card">
              <h1 className="section-title">Something went wrong</h1>
              <p className="subtitle">
                An unexpected error occurred. Please try refreshing the application.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 p-4 bg-gray-800 rounded text-left text-sm">
                  <summary className="cursor-pointer mb-2 font-semibold">
                    Error Details (Development)
                  </summary>
                  <pre className="whitespace-pre-wrap text-red-400">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
              
              <div className="actions-section">
                <Button onClick={this.handleReset} className="enhanced-button">
                  Try Again
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => window.location.reload()}
                  className="enhanced-button"
                >
                  Reload App
                </Button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}