import React from 'react';
import { Server } from 'lucide-react';

export function OsIcon({ os, size = 36 }) {
  const osLower = (os || '').toLowerCase();

  switch (osLower) {
    case 'debian':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="#D70A53" />
          <path
            d="M50 20C40 20 30 25 25 35C20 45 22 58 30 66C38 74 52 76 60 70C68 64 70 50 64 42C58 34 46 32 38 38C32 42 32 50 36 54C40 58 48 58 50 52C52 46 46 44 44 46"
            stroke="#FFFFFF"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'ubuntu':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="#E95420" />
          <circle cx="50" cy="50" r="24" stroke="#FFFFFF" strokeWidth="6" />
          <circle cx="50" cy="22" r="7" fill="#FFFFFF" />
          <circle cx="26" cy="64" r="7" fill="#FFFFFF" />
          <circle cx="74" cy="64" r="7" fill="#FFFFFF" />
        </svg>
      );

    case 'almalinux':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="#14213D" />
          <path d="M30 68L50 32L70 68H58L50 52L42 68H30Z" fill="#00B4D8" />
          <circle cx="50" cy="28" r="6" fill="#FFB703" />
        </svg>
      );

    case 'rocky':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="#0F766E" />
          <path d="M28 70L50 30L72 70H56L50 58L44 70H28Z" fill="#10B981" />
          <path d="M50 44L60 62H40L50 44Z" fill="#A7F3D0" />
        </svg>
      );

    case 'centos':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="#262626" />
          <path d="M50 26L64 40H50V26Z" fill="#93C54B" />
          <path d="M74 50L60 64V50H74Z" fill="#EEA236" />
          <path d="M50 74L36 60H50V74Z" fill="#2A7EB9" />
          <path d="M26 50L40 36V50H26Z" fill="#805690" />
        </svg>
      );

    case 'alpine':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="#0D597F" />
          <path d="M26 72L44 38L56 58L66 42L80 72H26Z" fill="#FFFFFF" fillOpacity="0.9" />
          <path d="M44 38L50 48L38 68H26L44 38Z" fill="#38BDF8" />
        </svg>
      );

    case 'fedora':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="#294172" />
          <circle cx="50" cy="50" r="28" fill="#51A2DA" />
          <path d="M42 35V65M42 50H58M58 35V50" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
        </svg>
      );

    case 'opensuse':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="#173F35" />
          <circle cx="50" cy="50" r="32" stroke="#73BA25" strokeWidth="6" />
          <circle cx="50" cy="50" r="14" fill="#73BA25" />
        </svg>
      );

    case 'archlinux':
    case 'arch':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="#1793D1" />
          <path d="M50 22L72 74L60 70L50 48L40 70L28 74L50 22Z" fill="#FFFFFF" />
        </svg>
      );

    default:
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: '#1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            border: '1px solid var(--border-color)',
          }}
        >
          <Server size={size * 0.55} />
        </div>
      );
  }
}
