"use client";

import { useEffect, useRef } from "react";
import type { GeofenceZone } from "@/lib/types";

type Point = { lat: number; lng: number; label: string; source: string };
type Draft = { name: string; lat: string; lng: string; radius: string; color: string };

declare global {
  interface Window {
    maplibregl?: any;
    __workhiveMapLibreLoader?: Promise<any>;
  }
}

function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (!window.__workhiveMapLibreLoader) {
    window.__workhiveMapLibreLoader = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-workhive-maplibre="true"]')) {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css";
        css.dataset.workhiveMaplibre = "true";
        document.head.appendChild(css);
      }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js";
      script.async = true;
      script.onload = () => window.maplibregl ? resolve(window.maplibregl) : reject(new Error("MapLibre did not initialize."));
      script.onerror = () => reject(new Error("Unable to load the satellite map renderer."));
      document.head.appendChild(script);
    }).catch((error) => {
      window.__workhiveMapLibreLoader = undefined;
      throw error;
    });
  }
  return window.__workhiveMapLibreLoader;
}

function circleGeoJson(lat: number, lng: number, radius: number) {
  const earthRadius = 6371000;
  const angular = radius / earthRadius;
  const latitude = lat * Math.PI / 180;
  const longitude = lng * Math.PI / 180;
  const coordinates: number[][] = [];
  for (let index = 0; index <= 64; index++) {
    const bearing = index * 2 * Math.PI / 64;
    const nextLat = Math.asin(Math.sin(latitude) * Math.cos(angular) + Math.cos(latitude) * Math.sin(angular) * Math.cos(bearing));
    const nextLng = longitude + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(latitude), Math.cos(angular) - Math.sin(latitude) * Math.sin(nextLat));
    coordinates.push([nextLng * 180 / Math.PI, nextLat * 180 / Math.PI]);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [coordinates] }, properties: {} };
}

function markerElement(color: string, label: string, selected = false) {
  const element = document.createElement("button");
  element.type = "button";
  element.title = label;
  element.style.cssText = `display:flex;align-items:center;gap:6px;border:2px solid white;border-radius:99px;padding:5px 9px;background:${color};color:white;font:700 ${selected ? 15 : 13}px sans-serif;box-shadow:0 2px 8px #0008;cursor:pointer;white-space:nowrap`;
  element.textContent = label;
  return element;
}

export function SatelliteZoneMap({ provider, apiKey, focus, campusPin, center, zones, selectedId, inspectorMode, draft, onSelectZone, onDraftPosition, onError }: {
  provider: "esri" | "maptiler";
  apiKey: string;
  focus: Point;
  campusPin: Point | null;
  center: { lat: number; lng: number };
  zones: GeofenceZone[];
  selectedId: string | null;
  inspectorMode: string | null;
  draft: Draft;
  onSelectZone: (zone: GeofenceZone) => void;
  onDraftPosition: (lat: number, lng: number) => void;
  onError: (message: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const readyRef = useRef(false);
  const clickRef = useRef<(event: any) => void>(() => {});
  const selectRef = useRef<(id: string) => void>(() => {});
  const drawRef = useRef<() => void>(() => {});

  useEffect(() => {
    clickRef.current = (event) => {
      if (inspectorMode === "create") onDraftPosition(event.lngLat.lat, event.lngLat.lng);
    };
    selectRef.current = (id) => {
      if (inspectorMode === "create") return;
      const zone = zones.find((item) => item.id === id);
      if (zone) onSelectZone(zone);
    };
  }, [inspectorMode, onDraftPosition, onSelectZone, zones]);

  useEffect(() => {
    let disposed = false;
    let map: any;
    loadMapLibre().then((maplibre) => {
      if (disposed || !container.current) return;
      map = new maplibre.Map({
        container: container.current,
        style: provider === "esri"
          ? `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/imagery?token=${encodeURIComponent(apiKey)}`
          : `https://api.maptiler.com/maps/hybrid-v4/style.json?key=${encodeURIComponent(apiKey)}`,
        center: [focus.lng, focus.lat],
        zoom: 19,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new maplibre.NavigationControl(), "top-right");
      map.addControl(new maplibre.AttributionControl({
        compact: true,
        customAttribution: provider === "esri" ? "© Esri, Vantor, Earthstar Geographics, GIS User Community" : undefined,
      }), "bottom-right");
      map.on("load", () => { readyRef.current = true; drawRef.current(); });
      map.on("error", (event: any) => {
        const message = event.error?.message || `${provider === "esri" ? "Esri" : "MapTiler"} map request failed.`;
        onError(message);
      });
      map.on("click", (event: any) => clickRef.current(event));
      map.on("click", "workhive-zones-fill", (event: any) => {
        const id = event.features?.[0]?.properties?.id;
        if (id) selectRef.current(id);
      });
    }).catch((error) => { if (!disposed) onError(error instanceof Error ? error.message : "Unable to load satellite imagery."); });
    return () => {
      disposed = true;
      readyRef.current = false;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map?.remove();
      mapRef.current = null;
    };
    // Map is created once per API key; focus and overlays update below.
  }, [apiKey, provider]);

  useEffect(() => {
    mapRef.current?.panTo([focus.lng, focus.lat]);
  }, [focus.lat, focus.lng]);

  useEffect(() => {
    drawRef.current = () => {
    const map = mapRef.current;
    const maplibre = window.maplibregl;
    if (!readyRef.current || !map || !maplibre) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    for (const layer of ["workhive-zones-fill", "workhive-zones-line", "workhive-draft-fill", "workhive-draft-line"]) {
      if (map.getLayer(layer)) map.removeLayer(layer);
    }
    for (const source of ["workhive-zones", "workhive-draft"]) {
      if (map.getSource(source)) map.removeSource(source);
    }

    const campus = campusPin ?? { ...center, label: "Campus" };
    markersRef.current.push(new maplibre.Marker({ element: markerElement("#1e3a8a", campus.label) }).setLngLat([campus.lng, campus.lat]).addTo(map));
    if (focus.source === "current") {
      markersRef.current.push(new maplibre.Marker({ element: markerElement("#16a34a", "Current location") }).setLngLat([focus.lng, focus.lat]).addTo(map));
    }
    if (zones.length) {
      map.addSource("workhive-zones", { type: "geojson", data: {
        type: "FeatureCollection",
        features: zones.map((zone) => ({ ...circleGeoJson(zone.lat, zone.lng, zone.radius), properties: { id: zone.id, color: zone.color, active: zone.id === selectedId && inspectorMode !== "create" } })),
      } });
      map.addLayer({ id: "workhive-zones-fill", type: "fill", source: "workhive-zones", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.2 } });
      map.addLayer({ id: "workhive-zones-line", type: "line", source: "workhive-zones", paint: { "line-color": ["get", "color"], "line-width": ["case", ["get", "active"], 4, 3] } });
      for (const zone of zones) {
        const element = markerElement(zone.color, zone.name, zone.id === selectedId);
        element.addEventListener("click", (event) => { event.stopPropagation(); onSelectZone(zone); });
        markersRef.current.push(new maplibre.Marker({ element }).setLngLat([zone.lng, zone.lat]).addTo(map));
      }
    }
    if (inspectorMode === "create") {
      const lat = Number(draft.lat);
      const lng = Number(draft.lng);
      const radius = Number(draft.radius);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radius) && radius > 0) {
        map.addSource("workhive-draft", { type: "geojson", data: circleGeoJson(lat, lng, radius) });
        map.addLayer({ id: "workhive-draft-fill", type: "fill", source: "workhive-draft", paint: { "fill-color": draft.color, "fill-opacity": 0.18 } });
        map.addLayer({ id: "workhive-draft-line", type: "line", source: "workhive-draft", paint: { "line-color": draft.color, "line-width": 3 } });
        const marker = new maplibre.Marker({ draggable: true }).setLngLat([lng, lat]).addTo(map);
        marker.on("dragend", () => { const point = marker.getLngLat(); onDraftPosition(point.lat, point.lng); });
        markersRef.current.push(marker);
      }
    }
    };
    drawRef.current();
  }, [campusPin, center.lat, center.lng, zones, selectedId, inspectorMode, draft, focus.source, onDraftPosition, onSelectZone]);

  return <div ref={container} className="w-full" style={{ height: 560 }} />;
}
