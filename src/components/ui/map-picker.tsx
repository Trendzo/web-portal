import { useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Custom ink-coloured pin marker — a small SVG that matches the atelier palette
 * (deep ink fill + cream centre) instead of Leaflet's default blue.
 */
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

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

type MapPickerProps = {
  open: boolean;
  onClose: () => void;
  initial: { lat: number; lng: number };
  onConfirm: (lat: number, lng: number) => void;
};

/**
 * Map picker dialog. Centred on `initial`, click anywhere to drop / move the pin.
 * Submitting calls `onConfirm` with the chosen lat/lng. OpenStreetMap tiles, no API key.
 *
 * Default-exported so it can be lazy-imported by callers, keeping Leaflet (~150 KB)
 * out of the main bundle until the picker is actually opened.
 */
export default function MapPicker({ open, onClose, initial, onConfirm }: MapPickerProps) {
  const [coords, setCoords] = useState(initial);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Drop the pin where your store is</DialogTitle>
          <DialogDescription>
            Click anywhere on the map to set the pin. Drag to pan, scroll to zoom.
          </DialogDescription>
        </DialogHeader>

        <div className="h-[420px] overflow-hidden border border-ink/80 rounded-xs">
          <MapContainer
            center={[initial.lat, initial.lng]}
            zoom={14}
            scrollWheelZoom
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[coords.lat, coords.lng]} icon={inkMarker} />
            <ClickHandler onPick={(lat, lng) => setCoords({ lat, lng })} />
          </MapContainer>
        </div>

        <p className="mt-3 text-[12px] uppercase tracking-[0.14em] text-ink-3">
          Selected ·{' '}
          <span className="font-mono normal-case tracking-normal text-ink">
            {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
          </span>
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="ink"
            caps
            iconLeft={<Check className="size-3.5" />}
            onClick={() => onConfirm(coords.lat, coords.lng)}
          >
            Use this location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
