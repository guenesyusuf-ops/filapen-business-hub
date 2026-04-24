'use client';

import { cn } from '@/lib/utils';

// Deterministic color from name — consistent across renders
const AVATAR_COLORS = [
  'bg-amber-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-orange-500', 'bg-sky-500', 'bg-orange-500', 'bg-sky-500',
  'bg-orange-500', 'bg-blue-500', 'bg-lime-500', 'bg-orange-500',
];

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface CreatorAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

export function CreatorAvatar({ name, avatarUrl, size = 'sm', className }: CreatorAvatarProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn(
          'rounded-full object-cover ring-2 ring-white dark:ring-gray-900',
          sizeMap[size],
          className,
        )}
        onError={(e) => {
          // Fallback to initials on load error
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-semibold text-white',
        sizeMap[size],
        colorFromName(name),
        className,
      )}
    >
      {initials}
    </div>
  );
}
