// Capture the install prompt before React boots. The async MSAL init delays React's
// mount past when Chrome fires beforeinstallprompt, so usePwaInstall's own listener
// misses it and the "Add to your phone" button never appears. Stash it for the hook.
//
// Loaded as an external classic script from index.html, never inline: production CSP is
// `script-src 'self'`, which blocks inline scripts.
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__qpInstallPrompt = e;
});
window.addEventListener('appinstalled', function () {
  window.__qpInstallPrompt = null;
});
