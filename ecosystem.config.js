// ecosystem.config.js - PM2 config for the KUIPER API
//
//   first time:   pm2 delete kuiper-backend   (only if it was started the old way)
//                 pm2 start ecosystem.config.js && pm2 save
//   every deploy: pm2 reload ecosystem.config.js --update-env
//
// FORK MODE, ONE INSTANCE - on purpose. Cluster mode is NOT safe in this app today:
//  * 10 node-cron jobs run inside the API process (biometric sync every 15 min, sales
//    reminders every minute, daily productivity / holiday / announcement e-mails, leave
//    accrual, git sync ...). With N instances every job runs N times: duplicate e-mails,
//    duplicate accruals, duplicate attendance writes.
//  * socket.io keeps its rooms (user, ticket, project, leave, attendance) in process
//    memory. A second instance would need sticky sessions in nginx plus a shared adapter
//    (e.g. @socket.io/redis-adapter), otherwise events miss users connected elsewhere.
// To scale later: move the cron jobs into their own PM2 process (fork, 1 instance), add the
// redis adapter + ip_hash/sticky upstream, then switch the API to exec_mode 'cluster'.
//
// Because there is one instance, `pm2 reload` is a restart: new requests are refused for the
// ~1-2 s the API takes to start. server.js now finishes in-flight requests before exiting
// (graceful shutdown) and signals "ready" once it is listening.

const path = require('path');

module.exports = {
  apps: [
    {
      name: 'kuiper-backend',
      cwd: path.join(__dirname, 'backend'),
      script: 'server.js',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
      },
      // wait for process.send('ready') from server.js before treating the new process as up
      wait_ready: true,
      listen_timeout: 20000,
      // give the graceful shutdown (8 s) time to finish before PM2 kills the process
      kill_timeout: 10000,
      max_memory_restart: '1G',
      // restart on crash, but stop retrying if it keeps crashing on start
      autorestart: true,
      exp_backoff_restart_delay: 200,
      max_restarts: 10,
      min_uptime: '20s',
      time: true, // timestamps in pm2 logs
    },
  ],
};
