import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import { initGlassesEventHandler } from './glasses/renderer';

// We import the SDK types but use dynamic initialization since the bridge
// is only available when running inside the Even Realities app WebView.
let bridge: any = null;
let wakeLock: any = null;

async function init() {
  try {
    const sdk = await import('@evenrealities/even_hub_sdk');
    bridge = await sdk.waitForEvenAppBridge();
    console.log('[EvenNav] Bridge connected');

    // Register glasses event handler
    initGlassesEventHandler(bridge);
  } catch (e) {
    console.warn('[EvenNav] SDK bridge not available (running outside Even Hub):', e);
    // Continue without bridge for development/testing in regular browser
  }

  // Request a wake lock to prevent the phone from sleeping during navigation
  requestWakeLock();

  // Re-acquire wake lock when app returns to foreground
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
      console.log('[EvenNav] App returned to foreground');
    }
  });

  const root = createRoot(document.getElementById('app')!);
  root.render(<App bridge={bridge} />);
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        console.log('[EvenNav] Wake lock released');
      });
      console.log('[EvenNav] Wake lock acquired');
    }
  } catch (e) {
    console.warn('[EvenNav] Wake lock not available:', e);
  }
}

init();

export function getBridge(): any {
  return bridge;
}
