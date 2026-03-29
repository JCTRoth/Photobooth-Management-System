import { useEffect, useState } from 'react';
import {
  getSmtpSettings,
  saveSmtpSettings,
  testSmtpSettings,
  type SaveSmtpSettingsPayload,
} from '@/services/api';

export function AdminSmtpSettings() {
  const [form, setForm] = useState<SaveSmtpSettingsPayload>({
    host: '',
    port: 587,
    username: '',
    password: '',
    fromAddress: '',
    fromName: 'Photobooth',
    useSsl: false,
    useStartTls: true,
  });
  const [testRecipient, setTestRecipient] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [otpReady, setOtpReady] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const data = await getSmtpSettings();
        setForm({
          host: data.host ?? '',
          port: data.port ?? 587,
          username: data.username ?? '',
          password: data.password ?? '',
          fromAddress: data.fromAddress ?? '',
          fromName: data.fromName ?? 'Photobooth',
          useSsl: data.useSsl,
          useStartTls: data.useStartTls,
        });
        setOtpReady(data.isVerified === true);
      } catch {
        setError('Failed to load SMTP settings.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);
    try {
      const updated = await saveSmtpSettings(form);
      setOtpReady(updated.isVerified === true);
      setMessage('Settings saved. Run a test email to enable admin OTP.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setMessage('');
    setError('');
    setTesting(true);
    try {
      const res = await testSmtpSettings(testRecipient);
      setOtpReady(res.otpReady === true);
      setMessage(res.message ?? 'Test email sent. Admin OTP is now enabled.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'SMTP test failed.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <p>Loading SMTP settings…</p>;

  return (
    <div className="card" style={{ maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 16 }}>SMTP Settings</h1>
      <p style={{ marginBottom: 16, color: 'var(--text-muted)' }}>
        Admin OTP status: <strong style={{ color: otpReady ? '#22c55e' : 'var(--danger)' }}>{otpReady ? 'Enabled' : 'Disabled'}</strong>
      </p>
      <p style={{ marginBottom: 20, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Typical setups: port <strong>587</strong> with <strong>StartTLS</strong>, port <strong>465</strong> with
        <strong> SSL</strong>, or local tools like MailHog/Mailpit on port <strong>1025</strong> with both options off.
      </p>

      <form className="auth-form" onSubmit={onSave}>
        <label>
          Host
          <input value={form.host} onChange={(e) => setForm((x) => ({ ...x, host: e.target.value }))} required />
        </label>
        <label>
          Port
          <input
            type="number"
            value={form.port}
            onChange={(e) => setForm((x) => ({ ...x, port: Number(e.target.value) }))}
            required
          />
        </label>
        <label>
          Username
          <input value={form.username} onChange={(e) => setForm((x) => ({ ...x, username: e.target.value }))} />
          <span className="form-helper-text">Leave blank for local or relay servers that do not require SMTP auth.</span>
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((x) => ({ ...x, password: e.target.value }))}
          />
          <span className="form-helper-text">Leave blank together with username when the SMTP server accepts anonymous connections.</span>
        </label>
        <label>
          From e-mail
          <input
            type="email"
            value={form.fromAddress}
            onChange={(e) => setForm((x) => ({ ...x, fromAddress: e.target.value }))}
            required
          />
        </label>
        <label>
          From name
          <input value={form.fromName} onChange={(e) => setForm((x) => ({ ...x, fromName: e.target.value }))} required />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={form.useSsl}
            onChange={(e) => setForm((x) => ({ ...x, useSsl: e.target.checked }))}
          />
          Use SSL
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={form.useStartTls}
            onChange={(e) => setForm((x) => ({ ...x, useStartTls: e.target.checked }))}
          />
          Use StartTLS
        </label>

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save SMTP settings'}
        </button>
      </form>

      <hr style={{ margin: '20px 0', borderColor: 'var(--border)' }} />

      <div className="auth-form">
        <label>
          Test recipient
          <input
            type="email"
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            placeholder="recipient@example.com"
          />
        </label>
        <button className="btn btn-ghost" type="button" disabled={testing || !testRecipient} onClick={onTest}>
          {testing ? 'Sending test…' : 'Send test email and enable OTP'}
        </button>
      </div>

      {message && <p className="auth-success" style={{ marginTop: 16 }}>{message}</p>}
      {error && <p className="auth-error" style={{ marginTop: 16 }}>{error}</p>}
    </div>
  );
}
