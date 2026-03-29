import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmAdminPasswordReset, requestAdminPasswordReset } from '@/services/api';
import { evaluatePasswordStrength, getRuleState, type RuleState } from '@/utils/adminPassword';

type Step = 'request' | 'confirm';

export function AdminResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialIdentifier = searchParams.get('identifier') ?? '';
  const initialCode = (searchParams.get('code') ?? '').replace(/\D/g, '').slice(0, 6);
  const initialStep: Step = initialCode ? 'confirm' : 'request';

  const [step, setStep] = useState<Step>(initialStep);
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [code, setCode] = useState(initialCode);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(
    initialCode ? 'Reset link loaded. Choose a strong new password to finish.' : ''
  );

  const identifierState =
    identifier.trim().length === 0 ? '' : identifier.trim().length >= 3 ? 'is-valid' : 'is-attention';
  const codeState = code.length === 0 ? '' : code.length === 6 ? 'is-valid' : 'is-attention';

  const hasMinLength = newPassword.length >= 12;
  const hasLower = /[a-z]/.test(newPassword);
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(newPassword);
  const hasNoWhitespace = newPassword.length > 0 && !/\s/.test(newPassword);
  const varietyCount = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
  const meetsAdminMinimum = hasMinLength && hasNoWhitespace && varietyCount >= 3;
  const confirmationStarted = confirmPassword.length > 0;
  const passwordsMatch = confirmationStarted && newPassword === confirmPassword;
  const confirmMismatch = confirmationStarted && newPassword !== confirmPassword;
  const strength = evaluatePasswordStrength(newPassword, '');

  const passwordRules = useMemo(
    () =>
      [
        {
          label: 'At least 12 characters',
          state: getRuleState(newPassword.length > 0, hasMinLength),
        },
        {
          label: 'Uses at least three of these: uppercase, lowercase, number, symbol',
          state: getRuleState(newPassword.length > 0, varietyCount >= 3),
        },
        {
          label: 'Contains no spaces',
          state: getRuleState(newPassword.length > 0, hasNoWhitespace),
        },
        {
          label: 'Confirmation matches exactly',
          state: getRuleState(confirmationStarted, passwordsMatch),
        },
      ] satisfies Array<{ label: string; state: RuleState }>,
    [confirmationStarted, hasMinLength, hasNoWhitespace, newPassword.length, passwordsMatch, varietyCount]
  );

  const completedRules = passwordRules.filter((rule) => rule.state === 'met').length;
  const confirmMessage = confirmMismatch
    ? 'The confirmation does not match yet.'
    : passwordsMatch
      ? 'Passwords match.'
      : 'Repeat the new password to catch typos before saving.';

  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await requestAdminPasswordReset(identifier.trim());
      setSuccess(`${result.message} Check the admin mailbox and continue with the 6-digit code.`);
      setStep('confirm');
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!meetsAdminMinimum) {
      setLoading(false);
      setError('Choose a stronger password before continuing.');
      return;
    }

    if (!passwordsMatch) {
      setLoading(false);
      setError('Please confirm the new password so both fields match exactly.');
      return;
    }

    try {
      const result = await confirmAdminPasswordReset(identifier.trim(), code, newPassword);
      setSuccess(`${result.message} Redirecting to the admin login…`);
      window.setTimeout(() => navigate('/admin/login?reset=success', { replace: true }), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page admin-reset-page">
      <div className="admin-login-shell admin-reset-shell">
        <section className="admin-login-aside admin-reset-aside">
          <Link to="/admin/login" className="auth-back-link">
            Back to admin login
          </Link>
          <p className="auth-kicker">Admin recovery</p>
          <h1 className="admin-login-hero">Recover control without breaking the rest of the security flow.</h1>
          <p className="admin-login-lead">
            Password resets use the same verified SMTP setup as admin OTP, so recovery fits the existing trust model
            instead of bypassing it.
          </p>

          <div className="admin-login-feature-list">
            <div className="admin-login-feature-card">
              <strong>Mailbox first</strong>
              <p>The reset starts by e-mailing a short-lived code and direct recovery link to the admin mailbox.</p>
            </div>
            <div className="admin-login-feature-card">
              <strong>Short-lived recovery</strong>
              <p>Codes expire after 10 minutes, and existing admin refresh sessions are revoked after a successful reset.</p>
            </div>
            <div className="admin-login-feature-card">
              <strong>Same password policy</strong>
              <p>The reset screen enforces the same strong-password checks as the first-login hardening flow.</p>
            </div>
          </div>

          <div className="admin-login-note-card admin-reset-note-card">
            <span>Requirements</span>
            <p>
              Password reset e-mails only work after SMTP has been configured and verified in the admin settings.
            </p>
          </div>
        </section>

        <div className="auth-card admin-login-card admin-reset-card">
          <h1 className="auth-title">Reset Admin Password</h1>
          <div className="admin-login-stepbar" aria-label="Password reset steps">
            <span className={`admin-login-step${step === 'request' ? ' is-active' : step === 'confirm' ? ' is-complete' : ''}`}>
              1. Request e-mail
            </span>
            <span className={`admin-login-step${step === 'confirm' ? ' is-active' : ''}`}>
              2. Choose new password
            </span>
          </div>

          {success && <p className="auth-success">{success}</p>}

          {step === 'request' ? (
            <form onSubmit={handleRequest} className="auth-form admin-login-form">
              <h2>Request Reset</h2>
              <p className="auth-subtitle">
                Enter the admin login ID or e-mail address. If the account exists, a reset e-mail will be sent.
              </p>

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

              <p className="admin-login-inline-note">
                This screen keeps the response generic, so the system does not reveal whether a specific admin account exists.
              </p>

              {error && <p className="auth-error">{error}</p>}
              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? 'Sending…' : 'Send reset e-mail'}
              </button>
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => {
                  setStep('confirm');
                  setSuccess('');
                  setError('');
                }}
              >
                I already have a code
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="auth-form admin-login-form admin-reset-form">
              <h2>Finish Reset</h2>
              <p className="auth-subtitle">
                Paste the 6-digit code from the reset e-mail and choose a new admin password.
              </p>

              <label>
                Admin identifier
                <div className={`auth-input-shell ${identifierState}`}>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    autoComplete="username"
                    placeholder="Admin or admin@example.com"
                  />
                </div>
              </label>

              <label>
                6-digit reset code
                <div className={`auth-input-shell ${codeState}`}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    required
                    autoComplete="one-time-code"
                    className="auth-otp-input"
                    placeholder="000000"
                  />
                </div>
              </label>

              <label className="admin-password-field">
                <span>New password</span>
                <div className={`auth-input-shell ${newPassword ? (meetsAdminMinimum ? 'is-valid' : 'is-attention') : ''}`}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={12}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="auth-input-toggle"
                    onClick={() => setShowNewPassword((value) => !value)}
                  >
                    {showNewPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <p className={`admin-password-field-note is-${strength.tone}`}>{strength.description}</p>

              <label className="admin-password-field">
                <span>Confirm new password</span>
                <div className={`auth-input-shell ${confirmationStarted ? (passwordsMatch ? 'is-valid' : 'is-attention') : ''}`}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={12}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="auth-input-toggle"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <p className={`admin-password-field-note ${confirmMismatch ? 'is-error' : passwordsMatch ? 'is-success' : 'is-muted'}`}>
                {confirmMessage}
              </p>

              <div className="admin-password-progress-card admin-reset-progress-card">
                <div className={`admin-password-readiness ${meetsAdminMinimum ? 'is-ready' : 'is-pending'}`}>
                  <span className="admin-password-readiness-dot" />
                  {meetsAdminMinimum ? 'Ready for reset' : 'Still needs a stronger password'}
                </div>
                <p className="admin-password-progress-text">
                  {completedRules} of {passwordRules.length} live checks completed.
                </p>
                <ul className="admin-password-rule-list">
                  {passwordRules.map((rule) => (
                    <li key={rule.label} className={`is-${rule.state}`}>
                      <span className="admin-password-rule-indicator" />
                      <span>{rule.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? 'Saving…' : 'Reset password'}
              </button>
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => {
                  setStep('request');
                  setCode('');
                  setSuccess('');
                  setError('');
                }}
              >
                Request a new e-mail
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
