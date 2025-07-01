module.exports = {
  apps: [
    {
      name: 'border-next',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'border-streamer',
      script: 'node_modules/.bin/ts-node',
      args: '--project tsconfig.server.json server/streamer.ts',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}; 