import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { marriageRequestCode, marriageVerify } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

type Step = 'email' | 'code';

interface MarriageLoginPanelProps {
  variant?: 'page' | 'landing';
}

export function MarriageLoginPanel({ variant = 'page' }: MarriageLoginPanelProps) {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const verified = searchParams.get('verified') === '1';
  const redirectTo = searchParams.get('redirect') ?? '/my-gallery';
  const title = variant === 'landing' ? 'Open Your Gallery' : 'Sign in';
  const subtitle = variant === 'landing'
    ? 'Use the e-mail address from your invitation to receive a 6-digit login code.'
    : 'Enter the e-mail address you were invited with to receive a login code.';

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await marriageRequestCode(email);
      setStep('code');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await marriageVerify(email, code);
      setAuth(data.accessToken, 'MarriageUser', data.eventId, data.eventName);
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {verified && step === 'email' && (
        <div className="auth-success">
          Your e-mail has been confirmed. Enter it below to log in.
        </div>
      )}

      {step === 'email' ? (
        <form onSubmit={handleEmailSubmit} className="auth-form">
          {variant === 'landing' && <p className="auth-kicker">Normal User Login</p>}
          <h2>{title}</h2>
          <p className="auth-subtitle">{subtitle}</p>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Sending code…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCodeSubmit} className="auth-form">
          <h2>Enter Code</h2>
          <p className="auth-subtitle">
            A 6-digit login code was sent to <strong>{email}</strong>. It expires in 10 minutes.
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
              setStep('email');
              setCode('');
              setError('');
            }}
          >
            Back
          </button>
        </form>
      )}
    </>
  );
}
