(() => {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const status = document.createElement('p');
  status.className = 'offline-status';
  status.setAttribute('role', 'status');
  const text = document.createElement('span');
  const retry = document.createElement('button');
  retry.type = 'button'; retry.textContent = '重试'; retry.hidden = true;
  status.append(text, retry);
  (document.querySelector('.quiz-shell, .home-card, .settings-card') || document.body).append(status);
  let registration;
  let watched = new WeakSet();
  function report(message, failed = false) { text.textContent = message; retry.hidden = !failed; }
  function ready() {
    report(registration.waiting ? '新版本已完整下载，刷新后更新。' : '离线已就绪');
  }
  function watch(worker) {
    if (!worker || watched.has(worker)) return;
    watched.add(worker);
    report('正在准备离线资源…');
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' || worker.state === 'activated') ready();
      if (worker.state === 'redundant') report('离线资源下载未完成，请联网重试。', true);
    });
  }
  async function register() {
    report('正在准备离线资源…');
    try {
      registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      registration.addEventListener('updatefound', () => watch(registration.installing));
      watch(registration.installing);
      if (!registration.installing && (registration.active || registration.waiting)) ready();
    } catch { report('离线资源下载未完成，请联网重试。', true); }
  }
  // A fresh navigation opts into a fully installed update. Never reload an active answer.
  navigator.serviceWorker.getRegistration().then(existing => {
    existing?.waiting?.postMessage({ type: 'ACTIVATE' });
  }).catch(() => {});
  retry.addEventListener('click', async () => {
    if (!registration?.active && !registration?.waiting) return register();
    report('正在准备离线资源…');
    try { await registration.update(); watch(registration.installing); }
    catch { report('离线资源下载未完成，请联网重试。', true); }
  });
  register();
})();
