import { useEffect, useMemo, useState } from 'react';

const STAR_COUNT = 160;
const SHOW_MS = 1800;
const FADE_MS = 500;

// One-time "hyperspace jump" loading splash shown as a full-screen overlay
// the very first time a visitor opens the site (tracked via localStorage).
// Pure CSS/DOM (not canvas) so it can't be silently blanked by browser/
// extension canvas-fingerprinting protections. Each star is a thin gradient
// line inside a statically-rotated wrapper; the inner line animates outward
// along its own local axis, producing the classic radiating warp-speed look.
function HyperspaceBackground({ onFinish }) {
  const [fading, setFading] = useState(false);

  const stars = useMemo(() => Array.from({ length: STAR_COUNT }, (_, i) => {
    const angle = Math.random() * 360;
    const duration = 1.4 + Math.random() * 2.2;
    const delay = Math.random() * duration;
    const length = 90 + Math.random() * 160;
    return { id: i, angle, duration, delay, length };
  }), []);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), SHOW_MS);
    const doneTimer = setTimeout(() => onFinish?.(), SHOW_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        overflow: 'hidden',
        background: '#000000',
        pointerEvents: 'none',
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      {stars.map((s) => (
        <span
          key={s.id}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 0,
            height: 0,
            transform: `rotate(${s.angle}deg)`,
          }}
        >
          <span
            className="hyperspace-star"
            style={{
              width: `${s.length}px`,
              animationDuration: `${s.duration}s`,
              animationDelay: `-${s.delay}s`,
            }}
          />
        </span>
      ))}
    </div>
  );
}

export default HyperspaceBackground;
