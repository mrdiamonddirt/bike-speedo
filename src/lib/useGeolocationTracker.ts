import { useCallback, useEffect, useRef, useState } from 'react'

export type TrackerPoint = {
  coords: GeolocationCoordinates
  speedKph: number
  averageSpeedKph: number
  maxSpeedKph: number
  distanceMeters: number
}
export type TrackerStatus = 'idle' | 'acquiring' | 'tracking' | 'paused' | 'denied' | 'error'
export type TrackerErrorCode =
  | 'permission-denied'
  | 'position-unavailable'
  | 'timeout'
  | 'unsupported'
  | 'insecure-context'
  | 'unknown'

type TrackerError = {
  code: TrackerErrorCode
  message: string
}

type PermissionRequestOptions = {
  silent?: boolean
}

export function useGeolocationTracker(enabled: boolean) {
  const watchId = useRef<number | null>(null)
  const lastPoint = useRef<{ lat: number; lng: number; timestamp: number } | null>(null)
  const distanceMeters = useRef(0)
  const maxSpeedKph = useRef(0)
  const speedTrail = useRef<number[]>([])

  const [current, setCurrent] = useState<TrackerPoint | null>(null)
  const [permissionState, setPermissionState] = useState<'granted' | 'prompt' | 'denied' | 'unknown'>('unknown')
  const [error, setError] = useState<TrackerError | null>(null)
  const [isWatching, setIsWatching] = useState(false)
  const [status, setStatus] = useState<TrackerStatus>('idle')
  const [retryIndex, setRetryIndex] = useState(0)

  const commitPosition = useCallback((position: GeolocationPosition) => {
    const { coords, timestamp } = position
    const previousPoint = lastPoint.current
    const nextDistance = previousPoint
      ? haversine(previousPoint.lat, previousPoint.lng, coords.latitude, coords.longitude)
      : 0
    const rawSpeedKph = computeSpeedKph(coords, timestamp, previousPoint)
    const nextSpeedKph = smoothSpeedKph(rawSpeedKph, speedTrail.current, coords.accuracy, nextDistance)

    distanceMeters.current += nextDistance
    speedTrail.current = [...speedTrail.current.slice(-23), nextSpeedKph]
    const averageSpeedKph = speedTrail.current.length
      ? speedTrail.current.reduce((sum, value) => sum + value, 0) / speedTrail.current.length
      : 0
    maxSpeedKph.current = Math.max(maxSpeedKph.current, nextSpeedKph)

    lastPoint.current = {
      lat: coords.latitude,
      lng: coords.longitude,
      timestamp,
    }

    setCurrent({
      coords,
      speedKph: nextSpeedKph,
      averageSpeedKph,
      maxSpeedKph: maxSpeedKph.current,
      distanceMeters: Number.isFinite(distanceMeters.current) ? distanceMeters.current : 0,
    })
    setError(null)
    setStatus('tracking')
  }, [])

  useEffect(() => {
    if (!navigator.permissions?.query) {
      return
    }

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        setPermissionState(status.state as typeof permissionState)
        status.onchange = () => setPermissionState(status.state as typeof permissionState)
      })
      .catch(() => setPermissionState('unknown'))
  }, [])

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => {
        setIsWatching(false)
        setStatus('paused')
      })
      return undefined
    }

    if (!navigator.geolocation) {
      queueMicrotask(() => {
        setError({
          code: 'unsupported',
          message: 'Geolocation is not available in this browser.',
        })
        setIsWatching(false)
        setStatus('error')
      })
      return undefined
    }

    if (!window.isSecureContext) {
      queueMicrotask(() => {
        setError({
          code: 'insecure-context',
          message:
            'GPS requires HTTPS on mobile. Open the app over HTTPS (or localhost on this device) and try again.',
        })
        setIsWatching(false)
        setStatus('error')
      })
      return undefined
    }

    queueMicrotask(() => {
      setError(null)
      setIsWatching(true)
      setStatus('acquiring')
    })

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        commitPosition(position)
      },
      (geoError) => {
        const nextError = mapGeoError(geoError)
        setError(nextError)
        if (nextError.code === 'permission-denied') {
          setPermissionState('denied')
          setStatus('denied')
        } else {
          setStatus('error')
        }
        setIsWatching(false)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      },
    )

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current)
        watchId.current = null
      }
      setIsWatching(false)
    }
  }, [commitPosition, enabled, retryIndex])

  const retry = () => {
    setError(null)
    setRetryIndex((value) => value + 1)
  }

  const resetMetrics = useCallback(() => {
    lastPoint.current = null
    distanceMeters.current = 0
    maxSpeedKph.current = 0
    speedTrail.current = []

    setCurrent((previous) => {
      if (!previous) {
        return previous
      }

      return {
        ...previous,
        averageSpeedKph: 0,
        maxSpeedKph: 0,
        distanceMeters: 0,
      }
    })
  }, [])

  const requestPermission = useCallback((options?: PermissionRequestOptions) => {
    const silent = options?.silent ?? false

    if (!navigator.geolocation) {
      if (!silent) {
        setError({
          code: 'unsupported',
          message: 'Geolocation is not available in this browser.',
        })
        setStatus('error')
      }
      return Promise.resolve(false)
    }

    if (!window.isSecureContext) {
      if (!silent) {
        setError({
          code: 'insecure-context',
          message:
            'GPS requires HTTPS on mobile. Open the app over HTTPS (or localhost on this device) and try again.',
        })
        setStatus('error')
      }
      return Promise.resolve(false)
    }

    if (!silent) {
      setError(null)
      setStatus('acquiring')
    }

    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPermissionState('granted')
          commitPosition(position)
          resolve(true)
        },
        (geoError) => {
          const nextError = mapGeoError(geoError)
          if (!silent) {
            setError(nextError)
          }
          if (nextError.code === 'permission-denied') {
            setPermissionState('denied')
            if (!silent) {
              setStatus('denied')
            }
          } else {
            if (!silent) {
              setStatus('error')
            }
          }
          resolve(false)
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 10000,
        },
      )
    })
  }, [commitPosition])

  return { current, permissionState, error, isWatching, status, retry, requestPermission, resetMetrics }
}

function mapGeoError(geoError: GeolocationPositionError): TrackerError {
  if (geoError.code === geoError.PERMISSION_DENIED) {
    return {
      code: 'permission-denied',
      message: 'Location permission denied. Enable location access in browser settings.',
    }
  }

  if (geoError.code === geoError.TIMEOUT) {
    return {
      code: 'timeout',
      message: 'Timed out while requesting location. Try moving to a clearer outdoor area.',
    }
  }

  if (geoError.code === geoError.POSITION_UNAVAILABLE) {
    return {
      code: 'position-unavailable',
      message: 'Location is currently unavailable. Check device GPS and try again.',
    }
  }

  return {
    code: 'unknown',
    message: geoError.message || 'Unable to access location right now.',
  }
}

function computeSpeedKph(
  coords: GeolocationCoordinates,
  timestamp: number,
  previous: { lat: number; lng: number; timestamp: number } | null,
) {
  if (typeof coords.speed === 'number' && coords.speed >= 0) {
    return sanitizeSpeedKph(coords.speed * 3.6)
  }

  if (!previous) {
    return 0
  }

  if (coords.latitude === previous.lat && coords.longitude === previous.lng) {
    return 0
  }

  const seconds = (timestamp - previous.timestamp) / 1000
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 8) {
    return 0
  }

  const distanceMeters = haversine(previous.lat, previous.lng, coords.latitude, coords.longitude)
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return 0
  }

  if (typeof coords.accuracy === 'number') {
    const stationaryRadiusMeters = Math.max(3, coords.accuracy * 0.45)
    if (distanceMeters <= stationaryRadiusMeters) {
      return 0
    }
  }

  return sanitizeSpeedKph((distanceMeters / seconds) * 3.6)
}

function smoothSpeedKph(rawSpeedKph: number, trail: number[], accuracyMeters?: number, distanceMeters?: number) {
  let nextSpeedKph = sanitizeSpeedKph(rawSpeedKph)
  const referenceSpeedKph = trail.length ? median(trail.slice(-7)) : 0

  if (typeof accuracyMeters === 'number' && accuracyMeters > 60 && nextSpeedKph < 12) {
    nextSpeedKph = 0
  }

  if (
    typeof accuracyMeters === 'number' &&
    typeof distanceMeters === 'number' &&
    distanceMeters <= Math.max(2.5, accuracyMeters * 0.35) &&
    nextSpeedKph < Math.max(10, referenceSpeedKph + 4)
  ) {
    nextSpeedKph = 0
  }

  if (trail.length >= 4) {
    const spikeAllowanceKph = Math.max(8, referenceSpeedKph * 0.75)
    if (nextSpeedKph > referenceSpeedKph + spikeAllowanceKph) {
      nextSpeedKph = referenceSpeedKph
    }
  }

  const weightedTrail = [...trail.slice(-5), nextSpeedKph]
  const smoothedSpeedKph = weightedAverage(weightedTrail)
  return smoothedSpeedKph < 0.6 ? 0 : sanitizeSpeedKph(smoothedSpeedKph)
}

function weightedAverage(values: number[]) {
  if (!values.length) {
    return 0
  }

  const weighted = values.reduce(
    (state, value, index) => {
      const weight = index + 1
      return {
        numerator: state.numerator + value * weight,
        denominator: state.denominator + weight,
      }
    },
    { numerator: 0, denominator: 0 },
  )

  return weighted.denominator ? weighted.numerator / weighted.denominator : 0
}

function median(values: number[]) {
  if (!values.length) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const midpoint = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[midpoint - 1] + sorted[midpoint]) / 2
  }

  return sorted[midpoint]
}

function sanitizeSpeedKph(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0
  }

  return Math.min(value, 160)
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadius = 6371000
  const toRadians = (value: number) => (value * Math.PI) / 180
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}