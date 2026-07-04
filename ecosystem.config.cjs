module.exports = {
  apps: [{
    name: 'finance-back',
    script: 'app.js',
    interpreter: 'node',
    cwd: '/root/finance/back/ControlPresupuestoNC-Backend',
    kill_timeout: 5000,
    wait_ready: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
