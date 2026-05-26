import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  List,
  Loader,
  Modal,
  Paper,
  Select,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core'
import {
  IconActivity,
  IconAlertTriangle,
  IconArrowRight,
  IconMap2,
  IconMapPin,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconTarget,
  IconTrack,
} from '@tabler/icons-react'
import { MapPanel, type RoutePlan } from './components/MapPanel'
import { SpeedGauge } from './components/SpeedGauge'
import {
  DEFAULT_SETTINGS,
  type BikeSpeedoSettings,
  usePersistentState,
} from './lib/settings'
import { useGeolocationTracker } from './lib/useGeolocationTracker'
import { fetchRoutePlan, formatDistance, formatSpeed } from './lib/routing'
import { clampTrips, formatTripDate, formatTripDuration, type TripSummary } from './lib/trips'
import './App.css'

const ACCENT_OPTIONS = [
  { value: '#20a4ff', label: 'Sky' },
  { value: '#34d399', label: 'Emerald' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#fb7185', label: 'Rose' },
]

const ODOMETER_STYLE_OPTIONS = [
  { value: 'classic', label: 'Classic Glow' },
  { value: 'retro-roll', label: 'Retro Rolling' },
  { value: 'eight-segment', label: '8-Segment Display' },
  { value: 'lcd', label: 'LCD Panel' },
  { value: 'mechanical', label: 'Mechanical Drum' },
]

type RouteStatus = 'idle' | 'loading' | 'ready' | 'error'
type TripMode = 'idle' | 'active' | 'paused'

type TripSessionStart = {
  startedAt: number
  baseDistanceMeters: number
  startMaxSpeedKph: number
}

function App() {
  const [settings, setSettings] = usePersistentState<BikeSpeedoSettings>(
    'bike-speedo-settings',
    DEFAULT_SETTINGS,
  )
  const [trips, setTrips] = usePersistentState<TripSummary[]>('bike-speedo-trips', [])
  const [trackingEnabled, setTrackingEnabled] = useState(false)
  const [tripMode, setTripMode] = useState<TripMode>('idle')
  const [showSettings, setShowSettings] = useState(false)
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null)
  const [route, setRoute] = useState<RoutePlan | null>(null)
  const [routeStatus, setRouteStatus] = useState<RouteStatus>('idle')
  const [routeError, setRouteError] = useState<string | null>(null)

  const tripStartRef = useRef<TripSessionStart | null>(null)

  const { current, permissionState, error, isWatching, status, retry } = useGeolocationTracker(trackingEnabled)

  const startTripSession = () => {
    if (!current?.coords || tripStartRef.current) {
      return
    }

    tripStartRef.current = {
      startedAt: Date.now(),
      baseDistanceMeters: current.distanceMeters,
      startMaxSpeedKph: current.maxSpeedKph,
    }
  }

  const finalizeTripSession = () => {
    const tripStart = tripStartRef.current
    if (!tripStart || !current) {
      tripStartRef.current = null
      return
    }

    const endedAt = Date.now()
    const distanceMeters = Math.max(current.distanceMeters - tripStart.baseDistanceMeters, 0)
    const maxSpeedKph = Math.max(current.maxSpeedKph, tripStart.startMaxSpeedKph)
    const durationMs = endedAt - tripStart.startedAt

    if (distanceMeters >= 25 && durationMs >= 30_000) {
      const nextTrip: TripSummary = {
        id: `${tripStart.startedAt}-${endedAt}`,
        startedAt: tripStart.startedAt,
        endedAt,
        distanceMeters,
        averageSpeedKph: current.averageSpeedKph,
        maxSpeedKph,
        unit: settings.units,
      }

      setTrips((previous) => clampTrips([nextTrip, ...previous]))
    }

    tripStartRef.current = null
  }

  const clearRouteContext = () => {
    setDestination(null)
    setRoute(null)
    setRouteStatus('idle')
    setRouteError(null)
  }

  const handleStartTracking = () => {
    setTrackingEnabled(true)
    setTripMode('active')
    startTripSession()
  }

  const handlePauseTracking = () => {
    if (tripMode !== 'active') {
      return
    }

    setTrackingEnabled(false)
    setTripMode('paused')
  }

  const handleResumeTracking = () => {
    if (tripMode !== 'paused') {
      return
    }

    setTrackingEnabled(true)
    setTripMode('active')
  }

  const handleStopRoute = () => {
    finalizeTripSession()
    setTrackingEnabled(false)
    setTripMode('idle')
    clearRouteContext()
  }

  const handleTrackingAction = () => {
    if (tripMode === 'active') {
      handlePauseTracking()
      return
    }

    if (tripMode === 'paused') {
      handleResumeTracking()
      return
    }

    handleStartTracking()
  }

  const trackingActionLabel = tripMode === 'active' ? 'Pause tracking' : tripMode === 'paused' ? 'Resume tracking' : 'Start tracking'

  useEffect(() => {
    if (tripMode !== 'active' || !current?.coords) {
      return
    }

    startTripSession()
  }, [current, tripMode])

  useEffect(() => {
    if (!current?.coords || !destination) {
      setRoute(null)
      setRouteStatus('idle')
      setRouteError(null)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setRouteStatus('loading')
      setRouteError(null)

      fetchRoutePlan({
        origin: {
          lat: current.coords.latitude,
          lng: current.coords.longitude,
        },
        destination,
        signal: controller.signal,
      })
        .then((plan) => {
          if (!plan) {
            setRoute(null)
            setRouteStatus('error')
            setRouteError('No route could be generated for this destination.')
            return
          }

          setRoute(plan)
          setRouteStatus('ready')
        })
        .catch((cause) => {
          if (controller.signal.aborted) {
            return
          }

          setRoute(null)
          setRouteStatus('error')
          setRouteError(cause instanceof Error ? cause.message : 'Route lookup failed.')
        })
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [current?.coords, destination])

  const speedText = formatSpeed(current?.speedKph ?? 0, settings.units)

  const averageText = formatSpeed(current?.averageSpeedKph ?? 0, settings.units)

  const maxText = formatSpeed(current?.maxSpeedKph ?? 0, settings.units)

  const odometerMeters = current?.distanceMeters ?? 0
  const odometerDistance = settings.units === 'mph' ? odometerMeters * 0.000621371 : odometerMeters / 1000
  const odometerText = odometerDistance.toFixed(settings.units === 'mph' ? 1 : 2)

  const nextInstruction = route?.steps[0]
  const routeSummary = route
    ? `${route.distanceKm.toFixed(1)} km • ${Math.round(route.durationMin)} min`
    : destination
      ? 'Route preview pending'
      : 'Set a destination'

  const hasRouteContext = Boolean(current?.coords && destination)
  const resolvedRouteStatus: RouteStatus = hasRouteContext ? routeStatus : 'idle'
  const resolvedRouteError = hasRouteContext ? routeError : null
  const resolvedRoute = hasRouteContext && routeStatus === 'ready' ? route : null

  const isAcquiring = status === 'acquiring' || (!current && tripMode === 'active')
  const accuracy = current?.coords?.accuracy
  const hasLowAccuracy = typeof accuracy === 'number' && accuracy > 50

  const topbarActionIcon =
    tripMode === 'active' ? <IconPlayerPause size={18} /> : <IconPlayerPlay size={18} />
  const topbarActionText = tripMode === 'active' ? 'PAUSE' : tripMode === 'paused' ? 'RESUME' : 'START'

  return (
    <div className="app-shell" style={{ ['--accent' as string]: settings.accent }}>
      <header className="topbar">
        <Group gap="xs" wrap="nowrap">
          <Button
            radius="xl"
            variant={tripMode === 'active' ? 'filled' : 'outline'}
            color="dark"
            leftSection={topbarActionIcon}
            className="status-pill"
            onClick={handleTrackingAction}
            aria-label={trackingActionLabel}
          >
            {topbarActionText}
          </Button>

          {tripMode !== 'idle' ? (
            <Button
              radius="xl"
              variant="outline"
              color="red"
              leftSection={<IconPlayerStop size={18} />}
              className="status-pill"
              onClick={handleStopRoute}
              aria-label="Stop route and save trip"
            >
              STOP
            </Button>
          ) : null}
        </Group>

        <Paper radius="xl" className="gps-pill" withBorder>
          <Group gap={8} wrap="nowrap">
            <span className={`pulse ${isWatching ? 'pulse-on' : ''}`} />
            <Text size="sm" fw={700} c="dimmed">
              GPS
            </Text>
            <Badge variant="light" color={permissionState === 'granted' ? 'teal' : permissionState === 'denied' ? 'red' : 'gray'} role="status" aria-live="polite">
              {permissionState}
            </Badge>
          </Group>
        </Paper>

        <Button
          radius="xl"
          variant="filled"
          color="dark"
          leftSection={<IconMap2 size={18} />}
          className="status-pill status-pill-right"
          onClick={() => setShowSettings((value) => !value)}
          aria-label="Open display settings"
        >
          SETTINGS
        </Button>
      </header>

      <Modal
        opened={showSettings}
        onClose={() => setShowSettings(false)}
        title="Bike Speedo Settings"
        centered
        radius="xl"
      >
        <Stack gap="md">
          <SegmentedControl
            value={settings.units}
            onChange={(value) => setSettings({ ...settings, units: value as 'mph' | 'kph' })}
            data={[
              { label: 'MPH', value: 'mph' },
              { label: 'KPH', value: 'kph' },
            ]}
          />

          <Select
            label="Accent color"
            value={settings.accent}
            onChange={(value) =>
              setSettings({ ...settings, accent: value ?? DEFAULT_SETTINGS.accent })
            }
            data={ACCENT_OPTIONS}
          />

          <Select
            label="Odometer style"
            value={settings.odometerStyle}
            onChange={(value) =>
              setSettings({
                ...settings,
                odometerStyle: (value as BikeSpeedoSettings['odometerStyle']) ?? DEFAULT_SETTINGS.odometerStyle,
              })
            }
            data={ODOMETER_STYLE_OPTIONS}
          />

          <Slider
            label={(value) => `Gauge max ${value}`}
            min={20}
            max={80}
            step={5}
            value={settings.gaugeMax}
            onChange={(value) => setSettings({ ...settings, gaugeMax: value })}
          />

          <Switch
            checked={settings.mapVisible}
            onChange={(event) => setSettings({ ...settings, mapVisible: event.currentTarget.checked })}
            label="Show map"
          />

          <Switch
            checked={settings.showDirections}
            onChange={(event) =>
              setSettings({ ...settings, showDirections: event.currentTarget.checked })
            }
            label="Show directions"
          />
        </Stack>
      </Modal>

      <main className="content-grid">
        <section className="speed-stage">
          <SpeedGauge
            speedText={speedText}
            maxSpeed={settings.gaugeMax}
            unit={settings.units}
            accent={settings.accent}
            tripMode={tripMode}
            speedValue={current?.speedKph ?? 0}
            odometerText={odometerText}
            odometerStyle={settings.odometerStyle}
            routeSummary={routeSummary}
            nextInstruction={nextInstruction?.instruction}
            roadName={nextInstruction?.roadName}
            isAcquiring={isAcquiring}
            trackingActionLabel={trackingActionLabel}
            trackingActionAriaLabel={trackingActionLabel}
            onTrackingAction={handleTrackingAction}
            onToggleSettings={() => setShowSettings((value) => !value)}
          />

          <Group className="mini-metric-row" gap="xs">
            <Badge variant="light" color={isWatching ? 'teal' : 'gray'}>
              {status}
            </Badge>
            <Badge leftSection={<IconTrack size={12} />} variant="light" color={tripMode === 'active' ? 'teal' : 'gray'}>
              {tripMode === 'active' ? 'trip active' : tripMode === 'paused' ? 'trip paused' : 'trip idle'}
            </Badge>
            {hasLowAccuracy ? (
              <Badge leftSection={<IconAlertTriangle size={12} />} color="yellow" variant="light">
                Low GPS accuracy
              </Badge>
            ) : null}
          </Group>

          <Group grow className="stats-grid">
            <Card withBorder radius="lg" className="stat-card">
              <Text className="stat-label">Max Speed</Text>
              <Title order={2}>{maxText}</Title>
            </Card>
            <Card withBorder radius="lg" className="stat-card">
              <Text className="stat-label">Avg Speed</Text>
              <Title order={2}>{averageText}</Title>
            </Card>
          </Group>

          <Paper className="panel route-panel" radius="xl" withBorder>
            <Group justify="space-between" mb="sm">
              <div>
                <Text c="dimmed" size="sm" tt="uppercase" fw={700}>
                  Directions
                </Text>
                <Title order={4}>
                  {nextInstruction?.instruction ??
                    (destination
                      ? resolvedRouteStatus === 'loading'
                        ? 'Calculating route'
                        : 'Route will appear shortly'
                      : 'Set a destination to begin navigation')}
                </Title>
              </div>
              <Badge color={resolvedRoute ? 'blue' : 'gray'} variant="light">
                {resolvedRoute?.steps.length ?? 0} steps
              </Badge>
            </Group>

            <Text size="sm" c="dimmed" mb="sm">
              {resolvedRoute?.maneuverLabel ??
                (isAcquiring
                  ? 'Acquiring GPS fix for live route updates.'
                  : 'Route preview and directions appear after location and destination are available.')}
            </Text>

            {resolvedRouteStatus === 'loading' ? (
              <Group gap="xs" mb="sm">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">
                  Fetching cycle route
                </Text>
              </Group>
            ) : null}

            {error ? (
              <Alert color="red" icon={<IconAlertTriangle size={16} />} title="Location issue" mb="sm">
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Text size="sm">{error.message}</Text>
                  {error.code !== 'permission-denied' ? (
                    <Button size="xs" variant="light" onClick={retry}>
                      Retry GPS
                    </Button>
                  ) : null}
                </Group>
              </Alert>
            ) : null}

            {resolvedRouteError ? (
              <Alert color="orange" icon={<IconAlertTriangle size={16} />} title="Route issue" mb="sm">
                <Text size="sm">{resolvedRouteError}</Text>
              </Alert>
            ) : null}

            {current?.coords ? (
              <Text size="sm" c="dimmed" mt="sm">
                Accuracy {Math.round(current.coords.accuracy)}m • Trip {formatDistance(current.distanceMeters, settings.units)}
              </Text>
            ) : null}
          </Paper>
        </section>

        <aside className={`map-column ${settings.mapVisible ? 'open' : 'closed'}`}>
          <Paper className="panel map-shell" radius="xl" withBorder>
            <Group justify="space-between" mb="sm">
              <div>
                <Text c="dimmed" size="sm" tt="uppercase" fw={700}>
                  Live Map
                </Text>
                <Title order={4}>Tap the map to set a destination</Title>
              </div>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconTarget size={14} />}
                onClick={clearRouteContext}
                aria-label="Clear destination and route"
                disabled={!destination && !route}
              >
                Clear route
              </Button>
            </Group>

            <Text size="sm" c="dimmed" mb="sm">
              Set destination-only mode by selecting a point on the map while tracking is paused or idle.
            </Text>

            <MapPanel
              current={current?.coords ? { lat: current.coords.latitude, lng: current.coords.longitude } : null}
              destination={destination ?? null}
              route={resolvedRoute}
              accent={settings.accent}
              showDirections={settings.showDirections}
              onSelectDestination={(coords) => {
                setDestination(coords)
              }}
            />

            <Divider my="md" />

            <Group gap="xs">
              <Badge leftSection={<IconMapPin size={12} />} variant="light">
                Current position
              </Badge>
              <Badge leftSection={<IconArrowRight size={12} />} variant="light">
                {destination ? 'Destination set' : 'No destination'}
              </Badge>
            </Group>
          </Paper>

          <Paper className="panel trips-panel" radius="xl" withBorder mt="lg">
            <Group justify="space-between" mb="sm">
              <Title order={4}>Trips</Title>
              <Group gap="xs">
                <IconActivity size={18} />
                {trips.length ? (
                  <Button size="xs" variant="light" color="red" onClick={() => setTrips([])}>
                    Clear
                  </Button>
                ) : null}
              </Group>
            </Group>

            {trips.length ? (
              <List spacing="sm" size="sm">
                {trips.slice(0, 5).map((trip) => (
                  <List.Item key={trip.id}>
                    <Text fw={600}>{formatTripDate(trip.startedAt)}</Text>
                    <Text c="dimmed" size="xs">
                      {formatTripDuration(trip.startedAt, trip.endedAt)} • {formatDistance(trip.distanceMeters, trip.unit)} • Avg{' '}
                      {formatSpeed(trip.averageSpeedKph, trip.unit)} {trip.unit.toUpperCase()} • Max {formatSpeed(trip.maxSpeedKph, trip.unit)} {trip.unit.toUpperCase()}
                    </Text>
                  </List.Item>
                ))}
              </List>
            ) : (
              <Text c="dimmed" size="sm">
                No trips yet. Start tracking and ride to build your history.
              </Text>
            )}
          </Paper>
        </aside>
      </main>
    </div>
  )
}

export default App
