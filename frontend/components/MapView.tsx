"use client";
import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const getRiskColor = (riskScore) => {
  const score = Number(riskScore || 0);
  if (score >= 85) return '#991b1b';
  if (score >= 70) return '#dc2626';
  if (score >= 50) return '#d97706';
  return '#16805b';
};

const getRiskLabel = (riskScore) => {
  const score = Number(riskScore || 0);
  if (score >= 85) return 'Critical';
  if (score >= 70) return 'High risk';
  if (score >= 50) return 'Moderate';
  return 'Normal';
};

const getMarkerIcon = (riskScore) => {
  const color = getRiskColor(riskScore);
  return L.divIcon({
    className: 'risk-marker-wrapper',
    html: `<span class="risk-marker" style="background:${color}; box-shadow: 0 0 0 3px rgba(255,255,255,0.9), 0 2px 6px rgba(15,23,42,0.35)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
};

export default function MapView({ projects, stateFilter = 'all', districtFilter = 'all' }) {
  const [map, setMap] = useState(null);

  const locationCenterMap = {
    all: { center: [22.5937, 78.9629], zoom: 5 },
    Delhi: { center: [28.6139, 77.2090], zoom: 10 },
    Maharashtra: { center: [19.7515, 75.7139], zoom: 7 },
    Karnataka: { center: [15.3173, 75.7139], zoom: 7 },
    'Tamil Nadu': { center: [11.1271, 78.6569], zoom: 7 },
    'Uttar Pradesh': { center: [26.8467, 80.9462], zoom: 7 },
    'West Bengal': { center: [22.9868, 87.8550], zoom: 7 },
    Gujarat: { center: [22.2587, 71.1924], zoom: 7 },
    Bihar: { center: [25.0961, 85.3131], zoom: 7 },
    'New Delhi': { center: [28.6139, 77.2090], zoom: 11 },
    'North Delhi': { center: [28.7128, 77.1994], zoom: 11 },
    'South Delhi': { center: [28.5449, 77.1815], zoom: 11 },
    'East Delhi': { center: [28.6667, 77.2763], zoom: 11 },
    'West Delhi': { center: [28.6504, 77.1141], zoom: 11 },
    Mumbai: { center: [19.0760, 72.8777], zoom: 11 },
    Pune: { center: [18.5204, 73.8567], zoom: 11 },
    Nagpur: { center: [21.1458, 79.0882], zoom: 11 },
    Nashik: { center: [20.0110, 73.7905], zoom: 11 },
    Bengaluru: { center: [12.9716, 77.5946], zoom: 11 },
    Mysuru: { center: [12.2958, 76.6394], zoom: 11 },
    Hubballi: { center: [15.3647, 75.1240], zoom: 11 },
    Mangaluru: { center: [12.9141, 74.8560], zoom: 11 },
    Chennai: { center: [13.0827, 80.2707], zoom: 11 },
    Coimbatore: { center: [11.0168, 76.9558], zoom: 11 },
    Madurai: { center: [9.9252, 78.1198], zoom: 11 },
    Salem: { center: [11.6643, 78.1460], zoom: 11 },
    Lucknow: { center: [26.8467, 80.9462], zoom: 11 },
    Kanpur: { center: [26.4499, 80.3319], zoom: 11 },
    Varanasi: { center: [25.3176, 82.9739], zoom: 11 },
    Agra: { center: [27.1767, 78.0081], zoom: 11 },
    Kolkata: { center: [22.5726, 88.3639], zoom: 11 },
    Durgapur: { center: [23.5204, 87.3119], zoom: 11 },
    Asansol: { center: [23.6739, 86.9524], zoom: 11 },
    Howrah: { center: [22.5958, 88.2636], zoom: 11 },
    Ahmedabad: { center: [23.0225, 72.5714], zoom: 11 },
    Surat: { center: [21.1702, 72.8311], zoom: 11 },
    Vadodara: { center: [22.3072, 73.1812], zoom: 11 },
    Rajkot: { center: [22.3039, 70.8022], zoom: 11 },
    Patna: { center: [25.5941, 85.1376], zoom: 11 },
    Gaya: { center: [24.7955, 85.0002], zoom: 11 },
    Muzaffarpur: { center: [26.1226, 85.3906], zoom: 11 },
    Bhagalpur: { center: [25.2593, 86.9846], zoom: 11 },
  };

  useEffect(() => {
    // Initialize map ONLY once
    if (map) return;

    try {
      const mapInstance = L.map('map-container', {
        center: [22.5937, 78.9629],
        zoom: 5,
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

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    const validProjects = (projects || []).filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));

    validProjects.forEach((p) => {
      const marker = L.marker([p.latitude, p.longitude], { icon: getMarkerIcon(p.risk_score) }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: sans-serif; padding: 5px;">
          <strong style="font-size: 14px;">${p.project_name}</strong><br/>
          <span style="font-size: 12px;">ID: ${p.project_id} | MP: ${p.mp_id}</span><br/>
          <div style="margin-top: 5px; padding: 2px 5px; font-size: 11px; font-weight: bold; border-radius: 4px; 
            ${p.risk_score > 70 ? 'background: #fee2e2; color: #b91c1c;' : 'background: #dcfce7; color: #15803d;'}">
            ${getRiskLabel(p.risk_score)}${p.anomaly_type ? ': ' + p.anomaly_type : ''}
          </div>
          ${p.reasoning ? `<p style="font-size: 11px; font-style: italic; color: #4b5563; margin-top: 4px;">${p.reasoning}</p>` : ''}
        </div>
      `);
    });

    const selectedLocation = districtFilter !== 'all' ? locationCenterMap[districtFilter]
      : stateFilter !== 'all' ? locationCenterMap[stateFilter]
      : locationCenterMap.all;

    if (validProjects.length > 0) {
      const bounds = L.latLngBounds(validProjects.map((p) => [p.latitude, p.longitude]));
      if (bounds.isValid()) {
        const shouldUseFocusedLocation = districtFilter !== 'all' || stateFilter !== 'all';
        if (shouldUseFocusedLocation && selectedLocation) {
          map.setView(selectedLocation.center, selectedLocation.zoom);
        } else {
          map.fitBounds(bounds.pad(0.2));
        }
      }
    } else {
      const fallbackLocation = selectedLocation || locationCenterMap.all;
      map.setView(fallbackLocation.center, fallbackLocation.zoom);
    }
  }, [map, projects, stateFilter, districtFilter]);

  return (
    <div 
      id="map-container" 
      style={{ height: '100%', width: '100%', borderRadius: '8px', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)' }} 
    />
  );
}
