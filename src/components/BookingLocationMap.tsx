"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

// Custom rust-colored pin as inline SVG, matching the app's design system -
// avoids react-leaflet's well-known "default marker icon 404s" bundler
// issue entirely, since no external image file is referenced at all.
const pinIcon = L.divIcon({
  className: "",
  html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="#a8471f"/>
    <circle cx="14" cy="14" r="5.5" fill="#efece2"/>
  </svg>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -32],
});

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
        <Marker position={[latitude, longitude]} icon={pinIcon}>
          <Popup>
            {label}
            <br />
            Shared {capturedAgo}
          </Popup>
        </Marker>
      </MapContainer>
      <p className="bg-paper-raised px-3 py-2 font-tag text-xs text-neutral-500">
        {label} - shared {capturedAgo}
      </p>
    </div>
  );
}
