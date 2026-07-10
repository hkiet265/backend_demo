import { useEffect, useRef, useState } from 'react';

// The chatbot mascot, drawn as SVG (matching the look of public/chatbot.png:
// a sage-green rounded head with ear pods and an antenna, a cream
// speech-bubble face, and two eyes) instead of a static image, so the eyes
// can actually blink and look toward the cursor as part of the drawing.
function ChatbotAvatar({ size, className, style, trackCursor = true }) {
  const wrapperRef = useRef(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!trackCursor) return;

    const MAX_OFFSET = 5; // pupil drift, in SVG units (eye radius is 12)
    const REACH_PX = 260; // screen distance (px) at which the gaze hits max

    const handleMove = (e) => {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const magnitude = Math.min(1, dist / REACH_PX);
      setGaze({
        x: (dx / dist) * magnitude * MAX_OFFSET,
        y: (dy / dist) * magnitude * MAX_OFFSET,
      });
    };

    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [trackCursor]);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        ...(size != null ? { width: size, height: size } : {}),
        borderRadius: '50%', overflow: 'hidden', flexShrink: 0, ...style,
      }}
    >
      <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="cbHead" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stop-color="#B7CBBD" />
            <stop offset="100%" stop-color="#8CA593" />
          </linearGradient>
          <linearGradient id="cbEar" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#C6DAD4" />
            <stop offset="100%" stop-color="#9FBAB4" />
          </linearGradient>
          <linearGradient id="cbFace" x1="10%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stop-color="#FFFBF5" />
            <stop offset="100%" stop-color="#F3E9DC" />
          </linearGradient>
        </defs>

        {/* ear pods, drawn behind the head so only their outer edge peeks out */}
        <ellipse cx="20" cy="116" rx="17" ry="36" fill="url(#cbEar)" />
        <ellipse cx="180" cy="116" rx="17" ry="36" fill="url(#cbEar)" />

        {/* antenna */}
        <line x1="72" y1="52" x2="57" y2="28" stroke="#8CA593" strokeWidth="10" strokeLinecap="round" />
        <circle cx="51" cy="21" r="17" fill="url(#cbEar)" />

        {/* head */}
        <circle cx="100" cy="112" r="82" fill="url(#cbHead)" />

        {/* face (speech-bubble shape: circle + a small tail) */}
        <path d="M56,150 L40,174 L74,158 Z" fill="url(#cbFace)" />
        <circle cx="98" cy="110" r="64" fill="url(#cbFace)" />

        {/* eyes: blink via the CSS "scale" property, look toward the cursor
            via the JS-driven "translate" property — independent CSS props,
            so the two effects never fight over `transform`. */}
        <circle
          className="chatbot-avatar-eye"
          cx="76" cy="106" r="12" fill="#7D9686"
          style={{ transformBox: 'fill-box', transformOrigin: 'center', translate: `${gaze.x}px ${gaze.y}px` }}
        />
        <circle
          className="chatbot-avatar-eye"
          cx="122" cy="106" r="12" fill="#7D9686"
          style={{ transformBox: 'fill-box', transformOrigin: 'center', translate: `${gaze.x}px ${gaze.y}px` }}
        />

        {/* mouth */}
        <path d="M82,132 Q99,144 116,132" fill="none" stroke="#7D9686" strokeWidth="6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default ChatbotAvatar;
