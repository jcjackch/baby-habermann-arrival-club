import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/baby-habermann-arrival-club/',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  define: { __ARRIVAL_API_URL__: JSON.stringify(process.env.ARRIVAL_API_URL ?? 'https://baby-habermann-arrival-club.jackchan08.chatgpt.site') },
  server: { host: '127.0.0.1', watch: { useFsEvents: false, usePolling: true } },
});
