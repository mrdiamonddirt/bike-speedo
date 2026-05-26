import { useEffect, useRef, useState } from 'react'

export type TrackerPoint = {
  coords: GeolocationCoordinates
  speedKph: number
  averageSpeedKph: number
  maxSpeedKph: number
  distanceMeters: number
}

type RouteSource = 'geolocation' | 'demo'
export type TrackerStatus = 'idle' | 'acquiring' | 'tracking' | 'paused' | 'denied' | 'error'
export type TrackerErrorCode =
  | 'permission-denied'
  | 'position-unavailable'
  | 'timeout'
  | 'unsupported'
  | 'unknown'

type TrackerError = {
  code: TrackerErrorCode
  message: string
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
  const [routeSource, setRouteSource] = useState<RouteSource>('demo')

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
        setRouteSource('demo')
      })
      return undefined
    }

    queueMicrotask(() => {
      setError(null)
      setIsWatching(true)
      setStatus('acquiring')
      setRouteSource('geolocation')
    })

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const { coords, timestamp } = position
        const previousPoint = lastPoint.current
        const nextSpeedKph = computeSpeedKph(coords, timestamp, previousPoint)
        const nextDistance = previousPoint
          ? haversine(previousPoint.lat, previousPoint.lng, coords.latitude, coords.longitude)
          : 0

        distanceMeters.current += nextDistance
        speedTrail.current = [...speedTrail.current.slice(-11), nextSpeedKph]
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
        setRouteSource('demo')
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
  }, [enabled, retryIndex])

  const retry = () => {
    setError(null)
    setRetryIndex((value) => value + 1)
  }

  return { current, permissionState, error, isWatching, routeSource, status, retry }
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
    return coords.speed * 3.6
  }

  if (!previous) {
    return 0
  }

  const seconds = Math.max((timestamp - previous.timestamp) / 1000, 0.5)
  const distanceMeters = haversine(previous.lat, previous.lng, coords.latitude, coords.longitude)
  return (distanceMeters / seconds) * 3.6
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