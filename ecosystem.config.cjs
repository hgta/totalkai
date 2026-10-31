module.exports = {
  apps: [
    {
      name: 'totalkai',
      script: './server.js',
      cwd: '/var/www/totalkai/current',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '700M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
