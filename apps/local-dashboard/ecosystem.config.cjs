module.exports = {
  apps: [{
    name: 'local-dashboard',
    script: 'server.js',
    interpreter: 'node',
    env: {
      PORT: 5555,
      PAPERCLIP_API_URL: 'http://127.0.0.1:3100',
      PAPERCLIP_COMPANY_ID: '1a748860-f520-4bca-83a6-3bd4e7d1e831',
    },
    restart_delay: 5000,
    max_restarts: 20,
  }],
};
