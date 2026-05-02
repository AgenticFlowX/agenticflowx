/**
 * AFX product mark — "AF" with a raised "x" superscript.
 * component so it can be tinted via currentColor.
 *
 * @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-1]
 */
export interface AfxLogoIconProps {
  size?: number;
  className?: string;
}

export function AfxLogoIcon({ size = 16, className }: AfxLogoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <text
        x="0"
        y="19"
        fontFamily="var(--font-mono, ui-monospace, 'SF Mono', monospace)"
        fontSize="14"
        fontWeight="800"
        fill="currentColor"
      >
        AF
      </text>
      <text
        x="17"
        y="10"
        fontFamily="var(--font-mono, ui-monospace, 'SF Mono', monospace)"
        fontSize="10"
        fontWeight="700"
        fill="currentColor"
      >
        x
      </text>
    </svg>
  );
}

/**
 * Animated AFX brand mark — flow path + nodes + animated thread + static wordmark.
 *
 * Uses a compact flow-path treatment: thread + node-pulse animate, the AF/X
 * wordmark stays intentionally static. Honors prefers-reduced-motion.
 *
 * @see docs/specs/210-app-chat/spec.md [FR-2]
 * @see docs/specs/210-app-chat/design.md [DES-UI]
 */
export interface AfxLogoMarkProps {
  /** Rendered width in px. Height auto-scales with viewBox aspect. Default 240. */
  width?: number;
  className?: string;
}

const AFX_LOGO_MARK_CSS = `
  .afx-mark-flow { fill: none; stroke: url(#afx-mark-flow-grad); stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; opacity: .82; }
  .afx-mark-thread { fill: none; stroke: url(#afx-mark-thread-grad); stroke-width: 2.5; stroke-linecap: round; stroke-dasharray: 30 220; opacity: .95; animation: afx-mark-thread 5.2s cubic-bezier(.4,0,.2,1) infinite; }
  .afx-mark-node { fill: url(#afx-mark-thread-grad); transform-box: fill-box; transform-origin: center; animation: afx-mark-node 5.2s ease-in-out infinite; }
  .afx-mark-node-2 { animation-delay: .9s; }
  .afx-mark-node-3 { animation-delay: 1.8s; }
  .afx-mark-af { font: 850 56px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: -.03em; fill: currentColor; }
  .afx-mark-x { font: 850 28px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; fill: currentColor; }
  @keyframes afx-mark-thread { 0% { stroke-dashoffset: 0; opacity: .1; } 10%, 78% { opacity: .95; } 100% { stroke-dashoffset: -250; opacity: .1; } }
  @keyframes afx-mark-node { 0%, 100% { transform: scale(1); opacity: .68; } 12%, 20% { transform: scale(1.45); opacity: 1; } 34% { transform: scale(1); opacity: .72; } }
  @media (prefers-reduced-motion: reduce) { .afx-mark-thread, .afx-mark-node { animation: none !important; } }
`;

export function AfxLogoMark({ width = 240, className }: AfxLogoMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      viewBox="0 0 320 180"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="afx-mark-flow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#c026d3" />
        </linearGradient>
        <linearGradient id="afx-mark-thread-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <style dangerouslySetInnerHTML={{ __html: AFX_LOGO_MARK_CSS }} />
      </defs>

      {/* Flow motif — three nodes connected by a wave path with a traveling thread */}
      <g transform="translate(160 60)">
        <path
          className="afx-mark-flow"
          d="M -100 0 C -100 -50, -50 -50, -50 0 C -50 50, 0 50, 0 0 C 0 -50, 50 -50, 50 0 C 50 50, 100 50, 100 0"
        />
        <path
          className="afx-mark-thread"
          d="M -100 0 Q -75 -28, -50 0 Q -25 28, 0 0 Q 25 -28, 50 0 Q 75 28, 100 0"
        />
        <circle
          cx="-100"
          cy="0"
          r="11"
          fill="none"
          stroke="url(#afx-mark-flow-grad)"
          strokeWidth="3"
          opacity="0.85"
        />
        <circle className="afx-mark-node" cx="-100" cy="0" r="4" />
        <circle
          cx="0"
          cy="0"
          r="14"
          fill="none"
          stroke="url(#afx-mark-flow-grad)"
          strokeWidth="3.5"
          opacity="0.85"
        />
        <circle className="afx-mark-node afx-mark-node-2" cx="0" cy="0" r="6" />
        <circle
          cx="100"
          cy="0"
          r="11"
          fill="none"
          stroke="url(#afx-mark-flow-grad)"
          strokeWidth="3"
          opacity="0.85"
        />
        <circle className="afx-mark-node afx-mark-node-3" cx="100" cy="0" r="4" />
      </g>

      {/* Wordmark — AF with raised X superscript */}
      <g transform="translate(160 145)" textAnchor="middle">
        <text className="afx-mark-af" x="-7" y="0">
          AF
        </text>
        <text className="afx-mark-x" x="38" y="-26">
          X
        </text>
      </g>
    </svg>
  );
}
