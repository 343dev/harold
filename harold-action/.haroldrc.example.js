// Пример конфигурационного файла для Harold
// Скопируйте этот файл как .haroldrc.js в корень вашего проекта и настройте под свои нужды

export default {
  // Настройки сборки
  build: {
    // Команда для сборки проекта (переопределяется параметром build-command в Action)
    command: 'npm run build',

    // Путь к директории с результатами сборки (переопределяется параметром build-path в Action)
    path: 'dist',

    // Дополнительные переменные окружения для сборки
    env: {
      NODE_ENV: 'production',
      // NO_HASH: 'true', // Отключить хеши в именах файлов для лучшего сравнения
    },
  },

  // Категории файлов для анализа
  categories: {
    // JavaScript файлы
    js: '**/*.js',

    // CSS файлы
    css: '**/*.css',

    // Изображения
    images: '**/*.{png,jpg,jpeg,gif,svg,webp,avif}',

    // Шрифты
    fonts: '**/*.{woff,woff2,ttf,eot,otf}',

    // Видео файлы
    videos: '**/*.{mp4,webm,ogg,avi}',

    // HTML файлы
    html: '**/*.html',

    // JSON файлы
    json: '**/*.json',

    // Другие статические ресурсы
    assets: '**/*.{ico,txt,xml,pdf}',
  },
};

// Альтернативный пример для React приложения
/*
export default {
  build: {
    command: 'npm run build',
    path: 'build',
    env: {
      NODE_ENV: 'production',
      GENERATE_SOURCEMAP: 'false',
    },
  },
  categories: {
    'js-main': 'static/js/main.*.js',
    'js-chunks': 'static/js/!(main).*.js',
    'css-main': 'static/css/main.*.css',
    'css-chunks': 'static/css/!(main).*.css',
    'media': 'static/media/**/*',
    'other': '**/*.{html,json,txt,ico,manifest}',
  },
};
*/

// Альтернативный пример для Vue приложения
/*
export default {
  build: {
    command: 'npm run build',
    path: 'dist',
  },
  categories: {
    'js-app': 'js/app.*.js',
    'js-vendor': 'js/chunk-vendors.*.js',
    'js-chunks': 'js/chunk-*.js',
    'css-app': 'css/app.*.css',
    'css-chunks': 'css/chunk-*.css',
    'fonts': 'fonts/**/*',
    'img': 'img/**/*',
    'other': '**/*.{html,json,txt,ico}',
  },
};
*/
