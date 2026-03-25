import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { adminLogin, adminVerify } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

type Step = 'credentials' | 'code';

export function AdminLogin() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await adminLogin(identifier, password);
      if (result.requiresCode) {
        setStep('code');
      } else if (result.accessToken) {
        setAuth(result.accessToken, 'Admin', null, null, result.mustChangePassword === true);
        const redirectTo = searchParams.get('redirect') ?? '/admin';
        navigate(redirectTo, { replace: true });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await adminVerify(identifier, code);
      setAuth(data.accessToken, 'Admin', null, null, data.mustChangePassword === true);
      const redirectTo = searchParams.get('redirect') ?? '/admin';
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-back-link">
          Back to home
        </Link>
        <h1 className="auth-title">Photobooth Admin</h1>

        {step === 'credentials' ? (
          <form onSubmit={handleCredentials} className="auth-form">
            <h2>Admin Login</h2>
            <p className="auth-subtitle">Use your admin identifier and password.</p>
            <p className="auth-hint">
              If this is the very first bootstrap admin, the default credentials are <strong>Admin</strong> / <strong>Admin</strong>.
            </p>
            <label>
              Admin identifier
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Checking…' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCode} className="auth-form">
            <h2>Verification Code</h2>
            <p className="auth-subtitle">
              A 6-digit code was sent to your admin e-mail. Enter it below. It expires in 10 minutes.
            </p>
            <label>
              6-digit code
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                autoComplete="one-time-code"
                className="auth-otp-input"
              />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Verifying…' : 'Log in'}
            </button>
            <button
              type="button"
              className="btn btn-ghost w-full"
              onClick={() => {
                setStep('credentials');
                setCode('');
                setError('');
              }}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
