/**
 * Harold configuration for E2E test project
 */

export default {
  build: {
    command: 'npm run build',
    path: 'dist',
  },

  categories: {
    js: '**/*.js',
    css: '**/*.css',
    assets: '**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,eot}',
  },

  // Настройки для тестирования
  options: {
    gzip: true,
    verbose: true,
  },
};
