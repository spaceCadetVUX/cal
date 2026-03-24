import { cn } from '@/lib/utils'

interface ChannelBadgeProps {
  name: string
  color: string // hex color, e.g. "#EE4D2D"
  size?: 'sm' | 'md'
}

// Compute white or black text based on background luminance
function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

export function ChannelBadge({ name, color, size = 'sm' }: ChannelBadgeProps) {
  const textColor = getContrastColor(color)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      )}
      style={{ backgroundColor: color, color: textColor }}
    >
      {name}
    </span>
  )
}
