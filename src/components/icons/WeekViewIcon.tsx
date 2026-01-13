import type { SVGProps } from 'react'

export function WeekViewIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      data-slot="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
      aria-hidden="true"
    >
      {/* 7-column grid representing Mon-Sun week view */}
      {/* Top header row */}
      <rect x="3" y="4" width="18" height="3" rx="0.5" fill="currentColor" opacity="0.3" />
      {/* Week rows */}
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="3" y1="14" x2="21" y2="14" />
      <line x1="3" y1="18" x2="21" y2="18" />
      {/* Weekend highlight on right side */}
      <rect x="16" y="7" width="5" height="13" fill="currentColor" opacity="0.15" stroke="none" />
    </svg>
  )
}
