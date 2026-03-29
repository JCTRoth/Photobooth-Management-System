import fs from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const explicitProxyTarget = process.env.VITE_API_PROXY_TARGET?.trim();
const testApiPort = process.env.PHOTOBOOTH_TEST_API_PORT?.trim();
const apiProxyTarget = explicitProxyTarget
  || (testApiPort ? `http://127.0.0.1:${testApiPort}` : 'http://127.0.0.1:5000');
const clientProjectFile = fs.readFileSync(path.resolve(__dirname, '../client/Photobooth.Client.csproj'), 'utf8');
const clientVersion = clientProjectFile.match(/<Version>([^<]+)<\/Version>/)?.[1] ?? 'dev';
const clientRuntime = clientProjectFile.match(/<TargetFramework>([^<]+)<\/TargetFramework>/)?.[1] ?? 'unknown';

export default defineConfig({
  plugins: [react()],
  define: {
    __CLIENT_VERSION__: JSON.stringify(clientVersion),
    __CLIENT_RUNTIME__: JSON.stringify(clientRuntime),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/d': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
