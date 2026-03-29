import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BoothHealthStatus } from '@/services/boothConsole';
import { fetchBoothHealth, fetchSignedDeviceConfig, parseLocalDeviceConfig } from '@/services/boothConsole';
import type { DeviceConfigResponse, PhotoboothClientLocalConfig } from '@/types/device';

const STORAGE_KEY = 'photobooth-booth-console:v1';

interface StoredBoothProfile {
  config: PhotoboothClientLocalConfig;
  importedAt: string;
  lastSuccessfulSyncAt: string | null;
  lastWeddingEventId: string | null;
  lastWeddingName: string | null;
  lastWeddingDate: string | null;
  lastWeddingLoadedAt: string | null;
}

const exampleConfig = `{
  "serverUrl": "https://photobooth.example.com",
  "deviceId": "11111111-2222-3333-4444-555555555555",
  "privateKey": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----",
  "watchDirectory": "/opt/photobooth/output",
  "deviceName": "Booth 01"
}`;

function readStoredProfile(): StoredBoothProfile | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredBoothProfile;
    return {
      ...parsed,
      config: parseLocalDeviceConfig(JSON.stringify(parsed.config)),
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not available yet';
  return new Date(value).toLocaleString();
}

function formatEventDate(value: string | null) {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleDateString();
}

function buildStoredProfile(config: PhotoboothClientLocalConfig): StoredBoothProfile {
  return {
    config,
    importedAt: new Date().toISOString(),
    lastSuccessfulSyncAt: null,
    lastWeddingEventId: null,
    lastWeddingName: null,
    lastWeddingDate: null,
    lastWeddingLoadedAt: null,
  };
}

function BoothStateCard({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'neutral';
  detail: string;
}) {
  return (
    <article className={`booth-state-card booth-state-card-${tone}`}>
      <span className="booth-state-label">{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export function BoothConsolePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<StoredBoothProfile | null>(() => readStoredProfile());
  const [health, setHealth] = useState<BoothHealthStatus | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<DeviceConfigResponse | null>(null);
  const [authLatencyMs, setAuthLatencyMs] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [profile]);

  const syncStatus = useCallback(async () => {
    if (!profile) return;

    setSyncing(true);
    setError(null);

    const [healthResult, configResult] = await Promise.allSettled([
      fetchBoothHealth(profile.config),
      fetchSignedDeviceConfig(profile.config),
    ]);

    if (healthResult.status === 'fulfilled') {
      setHealth(healthResult.value);
    } else {
      setHealth(null);
    }

    if (configResult.status === 'fulfilled') {
      const syncedAt = new Date().toISOString();
      const assignedEvent = configResult.value.config.assignedEvent;

      setRuntimeConfig(configResult.value.config);
      setAuthLatencyMs(configResult.value.latencyMs);
      setProfile((current) => {
        if (!current) return current;

        const eventChanged = assignedEvent?.eventId && assignedEvent.eventId !== current.lastWeddingEventId;
        const shouldRefreshWeddingStamp = Boolean(assignedEvent && (eventChanged || !current.lastWeddingLoadedAt));

        return {
          ...current,
          lastSuccessfulSyncAt: syncedAt,
          lastWeddingEventId: assignedEvent?.eventId ?? current.lastWeddingEventId,
          lastWeddingName: assignedEvent?.eventName ?? current.lastWeddingName,
          lastWeddingDate: assignedEvent?.eventDate ?? current.lastWeddingDate,
          lastWeddingLoadedAt: shouldRefreshWeddingStamp ? syncedAt : current.lastWeddingLoadedAt,
        };
      });
    } else {
      setError(configResult.reason instanceof Error ? configResult.reason.message : 'Device authentication failed.');
    }

    if (healthResult.status === 'rejected' && configResult.status === 'rejected') {
      setError(
        healthResult.reason instanceof Error
          ? healthResult.reason.message
          : 'The booth could not reach the backend.'
      );
    }

    setSyncing(false);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    syncStatus();
    const timer = window.setInterval(syncStatus, 30000);
    return () => window.clearInterval(timer);
  }, [profile, syncStatus]);

  const handleConfigImport = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const config = parseLocalDeviceConfig(text);
      setProfile(buildStoredProfile(config));
      setRuntimeConfig(null);
      setHealth(null);
      setAuthLatencyMs(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The selected file is not a valid device config.');
    } finally {
      event.target.value = '';
    }
  }, []);

  const handleForgetBooth = useCallback(() => {
    if (!window.confirm('Forget the locally stored booth config on this browser?')) {
      return;
    }

    setProfile(null);
    setRuntimeConfig(null);
    setHealth(null);
    setAuthLatencyMs(null);
    setError(null);
  }, []);

  const currentEvent = runtimeConfig?.assignedEvent ?? null;
  const lastWeddingLoaded = profile?.lastWeddingName
    ? `${profile.lastWeddingName} on ${formatEventDate(profile.lastWeddingDate)}`
    : 'No wedding has been loaded yet';

  const connectionLabel =
    health?.status === 'healthy' ? `Connected in ${health.latencyMs} ms` : profile ? 'Waiting for connection' : 'No booth loaded';
  const authLabel =
    runtimeConfig ? `Signed device auth verified${authLatencyMs ? ` in ${authLatencyMs} ms` : ''}` : 'No device handshake yet';
  const weddingLabel = currentEvent
    ? `${currentEvent.eventName} on ${formatEventDate(currentEvent.eventDate)}`
    : profile?.lastWeddingName
      ? `Last loaded: ${lastWeddingLoaded}`
      : 'No wedding assigned';

  return (
    <main className="booth-console-page">
      <div className="booth-console-glow booth-console-glow-one" aria-hidden="true" />
      <div className="booth-console-glow booth-console-glow-two" aria-hidden="true" />

      <div className="booth-console-shell">
        <section className="booth-console-hero">
          <div className="booth-console-copy">
            <Link to="/" className="booth-console-back-link">
              Return to landing page
            </Link>
            <p className="booth-console-eyebrow">Booth Workflow</p>
            <h1>Server-side booth guide for the new localhost client console.</h1>
            <p className="booth-console-lead">
              The real live booth UI now runs from the `.NET` client itself on the booth machine. Use the client
              command <code>dashboard</code> to open its localhost page, then use this server-side guide and the admin
              device screens to assign weddings and verify the overall setup flow.
            </p>
          </div>

          <div className="booth-console-action-row">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleConfigImport}
            />
            <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
              {profile ? 'Replace device JSON' : 'Load device JSON'}
            </button>
            <button className="btn-secondary" onClick={syncStatus} disabled={!profile || syncing}>
              {syncing ? 'Refreshing...' : 'Refresh status'}
            </button>
            {profile && (
              <button className="btn-secondary" onClick={handleForgetBooth}>
                Forget this booth
              </button>
            )}
          </div>
        </section>

        {!profile ? (
          <section className="card booth-console-empty">
            <div className="section-header">
              <div>
                <h2 style={{ marginBottom: 4 }}>Start with the device JSON</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                  This server page can still validate an existing device JSON in the browser, but the preferred setup
                  path is now the booth-local dashboard running on the booth machine itself.
                </p>
              </div>
            </div>

            <div className="detail-grid">
              <div className="code-panel">
                <div className="code-panel-label">Expected JSON shape</div>
                <pre>{exampleConfig}</pre>
              </div>

              <div className="booth-console-empty-copy">
                <div className="detail-list">
                  <div>
                    <span>Booth side</span>
                    <strong>Generate keys locally, register the device, and watch live localhost status</strong>
                  </div>
                  <div>
                    <span>Server side</span>
                    <strong>Assign weddings, monitor telemetry, and manage the fleet from the admin UI</strong>
                  </div>
                  <div>
                    <span>Bridge check</span>
                    <strong>Signed browser sync for config validation when you need a quick server-hosted sanity check</strong>
                  </div>
                </div>

                <p className="subtle-note" style={{ marginTop: 18 }}>
                  This page stores the imported config only in this browser. Use it on trusted booth devices.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            {error && (
              <div className="card booth-console-alert">
                <strong>Sync needs attention</strong>
                <p>{error}</p>
              </div>
            )}

            <section className="booth-console-state-grid">
              <BoothStateCard
                label="Backend Connection"
                value={health?.status === 'healthy' ? 'Healthy' : 'Offline'}
                tone={health?.status === 'healthy' ? 'good' : 'warn'}
                detail={connectionLabel}
              />
              <BoothStateCard
                label="Device Authentication"
                value={runtimeConfig ? 'Verified' : 'Waiting'}
                tone={runtimeConfig ? 'good' : 'neutral'}
                detail={authLabel}
              />
              <BoothStateCard
                label="Wedding Loadout"
                value={currentEvent ? 'Ready' : 'Standby'}
                tone={currentEvent ? 'good' : 'warn'}
                detail={weddingLabel}
              />
              <BoothStateCard
                label="Software"
                value={`v${__CLIENT_VERSION__}`}
                tone="neutral"
                detail={`Client runtime ${__CLIENT_RUNTIME__}`}
              />
            </section>

            <section className="booth-console-grid">
              <article className="card booth-console-panel">
                <div className="section-header">
                  <div>
                    <h2 style={{ marginBottom: 4 }}>Current Wedding</h2>
                    <p style={{ color: 'var(--text-muted)' }}>
                      The assignment shown here comes from the live signed device config, not from a cached admin view.
                    </p>
                  </div>
                  <span className={`status-pill ${currentEvent ? 'connectivity-online' : 'connectivity-never-seen'}`}>
                    {currentEvent ? 'Upload ready' : 'Awaiting event'}
                  </span>
                </div>

                <div className="detail-list">
                  <div>
                    <span>Assigned wedding</span>
                    <strong>{currentEvent?.eventName ?? 'Nothing assigned yet'}</strong>
                  </div>
                  <div>
                    <span>Wedding date</span>
                    <strong>{currentEvent ? formatEventDate(currentEvent.eventDate) : 'Not scheduled'}</strong>
                  </div>
                  <div>
                    <span>Loaded into booth</span>
                    <strong>{formatDateTime(profile.lastWeddingLoadedAt)}</strong>
                  </div>
                  <div>
                    <span>Last remembered wedding</span>
                    <strong>{lastWeddingLoaded}</strong>
                  </div>
                </div>
              </article>

              <article className="card booth-console-panel">
                <div className="section-header">
                  <div>
                    <h2 style={{ marginBottom: 4 }}>Booth Profile</h2>
                    <p style={{ color: 'var(--text-muted)' }}>
                      Local device information from the imported JSON plus the last successful signed sync.
                    </p>
                  </div>
                </div>

                <div className="detail-list">
                  <div>
                    <span>Device name</span>
                    <strong>{profile.config.deviceName || 'Unnamed booth'}</strong>
                  </div>
                  <div>
                    <span>Device ID</span>
                    <code>{profile.config.deviceId}</code>
                  </div>
                  <div>
                    <span>Watch directory</span>
                    <code>{profile.config.watchDirectory || 'Not configured in this JSON'}</code>
                  </div>
                  <div>
                    <span>Allowed uploads</span>
                    <strong>{profile.config.allowedExtensions?.join(', ') || '.jpg, .jpeg, .png'}</strong>
                  </div>
                  <div>
                    <span>Config imported</span>
                    <strong>{formatDateTime(profile.importedAt)}</strong>
                  </div>
                  <div>
                    <span>Last successful sync</span>
                    <strong>{formatDateTime(profile.lastSuccessfulSyncAt)}</strong>
                  </div>
                </div>
              </article>
            </section>

            <section className="booth-console-grid booth-console-grid-wide">
              <article className="card booth-console-panel">
                <div className="section-header">
                  <div>
                    <h2 style={{ marginBottom: 4 }}>Runtime Endpoints</h2>
                    <p style={{ color: 'var(--text-muted)' }}>
                      These values come from the signed device config, so they always mirror the backend the booth is
                      currently trusting.
                    </p>
                  </div>
                </div>

                <div className="detail-list">
                  <div>
                    <span>Server URL</span>
                    <code>{profile.config.serverUrl}</code>
                  </div>
                  <div>
                    <span>Heartbeat interval</span>
                    <strong>{runtimeConfig?.heartbeatIntervalSeconds ?? '...'} seconds</strong>
                  </div>
                  <div>
                    <span>Heartbeat endpoint</span>
                    <code>{runtimeConfig?.heartbeatEndpoint ?? 'Waiting for signed sync'}</code>
                  </div>
                  <div>
                    <span>Guest upload endpoint</span>
                    <code>{runtimeConfig?.guestUploadEndpoint ?? 'Waiting for signed sync'}</code>
                  </div>
                  <div>
                    <span>QR base URL</span>
                    <code>{runtimeConfig?.qrBaseUrl ?? 'Waiting for signed sync'}</code>
                  </div>
                </div>
              </article>

              <article className="card booth-console-panel">
                <div className="section-header">
                  <div>
                    <h2 style={{ marginBottom: 4 }}>Operator Notes</h2>
                    <p style={{ color: 'var(--text-muted)' }}>
                      Designed for booth-side checks: quick to read, safe to refresh, and clear when the booth is not
                      assigned yet.
                    </p>
                  </div>
                </div>

                <div className="booth-console-note-stack">
                  <div className="booth-console-note">
                    <span>Connection rule</span>
                    <p>
                      Healthy means the browser reached <code>/api/health</code>. Verified means the private key also
                      succeeded against the signed device config endpoint.
                    </p>
                  </div>
                  <div className="booth-console-note">
                    <span>Local storage</span>
                    <p>
                      The imported config is saved in this browser so the booth page survives reloads. Clear it with
                      “Forget this booth” when decommissioning a machine.
                    </p>
                  </div>
                  <div className="booth-console-note">
                    <span>Best use</span>
                    <p>
                      Keep this page open on the booth machine during setup. It gives the operator a visual confirmation
                      that the correct wedding and endpoints are loaded before guests start arriving.
                    </p>
                  </div>
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
