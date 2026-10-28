import React, { useState, useEffect } from 'react';

// Global subscriber mechanism for pending API requests
let activeRequests = 0;
let wakeTimer = null;
const listeners = new Set();

function notify(isWaking) {
  listeners.forEach((fn) => {
    try {
      fn(isWaking);
    } catch {
      // Ignore listener error
    }
  });
}

// Wrap window.fetch once on module load in browser environments
if (typeof window !== 'undefined' && window.fetch && !window.__fairscore_fetch_wrapped) {
  window.__fairscore_fetch_wrapped = true;
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    activeRequests++;
    if (activeRequests === 1) {
      if (wakeTimer) clearTimeout(wakeTimer);
      wakeTimer = setTimeout(() => {
        if (activeRequests > 0) {
          notify(true);
        }
      }, 4000);
    }

    try {
      return await originalFetch.apply(this, args);
    } finally {
      activeRequests--;
      if (activeRequests <= 0) {
        activeRequests = 0;
        if (wakeTimer) {
          clearTimeout(wakeTimer);
          wakeTimer = null;
        }
        notify(false);
      }
    }
  };
}

export function useColdStartNotice() {
  const [isWaking, setIsWaking] = useState(false);

  useEffect(() => {
    listeners.add(setIsWaking);
    return () => {
      listeners.delete(setIsWaking);
    };
  }, []);

  return isWaking;
}

export default function ColdStartBanner() {
  const isWaking = useColdStartNotice();

  if (!isWaking) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        backgroundColor: '#4f46e5',
        color: '#ffffff',
        padding: '0.625rem 1rem',
        textAlign: 'center',
        fontSize: '0.875rem',
        fontWeight: 500,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem'
      }}
    >
      <span aria-hidden="true">⏳</span>
      <span>The server is waking up; this can take up to a minute.</span>
    </div>
  );
}
