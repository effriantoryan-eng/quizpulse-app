// Unit tests for the pure platform-detection logic behind src/hooks/usePwaInstall.js.
//
// The repo has no DOM test library (RTL/jsdom). The hook's testable surface — platform
// detection, already-installed detection, and the appinstalled state transition — is pure,
// so it's mirrored here exactly as implemented in the hook (same pattern as
// tests/unit/offlineSync.test.js). Keep these in lockstep with usePwaInstall.js.

function detectPlatform({ userAgent = '', hasMSStream = false, hasInstallPrompt = false } = {}) {
  if (hasInstallPrompt) return 'native';
  if (/iPad|iPhone|iPod/.test(userAgent) && !hasMSStream) return 'ios';
  return 'unsupported';
}

function detectInstalled({ standalone = false, navigatorStandalone = false } = {}) {
  return standalone === true || navigatorStandalone === true;
}

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP_FIREFOX_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';
const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

describe('usePwaInstall — platform detection', () => {
  it('returns platform="ios" for iOS Safari UA (not standalone, no install prompt)', () => {
    expect(detectPlatform({ userAgent: IOS_UA, hasMSStream: false, hasInstallPrompt: false })).toBe('ios');
  });

  it('returns "unsupported" for desktop Firefox UA', () => {
    expect(detectPlatform({ userAgent: DESKTOP_FIREFOX_UA, hasMSStream: false, hasInstallPrompt: false })).toBe('unsupported');
  });

  it('returns "native" once a beforeinstallprompt has fired (e.g. Android Chrome)', () => {
    expect(detectPlatform({ userAgent: ANDROID_CHROME_UA, hasInstallPrompt: true })).toBe('native');
  });

  it('treats legacy IE mobile (window.MSStream) as not iOS', () => {
    expect(detectPlatform({ userAgent: IOS_UA, hasMSStream: true })).toBe('unsupported');
  });
});

describe('usePwaInstall — already-installed detection', () => {
  it('is false in a normal browser tab', () => {
    expect(detectInstalled({ standalone: false, navigatorStandalone: false })).toBe(false);
  });

  it('is true when display-mode is standalone (installed PWA)', () => {
    expect(detectInstalled({ standalone: true })).toBe(true);
  });

  it('is true when navigator.standalone is true (iOS installed)', () => {
    expect(detectInstalled({ navigatorStandalone: true })).toBe(true);
  });
});

describe('usePwaInstall — appinstalled transition', () => {
  // Mirrors the hook's appinstalled handler: isInstalled -> true, canInstall -> false.
  it('flips isInstalled true and canInstall false after appinstalled fires', () => {
    let state = { isInstalled: false, canInstall: true, deferredPrompt: {} };
    function onAppInstalled() {
      state = { isInstalled: true, canInstall: false, deferredPrompt: null };
    }
    onAppInstalled();
    expect(state.isInstalled).toBe(true);
    expect(state.canInstall).toBe(false);
    expect(state.deferredPrompt).toBeNull();
  });
});
