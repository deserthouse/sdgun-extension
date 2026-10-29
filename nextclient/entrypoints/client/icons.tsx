// W2 内联 SVG 图标（stroke=currentColor，20×20 视口）——导航可辨识性的基础
// （E28-07：窄屏单字导航替换为图标+完整可访问名称）。
import React from 'react';

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const IconFocus = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <polygon points="14.5 9.5 12 12 9.5 14.5 9.5 9.5 14.5 9.5" fill="currentColor" stroke="none" />
  </svg>
);

export const IconCommunity = () => (
  <svg {...base}>
    <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
    <rect x="13" y="13" width="7.5" height="7.5" rx="1.5" />
  </svg>
);

export const IconMail = () => (
  <svg {...base}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7.5l9 6 9-6" />
  </svg>
);

export const IconUser = () => (
  <svg {...base}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20c1.5-3.5 4.2-5 7.5-5s6 1.5 7.5 5" />
  </svg>
);

export const IconSearch = () => (
  <svg {...base}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </svg>
);

export const IconGear = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" />
  </svg>
);

export const IconBack = () => (
  <svg {...base}>
    <path d="M14.5 5.5L8 12l6.5 6.5" />
  </svg>
);

export const IconLink = () => (
  <svg {...base}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.2 1.2" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.2-1.2" />
  </svg>
);

export const IconReply = () => (
  <svg {...base}>
    <path d="M9.5 5.5L4 11l5.5 5.5" />
    <path d="M4 11h9a7 7 0 0 1 7 7v1" />
  </svg>
);

export const IconCheck = () => (
  <svg {...base}>
    <path d="M4.5 12.5l5 5L19.5 7" />
  </svg>
);
