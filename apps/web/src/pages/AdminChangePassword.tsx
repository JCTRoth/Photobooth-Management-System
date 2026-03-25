import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changeAdminPassword } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

type StrengthTone = 'empty' | 'weak' | 'fair' | 'good' | 'strong';
type RuleState = 'pending' | 'missing' | 'met';

interface PasswordStrength {
  tone: StrengthTone;
  label: string;
  description: string;
  activeBars: number;
}

function joinSuggestions(parts: string[]) {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function getRuleState(active: boolean, satisfied: boolean): RuleState {
  if (!active) return 'pending';
  return satisfied ? 'met' : 'missing';
}

function evaluatePasswordStrength(password: string, currentPassword: string): PasswordStrength {
  if (!password) {
    return {
      tone: 'empty',
      label: 'Waiting',
      description: 'Start with a long phrase or sentence-style password, then layer in numbers and symbols.',
      activeBars: 0,
    };
  }

  const hasMinLength = password.length >= 12;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(password);
  const hasNoWhitespace = !/\s/.test(password);
  const differsFromCurrent = !currentPassword || password !== currentPassword;
  const isLong = password.length >= 16;

  let score = 0;
  if (hasMinLength) score += 2;
  if (hasLower) score += 1;
  if (hasUpper) score += 1;
  if (hasNumber) score += 1;
  if (hasSymbol) score += 1;
  if (hasNoWhitespace) score += 1;
  if (differsFromCurrent) score += 1;
  if (isLong) score += 1;

  const suggestions: string[] = [];
  if (!hasMinLength) suggestions.push('add more length');
  if (!(hasLower && hasUpper)) suggestions.push('mix uppercase and lowercase');
  if (!hasNumber) suggestions.push('include a number');
  if (!hasSymbol) suggestions.push('include a symbol');
  if (!hasNoWhitespace) suggestions.push('remove spaces');
  if (!differsFromCurrent) suggestions.push('make it different from the current password');

  if (score <= 3) {
    return {
      tone: 'weak',
      label: 'Weak',
      description: `Too easy to guess. ${joinSuggestions(suggestions)}.`,
      activeBars: 1,
    };
  }

  if (score <= 5) {
    return {
      tone: 'fair',
      label: 'Fair',
      description: `A decent start, but it still needs hardening. ${joinSuggestions(suggestions)}.`,
      activeBars: 2,
    };
  }

  if (score <= 7) {
    return {
      tone: 'good',
      label: 'Good',
      description: suggestions.length > 0
        ? `Solid for admin use. For extra safety, ${joinSuggestions(suggestions)}.`
        : 'Solid for admin use and comfortably above the minimum.',
      activeBars: 3,
    };
  }

  return {
    tone: 'strong',
    label: 'Strong',
    description: 'Strong password. Long, varied, and much harder to brute-force.',
    activeBars: 4,
  };
}

export function AdminChangePassword() {
  const { refreshAccessToken, clearAuth } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const trimmedEmail = email.trim();
  const emailLooksValid = trimmedEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

  const hasMinLength = newPassword.length >= 12;
  const hasLower = /[a-z]/.test(newPassword);
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(newPassword);
  const hasNoWhitespace = newPassword.length > 0 && !/\s/.test(newPassword);
  const differsFromCurrent = currentPassword.length > 0 && newPassword.length > 0 && newPassword !== currentPassword;
  const varietyCount = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;

  const strength = evaluatePasswordStrength(newPassword, currentPassword);
  const meetsAdminMinimum =
    hasMinLength &&
    hasNoWhitespace &&
    differsFromCurrent &&
    varietyCount >= 3;
  const confirmationStarted = confirmPassword.length > 0;
  const passwordsMatch = confirmationStarted && newPassword === confirmPassword;
  const confirmMismatch = confirmationStarted && newPassword !== confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    meetsAdminMinimum &&
    passwordsMatch &&
    emailLooksValid;

  const passwordRules = [
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
      label: 'Different from the current password',
      state: getRuleState(currentPassword.length > 0 && newPassword.length > 0, differsFromCurrent),
    },
    {
      label: 'Confirmation matches exactly',
      state: getRuleState(confirmationStarted, passwordsMatch),
    },
  ] satisfies Array<{ label: string; state: RuleState }>;

  const completedRules = passwordRules.filter((rule) => rule.state === 'met').length;

  const confirmMessage = confirmMismatch
    ? 'The confirmation does not match yet.'
    : passwordsMatch
      ? 'Passwords match.'
      : 'Type the new password again to catch typos before saving.';

  const emailMessage = trimmedEmail.length === 0
    ? 'Recommended: add the admin e-mail now so one-time codes can be delivered once SMTP is active.'
    : emailLooksValid
      ? 'This address will receive future admin verification codes once SMTP is configured.'
      : 'Enter a valid e-mail address or leave it empty for now.';

  const submitLabel = loading
    ? 'Saving…'
    : canSubmit
      ? 'Save new password'
      : 'Complete the checks above';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!meetsAdminMinimum) {
      setError('Choose a stronger password before continuing.');
      return;
    }

    if (!passwordsMatch) {
      setError('Please confirm the new password so both fields match exactly.');
      return;
    }

    if (!emailLooksValid) {
      setError('Please enter a valid admin e-mail or leave the field empty.');
      return;
    }

    setLoading(true);

    try {
      await changeAdminPassword(currentPassword, newPassword, trimmedEmail || undefined);
      const refreshedToken = await refreshAccessToken();
      if (!refreshedToken) {
        setSuccess('Password changed successfully. Please log in again with your new password.');
        setTimeout(() => navigate('/admin/login', { replace: true }), 600);
        return;
      }
      setSuccess('Password changed successfully. Redirecting to the dashboard…');
      setTimeout(() => navigate('/admin', { replace: true }), 500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page admin-password-page">
      <div className="admin-password-card">
        <section className="admin-password-panel admin-password-panel-intro">
          <p className="admin-password-kicker">Security checkpoint</p>
          <h1 className="admin-password-title">Lock down the admin area before you go any further.</h1>
          <p className="admin-password-lead">
            This password protects events, uploads, guest invites, slideshow access, and SMTP settings. Make it
            long, unique, and difficult to guess.
          </p>

          <div className="admin-password-strength-card">
            <div className="admin-password-strength-header">
              <span>Password strength</span>
              <strong className={`admin-password-strength-label is-${strength.tone}`}>
                {strength.label}
              </strong>
            </div>
            <div className="admin-password-strength-bars" aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <span
                  // Strength bars show progress from weak to strong as the user types.
                  key={index}
                  className={`admin-password-strength-bar ${
                    index < strength.activeBars ? `is-${strength.tone}` : ''
                  }`}
                />
              ))}
            </div>
            <p className="admin-password-strength-copy">{strength.description}</p>
          </div>

          <div className="admin-password-progress-card">
            <div className={`admin-password-readiness ${meetsAdminMinimum ? 'is-ready' : 'is-pending'}`}>
              <span className="admin-password-readiness-dot" />
              {meetsAdminMinimum ? 'Meets the admin minimum' : 'Still needs a little more work'}
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
        </section>

        <section className="admin-password-panel admin-password-panel-form">
          <form className="auth-form admin-password-form" onSubmit={handleSubmit}>
            <p className="auth-kicker">Required before dashboard access</p>
            <h2>Change Admin Password</h2>
            <p className="auth-subtitle">
              Replace the temporary password now. You will be taken to the admin dashboard right after saving.
            </p>

            <label className="admin-password-field">
              <span>Current password</span>
              <div className={`auth-input-shell ${currentPassword ? 'is-filled' : ''}`}>
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="auth-input-toggle"
                  onClick={() => setShowCurrentPassword((value) => !value)}
                >
                  {showCurrentPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <label className="admin-password-field">
              <span>New password</span>
              <div className={`auth-input-shell ${newPassword ? (meetsAdminMinimum ? 'is-valid' : 'is-attention') : ''}`}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={12}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  aria-describedby="admin-password-live-note"
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
            <p id="admin-password-live-note" className={`admin-password-field-note is-${strength.tone}`}>
              {strength.description}
            </p>

            <label className="admin-password-field">
              <span>Confirm new password</span>
              <div className={`auth-input-shell ${confirmMismatch ? 'is-invalid' : passwordsMatch ? 'is-valid' : ''}`}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={12}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  aria-invalid={confirmMismatch}
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

            <label className="admin-password-field">
              <span>Admin e-mail</span>
              <div className={`auth-input-shell ${trimmedEmail ? (emailLooksValid ? 'is-valid' : 'is-invalid') : ''}`}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={!emailLooksValid}
                />
              </div>
            </label>
            <p className={`admin-password-field-note ${emailLooksValid ? 'is-muted' : 'is-error'}`}>
              {emailMessage}
            </p>

            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">{success}</p>}

            <div className="admin-password-actions">
              <button type="submit" className="btn btn-primary w-full" disabled={loading || !canSubmit}>
                {submitLabel}
              </button>
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => {
                  clearAuth();
                  navigate('/admin/login', { replace: true });
                }}
              >
                Log out
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
