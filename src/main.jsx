import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('App crash:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#F2F2F7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: '-apple-system, Helvetica Neue, sans-serif' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', marginBottom: 8, textAlign: 'center' }}>Quelque chose s'est mal passé</div>
          <div style={{ fontSize: 14, color: '#8E8E93', marginBottom: 24, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>L'app a rencontré une erreur inattendue.</div>
          <button onClick={() => window.location.reload()} style={{ padding: '14px 28px', borderRadius: 99, border: 'none', background: '#FC4C02', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Recharger l'app
          </button>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12, padding: '10px 20px', borderRadius: 99, border: '1px solid #E5E5EA', background: 'transparent', color: '#8E8E93', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Réessayer sans recharger
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
