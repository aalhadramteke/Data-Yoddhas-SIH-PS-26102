"use client";
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Force Leaflet marker assets from CDN
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const getRiskColor = (riskScore: any) => {
  const score = Number(riskScore || 0);
  if (score >= 70) return '#dc2626'; // Red
  if (score >= 50) return '#d97706'; // Orange
  return '#16805b'; // Green
};

const getRiskLabel = (riskScore: any) => {
  const score = Number(riskScore || 0);
  if (score >= 70) return 'High risk';
  if (score >= 50) return 'Moderate risk';
  return 'Normal';
};

export default function MapView({
  projects,
  stateFilter = 'all',
  districtFilter = 'all',
  onProjectSelect,
}: {
  projects: any;
  stateFilter?: string;
  districtFilter?: string;
  onProjectSelect?: (p: any) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    try {
      const mapInstance = L.map(mapContainerRef.current, {
        center: [22.5937, 78.9629],
        zoom: 5,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(mapInstance);

      const markerGroup = L.layerGroup().addTo(mapInstance);
      markerGroupRef.current = markerGroup;
      mapInstanceRef.current = mapInstance;

      const resizeInterval = setInterval(() => {
        mapInstance.invalidateSize();
      }, 500);

      setTimeout(() => clearInterval(resizeInterval), 5000);

    } catch (e) {
      console.error("Leaflet Init Error:", e);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerGroup = markerGroupRef.current;
    if (!map || !markerGroup) return;

    markerGroup.clearLayers();

    const validProjects = (projects || []).filter((p: any) => {
      return p && p.latitude != null && p.longitude != null &&
             !isNaN(p.latitude) && !isNaN(p.longitude) &&
             (p.latitude !== 0 || p.longitude !== 0);
    });

    validProjects.forEach((p: any) => {
      const riskScore = Number(p.risk_score || p.financial_risk_score || 0);
      const color = getRiskColor(riskScore);

      // Use CircleMarkers instead of Default Markers to ensure the RED/ORANGE/GREEN color scheme is visible
      const marker = L.circleMarker([p.latitude, p.longitude], {
        radius: 8,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      });

      marker.on('click', () => onProjectSelect?.(p));
      marker.bindPopup(`
        <div style="font-family: sans-serif; min-width: 150px; padding: 5px;">
          <strong style="font-size: 14px;">${p.project_name}</strong><br/>
          <span style="font-size: 12px; color: #666;">ID: ${p.project_id}</span><br/>
          <div style="margin-top: 8px; padding: 4px 8px; font-size: 11px; font-weight: bold; border-radius: 4px; background: ${color}; color: white; text-align: center;">
            ${getRiskLabel(riskScore)} (${riskScore}%)
          </div>
        </div>
      `);

      markerGroup.addLayer(marker);
    });

    if (validProjects.length > 0) {
      const bounds = L.latLngBounds(validProjects.map((p: any) => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [30, 30] });
    } else {
      map.setView([22.5937, 78.9629], 5);
    }

    setTimeout(() => map.invalidateSize(), 300);
  }, [projects, stateFilter, districtFilter]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: '#f1f5f9',
        zIndex: 1,
        minHeight: '400px'
      }}
    />
  );
}
