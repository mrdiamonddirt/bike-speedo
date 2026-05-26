import { useEffect, useMemo, type ReactElement, type ReactNode } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { LatLngBoundsExpression, LatLngExpression, LeafletMouseEvent, PathOptions } from 'leaflet'
import { Paper, Stack, Text } from '@mantine/core'

export type GeoPoint = { lat: number; lng: number }

export type RoutePlan = {
  coordinates: GeoPoint[]
  distanceKm: number
  durationMin: number
  steps: Array<{ instruction: string; roadName: string; distanceM: number }>
  maneuverLabel: string
}

type MapPanelProps = {
  current: GeoPoint | null
  destination: GeoPoint | null
  route: RoutePlan | null
  accent: string
  showDirections: boolean
  onSelectDestination: (coords: GeoPoint) => void
}

type MapContainerLikeProps = {
  center: LatLngExpression
  zoom: number
  scrollWheelZoom?: boolean
  className?: string
  children?: ReactNode
}

type TileLayerLikeProps = {
  attribution: string
  url: string
}

type CircleMarkerLikeProps = {
  center: LatLngExpression
  radius: number
  pathOptions: PathOptions
}

type PolylineLikeProps = {
  positions: LatLngExpression[]
  pathOptions: PathOptions
}

function MapClickHandler({ onSelectDestination }: { onSelectDestination: (coords: GeoPoint) => void }) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onSelectDestination({ lat: event.latlng.lat, lng: event.latlng.lng })
    },
  })

  return null
}

function FitRoute({ points }: { points: GeoPoint[] }) {
  const map = useMap()

  useEffect(() => {
    if (!points.length) {
      return
    }

    const latLngs: LatLngBoundsExpression = points.map((point) => [point.lat, point.lng])
    map.fitBounds(latLngs, { padding: [24, 24], maxZoom: 16 })
  }, [map, points])

  return null
}

export function MapPanel({ current, destination, route, accent, showDirections, onSelectDestination }: MapPanelProps) {
  const center = useMemo<LatLngExpression>(() => {
    if (current) {
      return [current.lat, current.lng]
    }

    return [37.7749, -122.4194]
  }, [current])

  const path = route?.coordinates.map((point) => [point.lat, point.lng] as LatLngExpression) ?? []
  const currentPoint = current ? ([current.lat, current.lng] as LatLngExpression) : null
  const destinationPoint = destination ? ([destination.lat, destination.lng] as LatLngExpression) : null

  const MapContainerAny = MapContainer as unknown as (props: MapContainerLikeProps) => ReactElement
  const TileLayerAny = TileLayer as unknown as (props: TileLayerLikeProps) => ReactElement
  const CircleMarkerAny = CircleMarker as unknown as (props: CircleMarkerLikeProps) => ReactElement
  const PolylineAny = Polyline as unknown as (props: PolylineLikeProps) => ReactElement

  return (
    <div className="map-wrap">
      <MapContainerAny center={center} zoom={14} scrollWheelZoom className="leaflet-map">
        <TileLayerAny
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onSelectDestination={onSelectDestination} />
        {currentPoint ? <CircleMarkerAny center={currentPoint} radius={10} pathOptions={{ color: accent, fillColor: accent, fillOpacity: 0.95 }} /> : null}
        {destinationPoint ? <CircleMarkerAny center={destinationPoint} radius={8} pathOptions={{ color: '#fff', fillColor: '#fff', fillOpacity: 0.8 }} /> : null}
        {path.length ? <PolylineAny positions={path} pathOptions={{ color: accent, weight: 5, opacity: 0.9 }} /> : null}
        <FitRoute points={[...(current ? [current] : []), ...(destination ? [destination] : [])]} />
      </MapContainerAny>

      {showDirections && route ? (
        <Paper className="route-overlay" radius="lg" withBorder>
          <Stack gap={4}>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">
              Next turn
            </Text>
            <Text fw={700}>{route.steps[0]?.instruction ?? route.maneuverLabel}</Text>
            <Text size="sm" c="dimmed">
              {route.steps[0] ? `${route.steps[0].roadName} · ${(route.steps[0].distanceM / 1000).toFixed(1)} km` : 'Route ready'}
            </Text>
          </Stack>
        </Paper>
      ) : null}
    </div>
  )
}