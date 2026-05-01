import React from 'react';

export const FileTreeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 64 64" fill="currentColor" stroke="currentColor">
    <path d="M15 22 V25 H31 V52 M31 37 H45 M31 52 H45" fill="none" strokeWidth="2.5" strokeLinecap="square" />
    <path d="M2 6 H10 L13 9 H30 V22 H2 Z" stroke="none" />
    <path d="M6 11 H27 V19 H6 Z" stroke="none" />
    <path d="M34 28 H42 L45 31 H62 V44 H34 Z" stroke="none" />
    <path d="M38 33 H59 V41 H38 Z" stroke="none" />
    <path d="M34 47 H42 L45 50 H62 V63 H34 Z" stroke="none" />
    <path d="M38 52 H59 V60 H38 Z" stroke="none" />
  </svg>
);
