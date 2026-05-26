import type { RoutePlan } from '../components/MapPanel'

type RouteSource = 'geolocation' | 'demo'

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/cycling'

export function buildDemoDestination(lat: number, lng: number) {
  return {
    lat: lat + 0.0085,
    lng: lng + 0.0105,
  }
}

export async function fetchRoutePlan({
  origin,
  destination,
  source,
  signal,
}: {
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  source: RouteSource
  signal?: AbortSignal
}): Promise<RoutePlan | null> {
  if (!isValidCoordinate(origin.lat, origin.lng) || !isValidCoordinate(destination.lat, destination.lng)) {
    return null
  }

  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
  const url = `${OSRM_BASE_URL}/${coordinates}?alternatives=false&steps=true&overview=full&geometries=geojson`

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Routing request failed with ${response.status}`)
  }

  const data = (await response.json()) as OsrmResponse
  const route = data.routes?.[0]
  const leg = route?.legs?.[0]
  if (!route || !leg || !route.geometry?.coordinates?.length) {
    return null
  }

  const routeCoordinates = route.geometry.coordinates
    .filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng))
    .map(([lng, lat]) => ({ lat, lng }))

  if (routeCoordinates.length < 2) {
    return null
  }

  const steps = leg.steps?.length
    ? leg.steps.map((step) => ({
        instruction: toInstruction(step),
        roadName: step.name || 'Unnamed road',
        distanceM: step.distance,
      }))
    : [
        {
          instruction: 'Follow the highlighted route to your destination',
          roadName: 'Cycling route',
          distanceM: route.distance,
        },
      ]

  return {
    coordinates: routeCoordinates,
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    maneuverLabel: source === 'geolocation' ? 'Live GPS routing' : 'Demo route preview',
    steps,
  }
}

export function formatSpeed(speedKph: number, unit: 'mph' | 'kph') {
  const speed = unit === 'mph' ? speedKph * 0.621371 : speedKph
  return speed.toFixed(speed >= 10 ? 0 : 1)
}

export function formatDistance(distanceMeters: number, unit: 'mph' | 'kph') {
  if (unit === 'mph') {
    return `${(distanceMeters * 0.000621371).toFixed(1)} mi`
  }

  return `${(distanceMeters / 1000).toFixed(2)} km`
}

function isValidCoordinate(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

function toInstruction(step: OsrmStep) {
  const maneuverType = step.maneuver?.type
  const modifier = step.maneuver?.modifier
  const instruction = [maneuverType, modifier].filter(Boolean).join(' ')
  const normalized = instruction.replace(/_/g, ' ').trim()
  if (!normalized) {
    return step.name ? `Continue on ${step.name}` : 'Continue on the route'
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

type OsrmResponse = {
  routes?: Array<{
    distance: number
    duration: number
    geometry: {
      coordinates: [number, number][]
    }
    legs?: Array<{
      steps?: OsrmStep[]
    }>
  }>
}

type OsrmStep = {
  name: string
  distance: number
  maneuver?: {
    type?: string
    modifier?: string
  }
}