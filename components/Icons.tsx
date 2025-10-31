import React from 'react';

export const CoinIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-8 w-8 text-yellow-400"
    viewBox="0 0 20 20"
    fill="currentColor"
    style={{ filter: "drop-shadow(2px 2px 2px rgba(0,0,0,0.5))" }}
  >
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
      clipRule="evenodd"
    />
  </svg>
);

export const GasIcon: React.FC = () => (
    <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 9l7-7 7 7" />
    </svg>
);

export const BrakeIcon: React.FC = () => (
    <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 15l-7 7-7-7" />
    </svg>
);
