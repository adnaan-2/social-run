import { Navigate, Outlet } from 'react-router-dom';
import { Footprints } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          gap: '24px',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '3px solid var(--glass-border)',
            borderTopColor: 'var(--accent-primary)',
            animation: 'spin-slow 1s linear infinite',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Footprints size={32} style={{ color: 'var(--accent-primary)' }} strokeWidth={1.5} />
          <span
            className="gradient-text"
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: -0.5,
              animation: 'pulse-opacity 2s ease-in-out infinite',
            }}
          >
            WalkStreak
          </span>
        </div>
        <style>{`
          @keyframes pulse-opacity {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
