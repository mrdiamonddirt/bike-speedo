export type TripSummary = {
  id: string
  startedAt: number
  endedAt: number
  distanceMeters: number
  averageSpeedKph: number
  maxSpeedKph: number
  unit: 'mph' | 'kph'
}

export const MAX_TRIPS = 50

export function clampTrips(trips: TripSummary[]) {
  return trips
    .slice()
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, MAX_TRIPS)
}

export function formatTripDuration(startedAt: number, endedAt: number) {
  const seconds = Math.max(Math.round((endedAt - startedAt) / 1000), 0)
  const minutes = Math.floor(seconds / 60)
  const remSeconds = seconds % 60
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const remMinutes = minutes % 60
    return `${hours}h ${remMinutes}m`
  }

  return `${minutes}m ${remSeconds}s`
}

export function formatTripDate(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
