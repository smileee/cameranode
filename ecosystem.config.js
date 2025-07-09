module.exports = {
  apps: [
    {
      name: 'cameranode',
      script: 'npm',
      args: 'start',
      cwd: __dirname,
      watch: false,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      }
    }
  ]
}; 