import { useEffect, useState } from 'react'
import { ActionIcon, Badge, Card, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { IconPlayerPause, IconPlayerPlay, IconSettings } from '@tabler/icons-react'
import type { OdometerStyle } from '../lib/settings'

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
  const progress = Math.min(speedValue / maxSpeed, 1)
  const dashOffset = 460 - 460 * progress
  const dialTicks = Array.from({ length: 7 }, (_, index) => {
    const startAngle = 140
    const endAngle = 400
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

  return (
    <div className={`speed-gauge-wrap speedo-theme-${themeId}`}>
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
            <circle
              className="gauge-progress"
              cx="160"
              cy="160"
              r="128"
              stroke="url(#speed-gradient)"
              strokeDasharray="460"
              strokeDashoffset={dashOffset}
            />
          </svg>

          <Stack gap={0} align="center" className="speed-text-block" role="status" aria-live="polite" aria-label={`Current speed ${speedText} ${unit}`}>
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