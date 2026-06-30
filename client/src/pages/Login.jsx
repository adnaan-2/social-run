import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Footprints, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleInitialized = useRef(false);

  const { login, googleLogin, error, setError, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    setError(null);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(email, password, rememberMe);
      navigate('/');
    } catch (err) {
      // error is set by context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      setError('Google Client ID is not configured. Add your ID to client/.env.local');
      return;
    }

    try {
      setGoogleLoading(true);
      setError(null);

      // Load the GIS script if not yet loaded
      if (!window.google?.accounts?.id) {
        await new Promise((resolve, reject) => {
          if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
            const check = setInterval(() => {
              if (window.google?.accounts?.id) { clearInterval(check); resolve(); }
            }, 100);
            setTimeout(() => { clearInterval(check); reject(new Error('Timeout')); }, 5000);
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
          document.head.appendChild(script);
        });
      }

      // Only initialize once
      if (!googleInitialized.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          use_fedcm_for_prompt: true,
          callback: async (response) => {
            try {
              await googleLogin(response.credential);
              navigate('/dashboard');
            } catch (err) {
              // error is set by context
            } finally {
              setGoogleLoading(false);
            }
          },
        });
        googleInitialized.current = true;
      }

      // Trigger the prompt
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setGoogleLoading(false);
        }
      });
    } catch (err) {
      setError('Failed to initialize Google Sign-In');
      setGoogleLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: 20,
      }}
    >
      {/* Background Orbs */}
      <div
        style={{
          position: 'absolute',
          top: -150,
          right: -150,
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: '#0F5132',
          opacity: 0.08,
          filter: 'blur(120px)',
          animation: 'float 8s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -150,
          left: -150,
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: '#198754',
          opacity: 0.08,
          filter: 'blur(120px)',
          animation: 'float 8s ease-in-out infinite',
          animationDelay: '4s',
          pointerEvents: 'none',
        }}
      />

      {/* Login Card */}
      <div
        className="glass-card"
        style={{
          maxWidth: 440,
          width: '100%',
          padding: 40,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Footprints
            size={48}
            style={{ color: 'var(--accent-primary)', marginBottom: 12 }}
            strokeWidth={1.5}
          />
          <h1
            className="gradient-text"
            style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1 }}
          >
            WalkStreak
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: 14,
              marginTop: 8,
            }}
          >
            Track your walks. Build your streak. Walk together.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 20,
              color: 'var(--danger)',
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {/* Email */}
          <div style={{ position: 'relative' }}>
            <Mail
              size={18}
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              className="input-field"
              style={{ paddingLeft: 42 }}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div style={{ position: 'relative' }}>
            <Lock
              size={18}
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              className="input-field"
              style={{ paddingLeft: 42, paddingRight: 48 }}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 0,
                display: 'flex',
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Remember Me */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              onClick={() => setRememberMe(!rememberMe)}
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                border: `2px solid ${rememberMe ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                background: rememberMe ? 'var(--accent-primary)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {rememberMe && (
                <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</span>
              )}
            </div>
            <span
              onClick={() => setRememberMe(!rememberMe)}
              style={{
                color: 'var(--text-secondary)',
                fontSize: 14,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              Remember me
            </span>
          </div>

          {/* Submit */}
          <button
            className="btn-primary"
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              fontSize: 16,
              padding: '14px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} style={{ animation: 'spin-slow 1s linear infinite' }} />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          {/* Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <hr
              style={{
                flex: 1,
                border: 'none',
                borderTop: '1px solid var(--glass-border)',
              }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>or</span>
            <hr
              style={{
                flex: 1,
                border: 'none',
                borderTop: '1px solid var(--glass-border)',
              }}
            />
          </div>

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            style={{
              width: '100%',
              padding: '12px 28px',
              borderRadius: 12,
              border: '1px solid var(--glass-border)',
              background: 'white',
              cursor: googleLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              fontSize: 15,
              fontWeight: 500,
              fontFamily: 'inherit',
              color: '#3c4043',
              transition: 'all 0.2s ease',
              opacity: googleLoading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!googleLoading) {
                e.currentTarget.style.border = '1px solid #d2e3fc';
                e.currentTarget.style.background = '#f8faff';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.border = '1px solid var(--glass-border)';
              e.currentTarget.style.background = 'white';
            }}
          >
            {googleLoading ? (
              <Loader2 size={20} style={{ animation: 'spin-slow 1s linear infinite', color: '#3c4043' }} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
            )}
            Continue with Google
          </button>

          {/* Signup Link */}
          <p
            style={{
              textAlign: 'center',
              fontSize: 14,
              color: 'var(--text-secondary)',
            }}
          >
            Don't have an account?{' '}
            <Link
              to="/signup"
              style={{
                color: 'var(--accent-primary)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
