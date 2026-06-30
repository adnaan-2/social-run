import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Footprints, User, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ParticleField from '../components/ParticleField';

// Helper: load the Google Identity Services script once
function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      const check = setInterval(() => {
        if (window.google?.accounts?.id) { clearInterval(check); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(check); reject(new Error('Timeout loading Google script')); }, 5000);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      const check = setInterval(() => {
        if (window.google?.accounts?.id) { clearInterval(check); resolve(); }
      }, 50);
      setTimeout(() => { clearInterval(check); reject(new Error('Timeout')); }, 5000);
    };
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(script);
  });
}

const getPasswordStrength = (pwd) => {
  if (!pwd) return { level: 0, label: '', color: '', width: '0%' };
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasMixed = hasUpper && hasLower;

  if (pwd.length >= 8 && hasMixed && hasNumber) {
    return { level: 3, label: 'Strong', color: 'var(--success)', width: '100%' };
  } else if (pwd.length >= 6 && (hasMixed || hasNumber)) {
    return { level: 2, label: 'Medium', color: 'var(--warning)', width: '66%' };
  } else if (pwd.length > 0) {
    return { level: 1, label: 'Weak', color: 'var(--danger)', width: '33%' };
  }
  return { level: 0, label: '', color: '', width: '0%' };
};

export default function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleBtnRef = useRef(null);

  const { signup, googleLogin, error, setError, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    setError(null);
  }, []);

  const passwordStrength = getPasswordStrength(password);

  // Initialize Google Sign-In on mount — renders the real Google button
  const initGoogle = useCallback(async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') return;

    try {
      await loadGisScript();

      window.google.accounts.id.initialize({
        client_id: clientId,
        // Disable FedCM to avoid the 403 / NetworkError when FedCM is
        // blocked by browser settings or prior user dismissals.
        use_fedcm_for_prompt: false,
        callback: async (response) => {
          try {
            setGoogleLoading(true);
            await googleLogin(response.credential);
            navigate('/dashboard');
          } catch (err) {
            // error is set by context
          } finally {
            setGoogleLoading(false);
          }
        },
      });

      // Render the official Google button — this opens a reliable OAuth
      // popup on click without any FedCM dependency.
      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: googleBtnRef.current.offsetWidth || 360,
          text: 'continue_with',
          shape: 'pill',
        });
        setGoogleReady(true);
      }
    } catch (err) {
      console.warn('Google Sign-In init failed:', err);
    }
  }, [googleLogin, navigate]);

  useEffect(() => {
    initGoogle();
  }, [initGoogle]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signup(username, email, password);
      navigate('/dashboard');
    } catch (err) {
      // error is set by context
    } finally {
      setIsSubmitting(false);
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
      <ParticleField />
      {/* Background Orbs */}
      <div
        style={{
          position: 'absolute',
          top: -150,
          right: -150,
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'var(--accent-primary)',
          opacity: 0.06,
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
          background: 'var(--accent-secondary)',
          opacity: 0.06,
          filter: 'blur(120px)',
          animation: 'float 8s ease-in-out infinite',
          animationDelay: '4s',
          pointerEvents: 'none',
        }}
      />

      {/* Signup Card */}
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
            Start your walking journey today.
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
          {/* Username */}
          <div style={{ position: 'relative' }}>
            <User
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
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

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

          {/* Password Strength */}
          {password.length > 0 && (
            <div style={{ marginTop: -8 }}>
              <div
                style={{
                  height: 4,
                  background: 'var(--glass-border)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: passwordStrength.width,
                    background: passwordStrength.color,
                    borderRadius: 2,
                    transition: 'all 0.3s ease',
                  }}
                />
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: passwordStrength.color,
                  marginTop: 4,
                  textAlign: 'right',
                }}
              >
                {passwordStrength.label}
              </p>
            </div>
          )}

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
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

          {/* Google Sign-In — rendered by Google's GIS library */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              minHeight: 44,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {!googleReady && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 12,
                  border: '1px solid var(--glass-border)',
                  background: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  fontSize: 15,
                  fontWeight: 500,
                  color: '#3c4043',
                  opacity: 0.6,
                  zIndex: 2,
                }}
              >
                <Loader2 size={18} style={{ animation: 'spin-slow 1s linear infinite', color: '#3c4043' }} />
                Loading Google Sign-In...
              </div>
            )}
            <div
              ref={googleBtnRef}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
              }}
            />
          </div>

          {/* Loading overlay when Google auth is in progress */}
          {googleLoading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '8px 0',
                color: 'var(--text-secondary)',
                fontSize: 14,
              }}
            >
              <Loader2 size={16} style={{ animation: 'spin-slow 1s linear infinite' }} />
              Signing in with Google...
            </div>
          )}

          {/* Login Link */}
          <p
            style={{
              textAlign: 'center',
              fontSize: 14,
              color: 'var(--text-secondary)',
            }}
          >
            Already have an account?{' '}
            <Link
              to="/login"
              style={{
                color: 'var(--accent-primary)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
