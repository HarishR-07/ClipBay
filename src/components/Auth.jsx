import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          email: data.user.email,
          username: username,
        })
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }

    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#14121C', color: '#F5F3FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '20px' }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '360px', background: '#1E1B2A', border: '2px solid #2E2A3F', borderRadius: '16px', padding: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
          {isSignUp ? 'Create account' : 'Welcome back'}
        </h1>
        <p style={{ color: '#9691A8', fontSize: '14px', marginBottom: '24px' }}>
          {isSignUp ? 'Sign up to start using Clip Bay' : 'Log in to continue'}
        </p>

        {isSignUp && (
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: '12px 14px', marginBottom: '12px', background: '#14121C', border: '2px solid #2E2A3F', borderRadius: '8px', color: '#F5F3FA', fontSize: '14px', boxSizing: 'border-box' }}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', padding: '12px 14px', marginBottom: '12px', background: '#14121C', border: '2px solid #2E2A3F', borderRadius: '8px', color: '#F5F3FA', fontSize: '14px', boxSizing: 'border-box' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={{ width: '100%', padding: '12px 14px', marginBottom: '16px', background: '#14121C', border: '2px solid #2E2A3F', borderRadius: '8px', color: '#F5F3FA', fontSize: '14px', boxSizing: 'border-box' }}
        />

        {error && <p style={{ color: '#FF5D8F', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '13px', background: 'linear-gradient(135deg, #FF5D8F, #FF9F45)', border: 'none', borderRadius: '8px', color: '#14121C', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
        >
          {loading ? 'Please wait...' : isSignUp ? 'Sign up' : 'Log in'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#9691A8' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <span onClick={() => setIsSignUp(!isSignUp)} style={{ color: '#4CC9FF', cursor: 'pointer' }}>
            {isSignUp ? 'Log in' : 'Sign up'}
          </span>
        </p>
      </form>
    </div>
    )
}

    



      
