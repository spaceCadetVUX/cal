import { cn } from '@/lib/utils'

interface ChannelBadgeProps {
  name: string
  color: string  // hex, e.g. "#EE4D2D"
  size?: 'sm' | 'md'
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

// Convert hex to rgba for background tint (10% opacity)
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function ChannelBadge({ name, color, size = 'sm' }: ChannelBadgeProps) {
  const text = getContrastColor(color)
  const isDark = text === '#ffffff'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
      )}
      style={{
        backgroundColor: hexToRgba(color, isDark ? 0.15 : 0.12),
        color: isDark ? color : adjustColorBrightness(color, -40),
        border: `1px solid ${hexToRgba(color, isDark ? 0.3 : 0.2)}`,
      }}
    >
      {/* Dot indicator */}
      <span
        className="inline-block rounded-full shrink-0"
        style={{
          width: size === 'sm' ? 5 : 6,
          height: size === 'sm' ? 5 : 6,
          backgroundColor: color,
        }}
      />
      {name}
    </span>
  )
}

function adjustColorBrightness(hex: string, delta: number): string {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + delta))
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + delta))
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + delta))
  return `rgb(${r},${g},${b})`
}
