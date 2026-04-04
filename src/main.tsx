import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import { initGlassesEventHandler } from './glasses/renderer';

// We import the SDK types but use dynamic initialization since the bridge
// is only available when running inside the Even Realities app WebView.
let bridge: any = null;

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

  const root = createRoot(document.getElementById('app')!);
  root.render(<App bridge={bridge} />);
}

init();

export function getBridge(): any {
  return bridge;
}
