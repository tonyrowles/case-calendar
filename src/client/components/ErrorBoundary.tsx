import React, { Component } from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Top-level error boundary. Catches runtime React errors that would otherwise
 * produce a blank white screen with no user feedback.
 * No extra dependencies — React's built-in class component boundary API.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-sm font-semibold text-foreground">Something went wrong.</p>
            <p className="text-sm text-muted-foreground">Refresh the page to continue.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
