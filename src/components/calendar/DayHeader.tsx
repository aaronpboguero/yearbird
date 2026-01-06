import clsx from 'clsx'

const DAY_COLUMN_COUNT = 31

interface DayHeaderProps {
  className?: string
}

export function DayHeader({ className }: DayHeaderProps) {
  return (
    <div
      className={clsx(
        'sticky top-0 z-20 flex flex-none border-b border-zinc-200/70 bg-white/95 backdrop-blur',
        className
      )}
    >
      <div className="flex-none bg-white/95" style={{ width: 'var(--tv-month-column)' }} />
      <div
        className="grid flex-1 grid-cols-31 bg-zinc-200/70"
        style={{ gap: 'var(--tv-grid-gap)' }}
      >
        {Array.from({ length: DAY_COLUMN_COUNT }, (_, index) => (
          <div
            key={index}
            className="flex items-center justify-center bg-white px-0.5 font-medium text-zinc-400 md:py-1"
            style={{
              height: 'var(--tv-day-header-height)',
              fontSize: 'var(--tv-day-header)',
            }}
          >
            <span className="hidden md:inline">{index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
