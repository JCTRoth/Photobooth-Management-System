const flash = document.getElementById('flash');
const registerForm = document.getElementById('register-form');
const importButton = document.getElementById('import-config-button');
const generateKeyButton = document.getElementById('generate-key-button');
const startRunnerButton = document.getElementById('start-runner-button');
const stopRunnerButton = document.getElementById('stop-runner-button');

// Section Navigation
const navItems = document.querySelectorAll('.nav-item');
const contentSections = document.querySelectorAll('.content-section');

function switchSection(sectionId) {
  contentSections.forEach(section => section.classList.remove('active'));
  navItems.forEach(item => item.classList.remove('active'));
  
  const targetSection = document.getElementById(sectionId);
  const targetNav = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
  
  if (targetSection) targetSection.classList.add('active');
  if (targetNav) targetNav.classList.add('active');
  
  // Update page title
  const pageSubtitle = document.getElementById('page-subtitle');
  const pageTitle = document.querySelector('.page-title');
  const labels = {
    overview: ['Real-time device status', 'Status Overview'],
    setup: ['Configure and provision', 'Setup & Configuration'],
    runtime: ['Start and manage processes', 'Runtime Control'],
    details: ['Configuration and statistics', 'Device Details & Stats']
  };
  if (labels[sectionId]) {
    pageSubtitle.textContent = labels[sectionId][0];
    pageTitle.textContent = labels[sectionId][1];
  }
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    switchSection(item.dataset.section);
  });
});

const statusTargets = {
  machineName: document.getElementById('machine-name'),
  clientVersion: document.getElementById('client-version'),
  localUrl: document.getElementById('local-url'),
  connectionState: document.getElementById('connection-state'),
  connectionCopy: document.getElementById('connection-copy'),
  runnerState: document.getElementById('runner-state'),
  runnerCopy: document.getElementById('runner-copy'),
  eventState: document.getElementById('event-state'),
  eventCopy: document.getElementById('event-copy'),
  uploadState: document.getElementById('upload-state'),
  uploadCopy: document.getElementById('upload-copy'),
  configPath: document.getElementById('config-path'),
  deviceId: document.getElementById('device-id'),
  configuredServer: document.getElementById('configured-server'),
  configuredWatchDirectory: document.getElementById('configured-watch-directory'),
  allowedExtensions: document.getElementById('allowed-extensions'),
  lastConfigSync: document.getElementById('last-config-sync'),
  lastHeartbeat: document.getElementById('last-heartbeat'),
  watcherState: document.getElementById('watcher-state'),
  pendingUploads: document.getElementById('pending-uploads'),
  connectionIcon: document.getElementById('connection-icon'),
  runnerIcon: document.getElementById('runner-icon'),
  eventIcon: document.getElementById('event-icon'),
  uploadIcon: document.getElementById('upload-icon'),
};

const formFields = {
  serverUrl: document.getElementById('server-url'),
  deviceName: document.getElementById('device-name'),
  watchDirectory: document.getElementById('watch-directory'),
  configJson: document.getElementById('config-json'),
  publicKey: document.getElementById('public-key'),
  privateKey: document.getElementById('private-key'),
  fingerprint: document.getElementById('key-fingerprint'),
  keyBadge: document.getElementById('key-badge'),
  keyStatus: document.getElementById('key-status'),
};

let pendingKeyPair = null;

function showFlash(message, tone = 'success') {
  flash.textContent = message;
  flash.className = `flash-container ${tone}`;
}

function clearFlash() {
  flash.className = 'flash-container hidden';
  flash.textContent = '';
}

function formatTime(value) {
  if (!value) return 'Not available yet';
  return new Date(value).toLocaleString();
}

function formatEvent(event) {
  if (!event) return 'Unassigned';
  return `${event.eventName} on ${new Date(event.eventDate).toLocaleDateString()}`;
}

function getStatusIcon(state) {
  const state_lower = state?.toLowerCase() || '';
  if (state_lower.includes('connected') || state_lower.includes('ok') || state_lower.includes('good')) return '✅';
  if (state_lower.includes('error') || state_lower.includes('failed') || state_lower.includes('denied')) return '❌';
  if (state_lower.includes('wait') || state_lower.includes('pending')) return '⏳';
  if (state_lower.includes('running') || state_lower.includes('online')) return '▶️';
  if (state_lower.includes('stop')) return '⏹️';
  if (state_lower.includes('degraded')) return '⚠️';
  return '⚪';
}

function getStatusClass(state) {
  const state_lower = state?.toLowerCase() || '';
  if (state_lower.includes('error') || state_lower.includes('failed') || state_lower.includes('denied')) return 'status-error';
  if (state_lower.includes('running') || state_lower.includes('online') || state_lower.includes('connected')) return 'status-success';
  if (state_lower.includes('degraded') || state_lower.includes('warn')) return 'status-warning';
  if (state_lower.includes('wait') || state_lower.includes('pending') || state_lower.includes('unassigned')) return 'status-pending';
  return '';
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '');

  if (!response.ok) {
    const message = typeof body === 'string'
      ? body
      : body.error || body.message || `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return body;
}

function syncPendingKeyPairToUi() {
  formFields.publicKey.value = pendingKeyPair?.publicKeyPem || '';
  formFields.privateKey.value = pendingKeyPair?.privateKeyPem || '';
  formFields.fingerprint.textContent = pendingKeyPair?.fingerprint || 'Not generated';
  formFields.keyBadge.textContent = pendingKeyPair ? 'Local key ready ✓' : 'No key yet';
  
  if (pendingKeyPair) {
    formFields.keyStatus.classList.remove('hidden');
  } else {
    formFields.keyStatus.classList.add('hidden');
  }
}

function updateStatus(status) {
  statusTargets.machineName.textContent = status.machineName;
  statusTargets.clientVersion.textContent = `${status.clientVersion} · ${status.runtimeVersion}`;
  statusTargets.localUrl.textContent = status.localDashboardUrl;
  statusTargets.configPath.textContent = status.configPath;

  const config = status.config;
  if (config) {
    formFields.serverUrl.value = formFields.serverUrl.value || config.serverUrl;
    formFields.deviceName.value = formFields.deviceName.value || config.deviceName;
    formFields.watchDirectory.value = formFields.watchDirectory.value || (config.watchDirectory || '');
    statusTargets.deviceId.textContent = config.deviceId;
    statusTargets.configuredServer.textContent = config.serverUrl;
    statusTargets.configuredWatchDirectory.textContent = config.watchDirectory || 'Not configured';
    statusTargets.allowedExtensions.textContent = config.allowedExtensions.join(', ');
  } else {
    statusTargets.deviceId.textContent = 'Not configured';
    statusTargets.configuredServer.textContent = 'Not configured';
    statusTargets.configuredWatchDirectory.textContent = 'Not configured';
    statusTargets.allowedExtensions.textContent = '.jpg, .jpeg, .png';
  }

  const runner = status.runner;
  statusTargets.connectionState.textContent = runner.connectionState;
  statusTargets.connectionIcon.textContent = getStatusIcon(runner.connectionState);
  statusTargets.connectionCopy.textContent = runner.lastHeartbeatError
    ? runner.lastHeartbeatError
    : `Last successful heartbeat: ${formatTime(runner.lastSuccessfulHeartbeatAt)}`;

  // Update connection card styling
  const connectionCard = statusTargets.connectionIcon.closest('.status-card');
  if (connectionCard) {
    connectionCard.className = `status-card ${getStatusClass(runner.connectionState)}`;
  }

  statusTargets.runnerState.textContent = `${runner.lifecycle} · ${runner.deviceStatus}`;
  statusTargets.runnerIcon.textContent = getStatusIcon(runner.lifecycle);
  statusTargets.runnerCopy.textContent = runner.runnerError
    ? runner.runnerError
    : `Watcher: ${runner.watcherState} · Pending uploads: ${runner.pendingUploadCount}`;

  // Update runner card styling
  const runnerCard = statusTargets.runnerIcon.closest('.status-card');
  if (runnerCard) {
    runnerCard.className = `status-card ${getStatusClass(runner.lifecycle)}`;
  }

  statusTargets.eventState.textContent = formatEvent(status.assignedEvent);
  statusTargets.eventIcon.textContent = status.assignedEvent ? '🎭' : '⚪';
  statusTargets.eventCopy.textContent = runner.lastEventLoadedAt
    ? `Loaded on this booth at ${formatTime(runner.lastEventLoadedAt)}`
    : 'No wedding has been loaded from the server yet.';

  // Update event card styling
  const eventCard = statusTargets.eventIcon.closest('.status-card');
  if (eventCard) {
    const eventStatus = status.assignedEvent ? 'success' : 'pending';
    eventCard.className = `status-card status-${eventStatus}`;
  }

  statusTargets.uploadState.textContent = runner.lastUploadStatus
    ? `${runner.lastUploadStatus}${runner.lastUploadFileName ? ` · ${runner.lastUploadFileName}` : ''}`
    : 'No uploads yet';
  statusTargets.uploadIcon.textContent = runner.lastUploadStatus ? '✅' : '⏳';
  statusTargets.uploadCopy.textContent = runner.lastUploadError
    ? runner.lastUploadError
    : `Last upload activity: ${formatTime(runner.lastUploadAt)}`;

  // Update upload card styling
  const uploadCard = statusTargets.uploadIcon.closest('.status-card');
  if (uploadCard) {
    const uploadStatus = runner.lastUploadStatus ? 'success' : 'pending';
    uploadCard.className = `status-card status-${uploadStatus}`;
  }

  statusTargets.lastConfigSync.textContent = formatTime(runner.lastConfigSyncAt);
  statusTargets.lastHeartbeat.textContent = formatTime(runner.lastHeartbeatAt);
  statusTargets.watcherState.textContent = runner.watcherState;
  statusTargets.pendingUploads.textContent = String(runner.pendingUploadCount);

  startRunnerButton.disabled = !status.configExists || runner.lifecycle === 'running' || runner.lifecycle === 'starting';
  stopRunnerButton.disabled = runner.lifecycle === 'stopped' || runner.lifecycle === 'stopping';
}

async function loadStatus() {
  try {
    const status = await fetchJson('/api/status', { method: 'GET' });
    updateStatus(status);
  } catch (error) {
    showFlash(error.message || 'Failed to load booth status.', 'error');
  }
}

generateKeyButton.addEventListener('click', async () => {
  clearFlash();
  try {
    pendingKeyPair = await fetchJson('/api/keys/generate', { method: 'POST', body: '{}' });
    syncPendingKeyPairToUi();
    showFlash('Generated a fresh RSA key pair on this booth.');
  } catch (error) {
    showFlash(error.message || 'Could not generate a key pair.', 'error');
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFlash();

  try {
    const result = await fetchJson('/api/setup/register', {
      method: 'POST',
      body: JSON.stringify({
        serverUrl: formFields.serverUrl.value.trim(),
        deviceName: formFields.deviceName.value.trim(),
        watchDirectory: formFields.watchDirectory.value.trim() || null,
        publicKeyPem: pendingKeyPair?.publicKeyPem || null,
        privateKeyPem: pendingKeyPair?.privateKeyPem || null,
        startRunner: true,
      }),
    });

    pendingKeyPair = null;
    syncPendingKeyPairToUi();
    await loadStatus();
    showFlash(result.message || 'Device registered successfully.');
  } catch (error) {
    showFlash(error.message || 'Could not register this booth.', 'error');
  }
});

importButton.addEventListener('click', async () => {
  clearFlash();
  try {
    const result = await fetchJson('/api/config/import', {
      method: 'POST',
      body: JSON.stringify({
        rawJson: formFields.configJson.value,
        startRunner: true,
      }),
    });

    await loadStatus();
    showFlash(result.message || 'Config imported successfully.');
  } catch (error) {
    showFlash(error.message || 'Could not import the config JSON.', 'error');
  }
});

startRunnerButton.addEventListener('click', async () => {
  clearFlash();
  try {
    const result = await fetchJson('/api/runner/start', { method: 'POST', body: '{}' });
    await loadStatus();
    showFlash(result.message || 'Booth runtime started.');
  } catch (error) {
    showFlash(error.message || 'Could not start the booth runtime.', 'error');
  }
});

stopRunnerButton.addEventListener('click', async () => {
  clearFlash();
  try {
    const result = await fetchJson('/api/runner/stop', { method: 'POST', body: '{}' });
    await loadStatus();
    showFlash(result.message || 'Booth runtime stopped.');
  } catch (error) {
    showFlash(error.message || 'Could not stop the booth runtime.', 'error');
  }
});

syncPendingKeyPairToUi();
loadStatus();
window.setInterval(loadStatus, 5000);
