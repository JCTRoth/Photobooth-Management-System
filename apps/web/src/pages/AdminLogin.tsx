import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { adminLogin, adminVerify } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

type Step = 'credentials' | 'code';

export function AdminLogin() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const resetState = searchParams.get('reset');

  const identifierState =
    identifier.trim().length === 0 ? '' : identifier.trim().length >= 3 ? 'is-valid' : 'is-attention';
  const passwordState = password.length === 0 ? '' : password.length >= 5 ? 'is-valid' : 'is-attention';
  const codeState = code.length === 0 ? '' : code.length === 6 ? 'is-valid' : 'is-attention';

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
    <div className="auth-page admin-login-page">
      <div className="admin-login-shell">
        <section className="admin-login-aside">
          <Link to="/" className="auth-back-link">
            Back to home
          </Link>
          <p className="auth-kicker">Admin access</p>
          <h1 className="admin-login-hero">Control events, devices, galleries, and delivery from one place.</h1>
          <p className="admin-login-lead">
            This is the operations portal for booth provisioning, event management, SMTP verification, and public
            slideshow setup.
          </p>

          <div className="admin-login-feature-list">
            <div className="admin-login-feature-card">
              <strong>Event orchestration</strong>
              <p>Manage weddings, upload links, retention, and slideshow albums without leaving the dashboard.</p>
            </div>
            <div className="admin-login-feature-card">
              <strong>Device control</strong>
              <p>Provision signed booth clients, assign events, and monitor heartbeat health in real time.</p>
            </div>
            <div className="admin-login-feature-card">
              <strong>Secure verification</strong>
              <p>OTP verification activates automatically once SMTP is configured, keeping admin access tightly scoped.</p>
            </div>
          </div>

          <div className="admin-login-note-card">
            <span>Bootstrap note</span>
            <p>
              On a fresh system, the first temporary admin is <strong>Admin</strong> / <strong>Admin</strong>. After the
              first login, change the password immediately.
            </p>
          </div>
        </section>

        <div className="auth-card admin-login-card">
          <h1 className="auth-title">Photobooth Admin</h1>
          <div className="admin-login-stepbar" aria-label="Login steps">
            <span className={`admin-login-step${step === 'credentials' ? ' is-active' : step === 'code' ? ' is-complete' : ''}`}>
              1. Credentials
            </span>
            <span className={`admin-login-step${step === 'code' ? ' is-active' : ''}`}>
              2. Verification
            </span>
          </div>

          {step === 'credentials' ? (
            <form onSubmit={handleCredentials} className="auth-form admin-login-form">
              <h2>Admin Login</h2>
              <p className="auth-subtitle">Use your admin identifier and password to enter the control room.</p>

              <label>
                Admin identifier
                <div className={`auth-input-shell ${identifierState}`}>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    autoFocus
                    autoComplete="username"
                    placeholder="Admin or admin@example.com"
                  />
                </div>
              </label>

              <label>
                Password
                <div className={`auth-input-shell ${passwordState}`}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="auth-input-toggle"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <p className="admin-login-inline-note">
                First login on a new installation? Use the bootstrap credentials once, then you’ll be taken straight to
                password hardening.
              </p>

              {resetState === 'success' && (
                <p className="auth-success">
                  Password reset completed. Log in with the new password below.
                </p>
              )}

              {error && <p className="auth-error">{error}</p>}
              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? 'Checking…' : 'Continue'}
              </button>
              <Link to="/admin/reset-password" className="admin-login-secondary-link">
                Forgot your password?
              </Link>
            </form>
          ) : (
            <form onSubmit={handleCode} className="auth-form admin-login-form">
              <h2>Verification Code</h2>
              <p className="auth-subtitle">
                A 6-digit code was sent to the admin mailbox. Enter it below to finish sign-in.
              </p>

              <label>
                6-digit code
                <div className={`auth-input-shell ${codeState}`}>
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
                    placeholder="000000"
                  />
                </div>
              </label>

              <p className="admin-login-inline-note">
                The code expires in 10 minutes. If SMTP is still disabled, bootstrap admins may be taken directly to the
                dashboard instead of this step.
              </p>

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
    </div>
  );
}
