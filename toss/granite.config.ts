import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'open-close-check',
  brand: {
    displayName: '오픈마감체크',
    primaryColor: '#3182F6',
    icon: '',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  webViewProps: {
    type: 'partner',
  },
  permissions: [],
});
