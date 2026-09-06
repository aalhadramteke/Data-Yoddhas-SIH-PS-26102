"use client";
import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function MapView({ projects }) {
  const [map, setMap] = useState(null);

  useEffect(() => {
    // Initialize map ONLY once
    if (map) return;

    try {
      const mapInstance = L.map('map-container', {
        center: [28.6139, 77.2090],
        zoom: 12,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstance);

      setMap(mapInstance);

      return () => {
        mapInstance.remove();
        setMap(null);
      };
    } catch (e) {
      console.error("Leaflet Init Error:", e);
    }
  }, []);

  // Update markers when projects change
  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Add new markers
    projects.forEach((p) => {
      const marker = L.marker([p.latitude, p.longitude]).addTo(map);
      marker.bindPopup(`
        <div style="font-family: sans-serif; padding: 5px;">
          <strong style="font-size: 14px;">${p.project_name}</strong><br/>
          <span style="font-size: 12px;">ID: ${p.project_id} | MP: ${p.mp_id}</span><br/>
          <div style="margin-top: 5px; padding: 2px 5px; font-size: 11px; font-weight: bold; border-radius: 4px; 
            ${p.risk_score > 70 ? 'background: #fee2e2; color: #b91c1c;' : 'background: #dcfce7; color: #15803d;'}">
            ${p.risk_score > 70 ? '🚩 High Risk: ' + p.anomaly_type : '✅ Normal'}
          </div>
          ${p.reasoning ? `<p style="font-size: 11px; font-style: italic; color: #4b5563; margin-top: 4px;">${p.reasoning}</p>` : ''}
        </div>
      `);
    });
  }, [map, projects]);

  return (
    <div 
      id="map-container" 
      style={{ height: '100%', width: '100%', borderRadius: '8px', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)' }} 
    />
  );
}
