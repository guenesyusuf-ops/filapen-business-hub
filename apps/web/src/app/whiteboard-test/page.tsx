'use client';

// PURE ISOLATION TEST — kein Auth, kein Liveblocks, kein Template,
// keine DiagnosticsPanel, kein Dashboard-Layout-Wrapper. Wenn dieses
// Canvas nach Tab-Switch weiss wird, ist tldraw selbst der Verursacher.
// Wenn es heile bleibt, liegt der Bug in unserer Wrapper-Kette.
//
// URL: /whiteboard-test  (NICHT in (dashboard) — bewusst raus aus dem
// Auth/Sidebar/Theme-Kontext fuer maximale Isolation)

import dynamic from 'next/dynamic';
import 'tldraw/tldraw.css';

const Tldraw = dynamic(() => import('tldraw').then((m) => m.Tldraw), {
  ssr: false,
});

export default function WhiteboardTest() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw />
    </div>
  );
}
