import { useEffect, useState } from 'react'
import { ActionIcon, Badge, Card, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { IconPlayerPause, IconPlayerPlay, IconSettings } from '@tabler/icons-react'
import type { OdometerStyle } from '../lib/settings'
import { getSpeedoTheme } from '../lib/themes'

type TripMode = 'idle' | 'active' | 'paused'

type SpeedGaugeProps = {
  themeId: string
  speedText: string
  maxSpeed: number
  unit: 'mph' | 'kph'
  accent: string
  tripMode: TripMode
  speedValue: number
  odometerText: string
  odometerStyle: OdometerStyle
  routeSummary: string
  nextInstruction?: string
  roadName?: string
  isAcquiring?: boolean
  trackingActionLabel: string
  trackingActionAriaLabel: string
  onTrackingAction: () => void
  onToggleSettings: () => void
}

export function SpeedGauge({
  themeId,
  speedText,
  maxSpeed,
  unit,
  accent,
  tripMode,
  speedValue,
  odometerText,
  odometerStyle,
  routeSummary,
  nextInstruction,
  roadName,
  isAcquiring,
  trackingActionLabel,
  trackingActionAriaLabel,
  onTrackingAction,
  onToggleSettings,
}: SpeedGaugeProps) {
  const activeTheme = getSpeedoTheme(themeId)
  const indicatorMode = activeTheme.indicatorMode
  const layoutMode = activeTheme.layoutMode
  const progress = Math.min(Math.max(speedValue / maxSpeed, 0), 1)
  const arcLength = 460
  const dashOffset = arcLength - arcLength * progress
  const showArcProgress = progress > 0
  const startAngle = 140
  const endAngle = 400
  const needleAngle = startAngle + (endAngle - startAngle) * progress
  const needleRadians = (needleAngle * Math.PI) / 180
  const needleBaseX = 160 + Math.cos(needleRadians) * 12
  const needleBaseY = 160 + Math.sin(needleRadians) * 12
  const needleStartX = 160 + Math.cos(needleRadians) * 30
  const needleStartY = 160 + Math.sin(needleRadians) * 30
  const needleTipX = 160 + Math.cos(needleRadians) * 118
  const needleTipY = 160 + Math.sin(needleRadians) * 118
  const dialTicks = Array.from({ length: 7 }, (_, index) => {
    const angle = startAngle + ((endAngle - startAngle) * index) / 6
    const radians = (angle * Math.PI) / 180
    const innerRadius = 138
    const outerRadius = index === 0 || index === 6 ? 154 : 148

    return {
      id: `tick-${index}`,
      x1: 160 + Math.cos(radians) * innerRadius,
      y1: 160 + Math.sin(radians) * innerRadius,
      x2: 160 + Math.cos(radians) * outerRadius,
      y2: 160 + Math.sin(radians) * outerRadius,
      label: Math.round((maxSpeed * index) / 6),
      labelX: 160 + Math.cos(radians) * 172,
      labelY: 160 + Math.sin(radians) * 172,
      emphasized: index === 0 || index === 3 || index === 6,
    }
  })
  const rollingStyles: OdometerStyle[] = ['retro-roll', 'mechanical']
  const isRollingStyle = rollingStyles.includes(odometerStyle)
  const initialChars = odometerText.padStart(5, '0').split('')
  const [animationState, setAnimationState] = useState(() => ({
    previousChars: initialChars,
    currentChars: initialChars,
    isIncreasing: false,
    tick: 0,
    previousValue: Number.parseFloat(odometerText) || 0,
  }))

  useEffect(() => {
    const nextChars = odometerText.padStart(5, '0').split('')
    const nextValue = Number.parseFloat(odometerText) || 0

    queueMicrotask(() => {
      setAnimationState((previous) => {
        const changed = nextChars.join('') !== previous.currentChars.join('')
        const increasing = nextValue > previous.previousValue

        if (!changed) {
          return {
            ...previous,
            isIncreasing: false,
            previousValue: nextValue,
          }
        }

        return {
          previousChars: previous.currentChars,
          currentChars: nextChars,
          isIncreasing: increasing,
          tick: increasing ? previous.tick + 1 : previous.tick,
          previousValue: nextValue,
        }
      })
    })
  }, [odometerText])

  const statusColor = tripMode === 'active' ? 'teal' : tripMode === 'paused' ? 'yellow' : 'gray'
  const statusLabel = tripMode === 'active' ? 'TRACKING' : tripMode === 'paused' ? 'PAUSED' : 'READY'
  const actionIcon = tripMode === 'active' ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />
  const nextManeuver = toManeuverBadge(nextInstruction)

  return (
    <div className={`speed-gauge-wrap speedo-theme-${themeId} indicator-${indicatorMode} layout-${layoutMode}`}>
      <div className="gauge-topline">
        <Badge radius="xl" variant="light" color={statusColor} role="status" aria-live="polite">
          {statusLabel}
        </Badge>
        <Badge radius="xl" variant="light" color="blue">
          {unit.toUpperCase()}
        </Badge>
      </div>

      <Paper className="gauge-shell" radius="xl" withBorder>
        <div className="gauge-center">
          <div className={`gauge-nav-segment ${nextInstruction ? 'has-maneuver' : 'is-idle'}`}>
            <Text className="gauge-nav-arrow" aria-hidden="true">
              {nextManeuver.symbol}
            </Text>
            <Text className="gauge-nav-text" lineClamp={1}>
              {nextManeuver.label}
            </Text>
            {roadName ? (
              <Text className="gauge-nav-road" lineClamp={1}>
                {roadName}
              </Text>
            ) : null}
          </div>

          <svg viewBox="0 0 320 320" className="gauge-svg" aria-hidden="true">
            <defs>
              <linearGradient id="speed-gradient" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={accent} />
                <stop offset="100%" stopColor="#ffffff" />
              </linearGradient>
            </defs>
            <g className="gauge-ticks">
              {dialTicks.map((tick) => (
                <g key={tick.id}>
                  <line
                    className={`gauge-tick ${tick.emphasized ? 'gauge-tick-major' : ''}`}
                    x1={tick.x1}
                    y1={tick.y1}
                    x2={tick.x2}
                    y2={tick.y2}
                  />
                  <text className={`gauge-tick-label ${tick.emphasized ? 'gauge-tick-label-major' : ''}`} x={tick.labelX} y={tick.labelY}>
                    {tick.label}
                  </text>
                </g>
              ))}
            </g>
            <circle className="gauge-track" cx="160" cy="160" r="128" />
            {indicatorMode === 'arc' ? (
              showArcProgress ? (
                <circle
                  className="gauge-progress"
                  cx="160"
                  cy="160"
                  r="128"
                  stroke="url(#speed-gradient)"
                  strokeDasharray={`${arcLength} 1000`}
                  strokeDashoffset={dashOffset}
                />
              ) : null
            ) : null}
            {indicatorMode === 'needle' ? (
              <g className="gauge-needle-wrap">
                <line className="gauge-needle" x1={needleBaseX} y1={needleBaseY} x2={needleTipX} y2={needleTipY} />
                <line className="gauge-needle-highlight" x1={needleStartX} y1={needleStartY} x2={needleTipX} y2={needleTipY} />
                <circle className="gauge-needle-hub" cx="160" cy="160" r="11" />
                <circle className="gauge-needle-core" cx="160" cy="160" r="5" />
              </g>
            ) : null}
          </svg>

          <Stack gap={0} align="center" className={`speed-text-block speed-text-block-${layoutMode}`} role="status" aria-live="polite" aria-label={`Current speed ${speedText} ${unit}`}>
            <Title order={1} className="speed-text">
              {isAcquiring ? '--' : speedText}
            </Title>
            <Text className="speed-unit">{isAcquiring ? 'acquiring gps' : unit}</Text>
          </Stack>

          <div className="gauge-limits">
            <Text size="sm" c="dimmed">
              0
            </Text>
            <Text size="sm" c="dimmed">
              {maxSpeed}
            </Text>
          </div>
        </div>

        <Group justify="space-between" className="gauge-meta">
          <ActionIcon variant="light" radius="xl" size="lg" onClick={onTrackingAction} aria-label={trackingActionAriaLabel}>
            {actionIcon}
          </ActionIcon>

          <Stack gap={2} align="center">
            <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
              Odometer
            </Text>
            <div className={`odometer odometer-${odometerStyle}`} role="status" aria-live="polite" aria-label={`Odometer ${odometerText}`}>
              {animationState.currentChars.map((character, index) => {
                if (character === '.') {
                  return (
                    <span key={`separator-${index}`} className="odometer-separator">
                      {character}
                    </span>
                  )
                }

                const shouldRoll =
                  isRollingStyle &&
                  animationState.isIncreasing &&
                  animationState.previousChars[index] !== character &&
                  /\d/.test(character)

                return (
                  <span
                    key={`digit-${index}-${shouldRoll ? `${animationState.tick}-${animationState.previousChars[index]}-${character}` : character}`}
                    className={`odometer-digit-slot ${shouldRoll ? 'is-rolling' : ''}`}
                    style={{ ['--roll-delay' as string]: `${index * 28}ms` }}
                  >
                    {shouldRoll ? (
                      <span className="odometer-roll-track">
                        <span className="odometer-roll-prev">{animationState.previousChars[index]}</span>
                        <span className="odometer-roll-next">{character}</span>
                      </span>
                    ) : (
                      <span className="odometer-digit">{character}</span>
                    )}
                  </span>
                )
              })}
            </div>
          </Stack>

          <ActionIcon variant="light" radius="xl" size="lg" onClick={onToggleSettings} aria-label="Open settings">
            <IconSettings size={16} />
          </ActionIcon>
        </Group>

        <Text size="xs" c="dimmed" ta="center" mt={6}>
          {trackingActionLabel}
        </Text>

        <div className="gauge-footer">
          <Card withBorder radius="lg" className="gauge-card">
            <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
              Route
            </Text>
            <Title order={4}>{routeSummary}</Title>
          </Card>
          <Card withBorder radius="lg" className="gauge-card">
            <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
              Next
            </Text>
            <Title order={4}>{nextInstruction ?? 'No active maneuver'}</Title>
            {roadName ? <Text size="sm" c="dimmed">{roadName}</Text> : null}
          </Card>
        </div>

      </Paper>
    </div>
  )
}

function toManeuverBadge(instruction?: string) {
  if (!instruction) {
    return {
      symbol: '↑',
      label: 'No maneuver',
    }
  }

  const normalized = instruction.toLowerCase()

  if (normalized.includes('u-turn')) {
    return { symbol: '↺', label: 'U-turn' }
  }

  if (normalized.includes('roundabout')) {
    return { symbol: '⟳', label: 'Roundabout' }
  }

  if (normalized.includes('arrive') || normalized.includes('destination')) {
    return { symbol: '◎', label: 'Arrive' }
  }

  if (normalized.includes('slight right')) {
    return { symbol: '↗', label: 'Slight right' }
  }

  if (normalized.includes('right')) {
    return { symbol: '↱', label: 'Turn right' }
  }

  if (normalized.includes('slight left')) {
    return { symbol: '↖', label: 'Slight left' }
  }

  if (normalized.includes('left')) {
    return { symbol: '↰', label: 'Turn left' }
  }

  return {
    symbol: '↑',
    label: instruction,
  }
}