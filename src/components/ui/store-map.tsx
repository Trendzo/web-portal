import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/cn';

/** Ink pin matching the portal palette — same mark as MapPicker's. */
const inkMarker = L.divIcon({
  html: `
    <svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20C24 5.373 18.627 0 12 0z"
        fill="#1a1410"
      />
      <circle cx="12" cy="12" r="4.5" fill="#f4eee2" />
    </svg>`,
  iconSize: [24, 32],
  iconAnchor: [12, 32],
  className: 'map-ink-marker',
});

type StoreMapProps = {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
};

/**
 * Read-only store location map on CARTO's Positron basemap — muted,
 * near-monochrome cartography (à la Uber) instead of stock OSM colours.
 * Scroll zoom is off so the page doesn't get trapped while scrolling past.
 *
 * Default-exported for React.lazy so Leaflet (~150 KB) stays out of the
 * route chunk until a map is actually rendered.
 */
export default function StoreMap({ lat, lng, zoom = 15, className }: StoreMapProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      scrollWheelZoom={false}
      className={cn('z-0 h-full w-full', className)}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
      />
      <Marker position={[lat, lng]} icon={inkMarker} />
    </MapContainer>
  );
}
