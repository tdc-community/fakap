import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const resolvePath = (relativePath: string): string => new URL(relativePath, import.meta.url).pathname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app': resolvePath('./src/app'),
      '@pages': resolvePath('./src/pages'),
      '@features': resolvePath('./src/features'),
      '@shared': resolvePath('./src/shared'),
    },
  },
  server: {
    allowedHosts: ['fakaperformance.com'],
  },
});
