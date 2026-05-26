import { useEffect, useState } from 'react'

export type OdometerStyle = 'classic' | 'retro-roll' | 'eight-segment' | 'lcd' | 'mechanical'

export type BikeSpeedoSettings = {
  themeId: string
  units: 'mph' | 'kph'
  accent: string
  gaugeMax: number
  mapVisible: boolean
  showDirections: boolean
  odometerStyle: OdometerStyle
}

export const DEFAULT_SETTINGS: BikeSpeedoSettings = {
  themeId: 'neon-arc',
  units: 'mph',
  accent: '#20a4ff',
  gaugeMax: 40,
  mapVisible: true,
  showDirections: true,
  odometerStyle: 'classic',
}

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }

    const stored = window.localStorage.getItem(key)
    if (!stored) {
      return initialValue
    }

    try {
      const parsed = JSON.parse(stored) as T
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        initialValue &&
        typeof initialValue === 'object' &&
        !Array.isArray(initialValue)
      ) {
        return { ...(initialValue as object), ...(parsed as object) } as T
      }

      return parsed
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}