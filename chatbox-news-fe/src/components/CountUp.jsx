import { useEffect, useRef, useState } from 'react';

// Animates a numeric value counting up from its previous value to the new
// one. First reveal is gated on scrolling into view (like ScrollReveal);
// later value changes (e.g. a 60s auto-refresh poll) animate immediately
// since the element is already visible.
function CountUp({ value, duration = 900, format }) {
  const numericValue = Number(value) || 0;
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const hasRevealed = useRef(false);
  const prevValue = useRef(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const animateTo = (target) => {
      const start = prevValue.current;
      const delta = target - start;
      const startTime = performance.now();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);

      const tick = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(start + delta * eased));
        if (progress < 1) {
          frameRef.current = requestAnimationFrame(tick);
        } else {
          setDisplay(target);
          prevValue.current = target;
        }
      };
      frameRef.current = requestAnimationFrame(tick);
    };

    if (hasRevealed.current) {
      animateTo(numericValue);
      return;
    }

    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      hasRevealed.current = true;
      animateTo(numericValue);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          hasRevealed.current = true;
          animateTo(numericValue);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [numericValue, duration]);

  useEffect(() => () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); }, []);

  return <span ref={ref}>{format ? format(display) : display.toLocaleString()}</span>;
}

export default CountUp;
