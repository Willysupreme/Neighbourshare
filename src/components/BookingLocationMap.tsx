"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Circle, Popup } from "react-leaflet";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

const FUZZ_RADIUS_METERS = 300;

export function BookingLocationMap({
  latitude,
  longitude,
  capturedAt,
  label,
}: {
  latitude: number;
  longitude: number;
  capturedAt: string;
  label: string;
}) {
  const capturedAgo = formatRelativeTime(capturedAt);

  return (
    <div className="overflow-hidden rounded border border-line">
      <MapContainer
        center={[latitude, longitude]}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: "220px", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {/* A shaded uncertainty circle rather than a pinpoint marker - this
            honestly represents that the location is approximate (fuzzed by
            up to ~300m), not an exact position. */}
        <Circle
          center={[latitude, longitude]}
          radius={FUZZ_RADIUS_METERS}
          pathOptions={{ color: "#a6790a", fillColor: "#a6790a", fillOpacity: 0.25 }}
        >
          <Popup>
            {label} - approximate area
            <br />
            Shared {capturedAgo}
          </Popup>
        </Circle>
      </MapContainer>
      <p className="bg-paper-raised px-3 py-2 font-tag text-xs text-neutral-500">
        {label} - approximate area (±{FUZZ_RADIUS_METERS}m) - shared {capturedAgo}
      </p>
    </div>
  );
}
