'use strict';

module.exports = {
  apps: [
    {
      name:        'jeweller-stock',
      script:      'server.js',
      cwd:         __dirname,
      watch:       false,
      instances:   1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT:     3100,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
