import { Component } from 'react'

// Error boundaries have to be class components — React doesn't yet offer a
// hooks equivalent for catching render-time errors in child components.
// This does NOT catch errors inside async callbacks (e.g. a failed fetch in
// an onClick handler) — those are already handled by each function's own
// try/catch + friendlyError(). This is specifically for unexpected render
// crashes, which otherwise leave the user on a blank white screen.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#14121C', color: '#F5F3FA', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ maxWidth: '360px', textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px' }}>Something went wrong</div>
            <div style={{ fontSize: '13px', color: '#9691A8', marginBottom: '20px' }}>
              Clip Bay ran into an unexpected error. Your work up to your last save should still be there.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #FF5D8F, #FF9F45)', border: 'none', borderRadius: '8px', color: '#14121C', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              Reload the app
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
