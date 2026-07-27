import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/app/components/ui/button'
import { trackError } from '@/app/utils/telemetry'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  variant?: 'root' | 'view'
  context?: string
  onNavigateHome?: () => void
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

const CHUNK_ERROR_PATTERNS = [
  'dynamically imported module',
  'Importing a module script failed',
  'ChunkLoadError',
  'Failed to load module script',
]

function isChunkLoadError(error?: Error): boolean {
  if (!error) return false
  const text = `${error.name}: ${error.message}`
  return CHUNK_ERROR_PATTERNS.some(pattern => text.includes(pattern))
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
    trackError('ui_crash', this.props.context)
    if (window.logging) {
      window.logging.error('ErrorBoundary caught an error', 'ErrorBoundary', {
        context: this.props.context,
        message: error.message,
        error: error.toString(),
        componentStack: errorInfo.componentStack
      })
    } else {
      console.error('ErrorBoundary caught an error', this.props.context, error, errorInfo.componentStack)
    }
    this.setState({
      error,
      errorInfo
    })
  }

  handleReset = () => {
    if (isChunkLoadError(this.state.error)) {
      window.location.reload()
      return
    }
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const isView = this.props.variant === 'view'

      return (
        <div className="page-container">
          {!isView && <div className="nebula-bg" aria-hidden="true" />}
          <div className="page-content">
            <div className="glass-card">
              <h1 className="section-title">Something went wrong</h1>
              <p className="subtitle">
                An unexpected error occurred. Please try refreshing the application.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 p-4 bg-card/80 rounded text-left text-sm">
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
                {isView && this.props.onNavigateHome && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      this.props.onNavigateHome?.()
                      this.handleReset()
                    }}
                    className="enhanced-button"
                  >
                    Go Home
                  </Button>
                )}
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
