"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Info,
  Loader2,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Pencil,
  Percent,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useGeofenceOverview } from "@/hooks/use-geofence-overview";
import type { GeofenceZone } from "@/lib/types";

const DEFAULT_CENTER = { lat: 10.293, lng: 123.882 };
const MAP_HEIGHT = 560;
const ZONE_COLORS = ["#1e3a8a", "#f59e0b", "#0e7490", "#16a34a", "#7c3aed", "#dc2626"];

type ZoneDraft = {
  name: string;
  lat: string;
  lng: string;
  radius: string;
  color: string;
};

type MapPinTarget = {
  lat: number;
  lng: number;
  label: string;
  source: "campus" | "zone" | "current" | "draft";
};

type InspectorMode = "create" | "edit" | "view" | null;

declare global {
  interface Window {
    google?: any;
    __workhiveGoogleMapsLoader?: Promise<any>;
  }
}

function buildDraft(lat: number, lng: number, zone?: Partial<GeofenceZone>): ZoneDraft {
  return {
    name: zone?.name ?? "",
    lat: String(zone?.lat ?? lat),
    lng: String(zone?.lng ?? lng),
    radius: String(zone?.radius ?? 120),
    color: zone?.color ?? ZONE_COLORS[0],
  };
}

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatShortDate(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function roleLabel(role: string) {
  if (role === "hr") {
    return "HR";
  }

  if (role === "admin") {
    return "Admin";
  }

  return "Employee";
}

function computeCoverageArea(radius: number) {
  return Math.PI * radius * radius;
}

async function parseJson(response: Response) {
  const payload = (await response.json()) as { error?: string } & Record<string, unknown>;
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

async function loadGoogleMaps(key: string) {
  if (window.google?.maps) {
    return window.google;
  }

  if (!window.__workhiveGoogleMapsLoader) {
    window.__workhiveGoogleMapsLoader = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-workhive-google-maps="true"]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => resolve(window.google));
        existing.addEventListener("error", () => reject(new Error("Unable to load Google Maps.")));
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
      script.async = true;
      script.defer = true;
      script.dataset.workhiveGoogleMaps = "true";
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error("Unable to load Google Maps."));
      document.head.appendChild(script);
    });
  }

  return window.__workhiveGoogleMapsLoader;
}

export function GpsZonesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error } = useGeofenceOverview();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const campusMarkerRef = useRef<any>(null);
  const currentMarkerRef = useRef<any>(null);
  const draftMarkerRef = useRef<any>(null);
  const draftCircleRef = useRef<any>(null);
  const zoneCircleRefs = useRef<Map<string, any>>(new Map());
  const zoneMarkerRefs = useRef<Map<string, any>>(new Map());
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>(null);
  const [createDraft, setCreateDraft] = useState<ZoneDraft>(buildDraft(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng));
  const [editDraft, setEditDraft] = useState<ZoneDraft>(buildDraft(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng));
  const [campusPin, setCampusPin] = useState<MapPinTarget | null>(null);
  const [manualTarget, setManualTarget] = useState<MapPinTarget | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const zones = data?.geofenceZones ?? [];
  const accounts = data?.accounts ?? [];
  const summary = data?.summary;
  const center = data?.center ?? DEFAULT_CENTER;
  const campusName = data?.organizationName?.trim() ?? "Campus";
  const campusAddress = data?.campusAddress?.trim() ?? "";
  const campusLandmark = data?.campusLandmark?.trim() ?? "";
  const campusPlaceId = data?.campusPlaceId?.trim() ?? "";
  const campusLookup = campusLandmark || campusAddress || campusName;
  const activeSelectedId = selectedId && zones.some((zone) => zone.id === selectedId) ? selectedId : (zones[0]?.id ?? null);
  const selectedZone = zones.find((zone) => zone.id === activeSelectedId) ?? null;
  const activeEditDraft =
    selectedZone && activeSelectedId === selectedId
      ? editDraft
      : selectedZone
        ? buildDraft(selectedZone.lat, selectedZone.lng, selectedZone)
        : buildDraft(center.lat, center.lng);
  const createCoordinates = {
    lat: toNumber(createDraft.lat, manualTarget?.lat ?? campusPin?.lat ?? center.lat),
    lng: toNumber(createDraft.lng, manualTarget?.lng ?? campusPin?.lng ?? center.lng),
  };
  const zoneFocus = selectedZone
    ? { lat: selectedZone.lat, lng: selectedZone.lng, label: selectedZone.name, source: "zone" as const }
    : null;
  const createFocus = inspectorMode === "create"
    ? {
        lat: createCoordinates.lat,
        lng: createCoordinates.lng,
        label: createDraft.name.trim() || "New zone pin",
        source: "draft" as const,
      }
    : null;
  const mapFocus = createFocus ?? zoneFocus ?? manualTarget ?? campusPin ?? {
    lat: center.lat,
    lng: center.lng,
    label: campusLookup || campusName,
    source: "campus" as const,
  };

  useEffect(() => {
    let active = true;

    const loadCampusPin = async () => {
      if (!campusLookup) {
        return;
      }

      try {
        const geocodeUrl = new URL("/api/google-maps/geocode", window.location.origin);
        if (campusPlaceId) {
          geocodeUrl.searchParams.set("placeId", campusPlaceId);
        }
        geocodeUrl.searchParams.set("q", campusLookup);

        const geocodeResponse = await fetch(geocodeUrl.toString(), {
          cache: "no-store",
        });

        const geocodePayload = (await geocodeResponse.json()) as {
          result?: { lat: number; lng: number; formattedAddress: string; name: string; placeId?: string };
          error?: string;
        };

        if (!geocodeResponse.ok || !geocodePayload.result) {
          throw new Error(geocodePayload.error ?? "Unable to find the campus location on Google Maps.");
        }

        if (!browserKey) {
          throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing.");
        }

        if (!active) {
          return;
        }

        const nextPin: MapPinTarget = {
          lat: geocodePayload.result.lat,
          lng: geocodePayload.result.lng,
          label: geocodePayload.result.formattedAddress || geocodePayload.result.name || campusLookup,
          source: "campus",
        };
        setCampusPin(nextPin);
        setMapError(null);
        setManualTarget((current) => {
          if (current?.source === "current" || current?.source === "zone" || current?.source === "draft") {
            return current;
          }

          return selectedZone ? current : nextPin;
        });
      } catch (loadError) {
        if (!active) {
          return;
        }

        setMapError(loadError instanceof Error ? loadError.message : "Unable to load the campus map.");
      }
    };

    void loadCampusPin();

    return () => {
      active = false;
    };
  }, [campusLookup, campusPlaceId, browserKey]);

  useEffect(() => {
    if (!browserKey || !mapContainerRef.current || mapRef.current) {
      return;
    }

    let disposed = false;

    const initMap = async () => {
      try {
        const google = await loadGoogleMaps(browserKey);
        if (disposed || !mapContainerRef.current) {
          return;
        }

        mapRef.current = new google.maps.Map(mapContainerRef.current, {
          center: { lat: mapFocus.lat, lng: mapFocus.lng },
          zoom: 19,
          mapTypeId: "hybrid",
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_LEFT,
          },
          gestureHandling: "greedy",
        });
        setMapReady(true);
      } catch (loadError) {
        if (!disposed) {
          setMapError(loadError instanceof Error ? loadError.message : "Unable to render Google Maps.");
        }
      }
    };

    void initMap();

    return () => {
      disposed = true;
      setMapReady(false);
    };
  }, [browserKey, mapFocus.lat, mapFocus.lng]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) {
      return;
    }

    mapRef.current.panTo({ lat: mapFocus.lat, lng: mapFocus.lng });

    if (!campusMarkerRef.current) {
      campusMarkerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        icon: {
          path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          fillColor: "#1e3a8a",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 6,
        },
      });
    }

    campusMarkerRef.current.setPosition({ lat: campusPin?.lat ?? center.lat, lng: campusPin?.lng ?? center.lng });
    campusMarkerRef.current.setTitle(campusPin?.label ?? campusLookup);
    campusMarkerRef.current.setMap(mapRef.current);

    if (mapFocus.source === "current") {
      if (!currentMarkerRef.current) {
        currentMarkerRef.current = new window.google.maps.Marker({
          map: mapRef.current,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#16a34a",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
            scale: 8,
          },
        });
      }

      currentMarkerRef.current.setPosition({ lat: mapFocus.lat, lng: mapFocus.lng });
      currentMarkerRef.current.setTitle(mapFocus.label);
      currentMarkerRef.current.setMap(mapRef.current);
    } else if (currentMarkerRef.current) {
      currentMarkerRef.current.setMap(null);
    }
  }, [campusLookup, campusPin, center.lat, center.lng, mapFocus]);
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) {
      return;
    }

    zoneCircleRefs.current.forEach((circle) => circle.setMap(null));
    zoneMarkerRefs.current.forEach((marker) => marker.setMap(null));
    zoneCircleRefs.current.clear();
    zoneMarkerRefs.current.clear();

    zones.forEach((zone) => {
      const active = zone.id === activeSelectedId && inspectorMode !== "create";
      const circle = new window.google.maps.Circle({
        map: mapRef.current,
        center: { lat: zone.lat, lng: zone.lng },
        radius: zone.radius,
        fillColor: zone.color,
        fillOpacity: active ? 0.24 : 0.14,
        strokeColor: zone.color,
        strokeOpacity: 1,
        strokeWeight: active ? 4 : 3,
        clickable: true,
      });
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position: { lat: zone.lat, lng: zone.lng },
        title: zone.name,
        label: {
          text: zone.name,
          color: "#ffffff",
          fontWeight: active ? "800" : "700",
          fontSize: active ? "18px" : "16px",
          className: "workhive-zone-label",
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: zone.color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
          scale: 7,
        },
      });

      const select = () => {
        setInspectorMode("view");
        setSelectedId(zone.id);
        setEditDraft(buildDraft(zone.lat, zone.lng, zone));
        setManualTarget({ lat: zone.lat, lng: zone.lng, label: zone.name, source: "zone" });
      };

      circle.addListener("click", select);
      marker.addListener("click", select);

      zoneCircleRefs.current.set(zone.id, circle);
      zoneMarkerRefs.current.set(zone.id, marker);
    });

    return () => {
      zoneCircleRefs.current.forEach((circle) => circle.setMap(null));
      zoneMarkerRefs.current.forEach((marker) => marker.setMap(null));
      zoneCircleRefs.current.clear();
      zoneMarkerRefs.current.clear();
    };
  }, [zones, activeSelectedId, inspectorMode, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) {
      return;
    }

    if (inspectorMode !== "create") {
      if (draftMarkerRef.current) {
        draftMarkerRef.current.setMap(null);
      }
      if (draftCircleRef.current) {
        draftCircleRef.current.setMap(null);
      }
      return;
    }

    const position = { lat: createCoordinates.lat, lng: createCoordinates.lng };

    if (!draftMarkerRef.current) {
      draftMarkerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        draggable: true,
        animation: window.google.maps.Animation.DROP,
      });
      draftMarkerRef.current.addListener("dragend", (event: any) => {
        if (!event.latLng) {
          return;
        }

        setCreateDraft((current) => ({
          ...current,
          lat: event.latLng.lat().toFixed(6),
          lng: event.latLng.lng().toFixed(6),
        }));
      });
    }

    if (!draftCircleRef.current) {
      draftCircleRef.current = new window.google.maps.Circle({
        clickable: false,
        strokeOpacity: 1,
      });
    }

    draftMarkerRef.current.setMap(mapRef.current);
    draftMarkerRef.current.setPosition(position);
    draftMarkerRef.current.setTitle(createDraft.name.trim() || "New zone pin");

    draftCircleRef.current.setMap(mapRef.current);
    draftCircleRef.current.setCenter(position);
    draftCircleRef.current.setRadius(toNumber(createDraft.radius, 120));
    draftCircleRef.current.setOptions({
      fillColor: createDraft.color,
      fillOpacity: 0.18,
      strokeColor: createDraft.color,
      strokeWeight: 3,
    });

    const clickListener = mapRef.current.addListener("click", (event: any) => {
      if (!event.latLng) {
        return;
      }

      setCreateDraft((current) => ({
        ...current,
        lat: event.latLng.lat().toFixed(6),
        lng: event.latLng.lng().toFixed(6),
      }));
    });

    return () => {
      window.google?.maps.event.removeListener(clickListener);
    };
  }, [createCoordinates.lat, createCoordinates.lng, createDraft.color, createDraft.name, createDraft.radius, inspectorMode, mapReady]);

  const refreshOverview = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-geofence-overview"] });
  };

  const createMutation = useMutation({
    mutationFn: async (draft: ZoneDraft) => {
      const response = await fetch("/api/admin/geofence-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          lat: toNumber(draft.lat, center.lat),
          lng: toNumber(draft.lng, center.lng),
          radius: toNumber(draft.radius, 120),
          color: draft.color,
        }),
      });

      return parseJson(response) as Promise<{ zone?: GeofenceZone }>;
    },
    onSuccess: (payload) => {
      const nextZone = payload.zone;
      refreshOverview();
      if (nextZone) {
        setInspectorMode("edit");
        setSelectedId(nextZone.id);
        setEditDraft(buildDraft(nextZone.lat, nextZone.lng, nextZone));
        setManualTarget({ lat: nextZone.lat, lng: nextZone.lng, label: nextZone.name, source: "zone" });
      }
      toast({ title: "Zone created", description: "The new geofence zone is now saved in the database." });
    },
    onError: (mutationError) => {
      toast({
        title: "Unable to create zone",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: ZoneDraft }) => {
      const response = await fetch(`/api/admin/geofence-zones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          lat: toNumber(draft.lat, center.lat),
          lng: toNumber(draft.lng, center.lng),
          radius: toNumber(draft.radius, 120),
          color: draft.color,
        }),
      });

      return parseJson(response);
    },
    onSuccess: () => {
      refreshOverview();
      toast({ title: "Zone updated", description: "Zone Inspector changes were saved to the database." });
    },
    onError: (mutationError) => {
      toast({
        title: "Unable to update zone",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/geofence-zones/${id}`, { method: "DELETE" });
      return parseJson(response);
    },
    onSuccess: () => {
      refreshOverview();
      setInspectorMode(zones.length > 1 ? "edit" : null);
      toast({ title: "Zone deleted", description: "The selected geofence zone was removed from the database." });
      if (campusPin) {
        setManualTarget(campusPin);
      }
    },
    onError: (mutationError) => {
      toast({
        title: "Unable to delete zone",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const handleSelectZone = (zone: GeofenceZone) => {
    setInspectorMode("view");
    setSelectedId(zone.id);
    setEditDraft(buildDraft(zone.lat, zone.lng, zone));
    setManualTarget({ lat: zone.lat, lng: zone.lng, label: zone.name, source: "zone" });
  };

  const handleEditZone = (zone: GeofenceZone) => {
    setInspectorMode("edit");
    setSelectedId(zone.id);
    setEditDraft(buildDraft(zone.lat, zone.lng, zone));
    setManualTarget({ lat: zone.lat, lng: zone.lng, label: zone.name, source: "zone" });
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Location unavailable", description: "This browser does not support location access.", variant: "destructive" });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextTarget = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "My current location",
          source: "current" as const,
        };

        setLocating(false);
        if (inspectorMode === "create") {
          setCreateDraft((current) => ({
            ...current,
            lat: nextTarget.lat.toFixed(6),
            lng: nextTarget.lng.toFixed(6),
          }));
        }
        setManualTarget(nextTarget);
        toast({ title: "Location captured", description: "The map is now centered on your current location." });
      },
      (geoError) => {
        setLocating(false);
        toast({
          title: "Unable to get location",
          description: geoError.message || "Please allow location access and try again.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };
  const openCreateInspector = () => {
    const seed = manualTarget ?? zoneFocus ?? campusPin ?? {
      lat: center.lat,
      lng: center.lng,
      label: campusLookup || campusName,
      source: "campus" as const,
    };

    setInspectorMode("create");
    setCreateDraft(buildDraft(seed.lat, seed.lng, { color: ZONE_COLORS[0], radius: 120 }));
    setManualTarget({ lat: seed.lat, lng: seed.lng, label: "New zone pin", source: "draft" });
  };

  const handleCancelCreate = () => {
    setInspectorMode(selectedZone ? "view" : null);
    setCreateDraft(buildDraft(mapFocus.lat, mapFocus.lng));
    if (selectedZone) {
      setManualTarget({ lat: selectedZone.lat, lng: selectedZone.lng, label: selectedZone.name, source: "zone" });
    } else if (campusPin) {
      setManualTarget(campusPin);
    }
  };

  const handleSaveSelectedZone = async () => {
    if (!selectedZone) {
      return;
    }

    await updateMutation.mutateAsync({ id: selectedZone.id, draft: activeEditDraft });
    setInspectorMode("view");
    setManualTarget({
      lat: toNumber(activeEditDraft.lat, selectedZone.lat),
      lng: toNumber(activeEditDraft.lng, selectedZone.lng),
      label: activeEditDraft.name || selectedZone.name,
      source: "zone",
    });
  };

  const handleCreateZone = () => {
    createMutation.mutate(createDraft);
  };

  if (isLoading && !data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading GPS attendance zones...</div>;
  }

  if (error && !data) {
    return <div className="p-6 text-sm text-destructive">{error instanceof Error ? error.message : "Unable to load GPS attendance zones."}</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">GPS Attendance Zones</h1>
          <p className="text-sm text-muted-foreground">Real geofence coverage from the database with live location rows only.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            <MapPin className="mr-1.5 h-3.5 w-3.5" />
            {summary?.totalZones ?? 0} zones
          </Badge>
          <Button type="button" onClick={openCreateInspector}>
            <Plus className="mr-2 h-4 w-4" />
            Add Zone
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">Total Zones</p><p className="mt-2 text-3xl font-bold text-foreground">{summary?.totalZones ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">Active geofence areas in the database</p></div><div className="rounded-2xl bg-primary/10 p-3 text-primary"><MapPin className="h-5 w-5" /></div></div></CardContent></Card>
        <Card className="border-amber-200"><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">Within Geofence</p><p className="mt-2 text-3xl font-bold text-foreground">{summary?.withinGeofenceOnline ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">{summary?.withinGeofenceTotal ?? 0} tracked accounts are currently inside a zone</p></div><div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><CheckCircle2 className="h-5 w-5" /></div></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">Outside Geofence</p><p className="mt-2 text-3xl font-bold text-foreground">{summary?.outsideGeofence ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">Accounts outside every zone, whether online or offline</p></div><div className="rounded-2xl bg-muted p-3 text-muted-foreground"><AlertTriangle className="h-5 w-5" /></div></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">Coverage</p><p className="mt-2 text-3xl font-bold text-foreground">{summary?.coveragePct ?? 0}%</p><p className="mt-1 text-xs text-muted-foreground">{summary?.withinGeofenceTotal ?? 0}/{summary?.totalAccounts ?? 0} tracked accounts inside a zone</p></div><div className="rounded-2xl bg-primary/10 p-3 text-primary"><Percent className="h-5 w-5" /></div></div></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.75fr_0.95fr]">
        <Card className="overflow-hidden">
          <style jsx global>{`
            .workhive-map-shell .gm-style .gm-style-mtc {
              margin: 12px 0 0 12px;
            }

            .workhive-map-shell .gm-style .gm-style-mtc button {
              min-width: 74px;
              height: 40px;
              border: 1px solid rgba(148, 163, 184, 0.55) !important;
              border-radius: 12px !important;
              background: rgba(255, 255, 255, 0.94) !important;
              box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12) !important;
              color: rgb(15, 23, 42) !important;
              font-size: 14px !important;
              font-weight: 700 !important;
              padding: 0 16px !important;
            }

            .workhive-map-shell .gm-style .gm-style-mtc button + button {
              margin-left: 8px !important;
            }

            .workhive-map-shell .gm-style .gm-style-mtc button[aria-pressed="true"] {
              background: rgb(15, 23, 42) !important;
              color: white !important;
              border-color: rgb(15, 23, 42) !important;
            }

            .workhive-map-shell .gm-fullscreen-control {
              margin: 12px 12px 0 0 !important;
              border-radius: 12px !important;
              overflow: hidden;
              box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12) !important;
            }

            .workhive-map-shell .workhive-zone-label {
              text-shadow: 0 1px 2px rgba(15, 23, 42, 0.95), 0 0 10px rgba(15, 23, 42, 0.55);
              letter-spacing: 0.01em;
            }
          `}</style>
          <CardHeader className="border-b bg-gradient-to-r from-background to-muted/40">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl"><MapIcon className="h-5 w-5 text-primary" />Campus Map - {campusName}</CardTitle>
                <CardDescription>{campusAddress || "No campus address saved yet."}</CardDescription>
              </div>
              <Badge variant="outline">
                {mapFocus.source === "current"
                  ? "Current location"
                  : mapFocus.source === "zone"
                    ? "Zone focus"
                    : mapFocus.source === "draft"
                      ? "Draft pin"
                      : "Campus pin"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-b px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => campusPin && setManualTarget(campusPin)}
                  disabled={!campusPin}
                  className="h-11 rounded-xl border-border/70 bg-background/95 px-4 text-sm font-semibold shadow-sm"
                >
                  <LocateFixed className="mr-2 h-4 w-4" />
                  Pin Campus
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseMyLocation}
                  disabled={locating}
                  className="h-11 rounded-xl border-border/70 bg-background/95 px-4 text-sm font-semibold shadow-sm"
                >
                  {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crosshair className="mr-2 h-4 w-4" />}
                  Use My Location
                </Button>
                <div className="min-h-11 rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                  {mapError ? mapError : `Pinned to ${mapFocus.label}`}
                </div>
              </div>
            </div>
            <div className="relative workhive-map-shell">
              <div className="w-full" ref={mapContainerRef} style={{ height: `${MAP_HEIGHT}px` }} />
            </div>
            <div className="border-t bg-background/90 px-4 py-3 text-xs text-muted-foreground">
              {inspectorMode === "create"
                ? "Add Zone mode is active. Drag the pin or click the map to place the new zone before saving it in Zone Inspector."
                : "This map is rendered directly inside the website. Drag to move, scroll to zoom, and click a zone marker or circle to load it into Zone Inspector."}
            </div>

          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl"><Info className="h-5 w-5 text-primary" />Zone Inspector</CardTitle>
            <CardDescription>
              {inspectorMode === "create"
                ? "Create a new attendance zone by placing the pin and saving it."
                : inspectorMode === "edit"
                  ? "Edit mode is active. Update the zone fields below, then save your changes."
                  : "Review the saved zone details here. Use the Edit button in Zone Management to unlock the fields."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inspectorMode === "create" ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 rounded-2xl border bg-primary/5 p-4"><div><p className="text-lg font-semibold text-foreground">New Geofence Zone</p><p className="text-sm text-muted-foreground">Drag the map pin or click the map to place this zone before saving.</p></div><Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Draft</Badge></div>
                <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Coverage Area</p><p className="mt-2 text-2xl font-bold text-foreground">~{Math.round(computeCoverageArea(toNumber(createDraft.radius, 120))).toLocaleString()} m<sup>2</sup></p></div><div className="rounded-2xl border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Diameter</p><p className="mt-2 text-2xl font-bold text-foreground">{toNumber(createDraft.radius, 120) * 2} m</p></div></div>
                <div className="space-y-2"><Label htmlFor="new-zone-name">Zone Name</Label><Input id="new-zone-name" value={createDraft.name} onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Main Building" /></div>
                <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="new-zone-lat">Latitude</Label><Input id="new-zone-lat" value={createDraft.lat} onChange={(event) => setCreateDraft((current) => ({ ...current, lat: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="new-zone-lng">Longitude</Label><Input id="new-zone-lng" value={createDraft.lng} onChange={(event) => setCreateDraft((current) => ({ ...current, lng: event.target.value }))} /></div></div>
                <div className="space-y-3"><div className="flex items-center justify-between text-sm"><Label htmlFor="new-zone-radius">Radius</Label><span className="font-medium text-primary">{createDraft.radius} m</span></div><Slider value={[toNumber(createDraft.radius, 120)]} min={20} max={500} step={5} onValueChange={(value) => setCreateDraft((current) => ({ ...current, radius: String(value[0] ?? 120) }))} /><p className="text-xs text-muted-foreground">The preview circle on the map updates live as you adjust the radius.</p></div>
                <div className="space-y-3"><Label>Zone Color</Label><div className="flex flex-wrap gap-3">{ZONE_COLORS.map((color) => (<button key={color} type="button" aria-label={`Select ${color} zone color`} onClick={() => setCreateDraft((current) => ({ ...current, color }))} className={`h-9 w-9 rounded-full border-2 transition ${createDraft.color === color ? "scale-110 border-foreground" : "border-transparent"}`} style={{ backgroundColor: color }} />))}</div></div>
                <Separator />
                <div className="grid gap-3 sm:grid-cols-2"><Button type="button" variant="outline" onClick={handleCancelCreate} disabled={isSaving}>Cancel</Button><Button type="button" disabled={createMutation.isPending || !createDraft.name.trim()} onClick={handleCreateZone}>{createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Save Zone</Button></div>
              </div>
            ) : !selectedZone ? (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No geofence zone saved yet. Add a zone to start mapping attendance coverage.</div>
            ) : inspectorMode === "edit" ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 rounded-2xl border bg-primary/5 p-4"><div><p className="text-lg font-semibold text-foreground">Editing {selectedZone.name}</p><p className="text-sm text-muted-foreground">Adjust the saved zone, then save your changes.</p></div><Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Edit mode</Badge></div>
                <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Coverage Area</p><p className="mt-2 text-2xl font-bold text-foreground">~{Math.round(computeCoverageArea(toNumber(activeEditDraft.radius, selectedZone.radius))).toLocaleString()} m<sup>2</sup></p></div><div className="rounded-2xl border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Diameter</p><p className="mt-2 text-2xl font-bold text-foreground">{toNumber(activeEditDraft.radius, selectedZone.radius) * 2} m</p></div></div>
                <div className="space-y-2"><Label htmlFor="zone-name">Zone Name</Label><Input id="zone-name" value={activeEditDraft.name} onChange={(event) => setEditDraft({ ...activeEditDraft, name: event.target.value })} /></div>
                <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="zone-lat">Latitude</Label><Input id="zone-lat" value={activeEditDraft.lat} onChange={(event) => setEditDraft({ ...activeEditDraft, lat: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="zone-lng">Longitude</Label><Input id="zone-lng" value={activeEditDraft.lng} onChange={(event) => setEditDraft({ ...activeEditDraft, lng: event.target.value })} /></div></div>
                <div className="space-y-3"><div className="flex items-center justify-between text-sm"><Label htmlFor="zone-radius">Radius</Label><span className="font-medium text-primary">{activeEditDraft.radius} m</span></div><Slider value={[toNumber(activeEditDraft.radius, selectedZone.radius)]} min={20} max={500} step={5} onValueChange={(value) => setEditDraft({ ...activeEditDraft, radius: String(value[0] ?? selectedZone.radius) })} /><p className="text-xs text-muted-foreground">Move the slider, then press Save Changes to update this zone.</p></div>
                <div className="space-y-3"><Label>Zone Color</Label><div className="flex flex-wrap gap-3">{ZONE_COLORS.map((color) => (<button key={color} type="button" aria-label={`Select ${color} zone color`} onClick={() => setEditDraft({ ...activeEditDraft, color })} className={`h-9 w-9 rounded-full border-2 transition ${activeEditDraft.color === color ? "scale-110 border-foreground" : "border-transparent"}`} style={{ backgroundColor: color }} />))}</div></div>
                <Separator />
                <div className="grid gap-3 sm:grid-cols-3"><Button type="button" variant="outline" onClick={() => { setInspectorMode("view"); setEditDraft(buildDraft(selectedZone.lat, selectedZone.lng, selectedZone)); }} disabled={isSaving}>Cancel</Button><Button type="button" onClick={() => void handleSaveSelectedZone()} disabled={isSaving}>{updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}Save Changes</Button><Button type="button" variant="destructive" disabled={isSaving} onClick={() => deleteMutation.mutate(selectedZone.id)}>{deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete</Button></div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/30 p-4"><div><p className="text-lg font-semibold text-foreground">{selectedZone.name}</p><p className="text-sm text-muted-foreground">{selectedZone.radius} m radius</p></div><Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Saved in DB</Badge></div>
                <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Coverage Area</p><p className="mt-2 text-2xl font-bold text-foreground">~{Math.round(computeCoverageArea(selectedZone.radius)).toLocaleString()} m<sup>2</sup></p></div><div className="rounded-2xl border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Diameter</p><p className="mt-2 text-2xl font-bold text-foreground">{selectedZone.radius * 2} m</p></div></div>

                <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Zone Name</p><p className="mt-2 text-base font-semibold text-foreground">{selectedZone.name}</p></div><div className="rounded-2xl border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Radius</p><p className="mt-2 text-base font-semibold text-foreground">{selectedZone.radius} m</p></div><div className="rounded-2xl border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Latitude</p><p className="mt-2 font-mono text-sm text-foreground">{selectedZone.lat.toFixed(6)}</p></div><div className="rounded-2xl border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Longitude</p><p className="mt-2 font-mono text-sm text-foreground">{selectedZone.lng.toFixed(6)}</p></div></div>
                <div className="rounded-2xl border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Zone Color</p><div className="mt-3 flex items-center gap-3"><span className="inline-block h-5 w-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: selectedZone.color }} aria-hidden /><span className="text-sm text-muted-foreground">Saved marker color</span></div></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Zone Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zone Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead className="pr-6 text-right">Radius (m)</TableHead>
                  <TableHead className="pl-3">Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((zone) => {
                  const updatedAt = (zone as GeofenceZone & { updatedAt?: string }).updatedAt;

                  return (
                    <TableRow key={zone.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-full border border-white/60"
                            style={{ backgroundColor: zone.color }}
                            aria-hidden
                          />
                          <span>{zone.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{campusAddress || campusName}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {zone.lat.toFixed(6)}, {zone.lng.toFixed(6)}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">{zone.radius}</TableCell>
                      <TableCell className="pl-3">
                        <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatShortDate(updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditZone(zone)}
                          className="text-primary hover:text-primary"
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {zones.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No geofence zones defined yet. Click Add Zone to create one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Users className="h-5 w-5 text-primary" />Account Location Status</CardTitle><CardDescription>Within Geofence counts online accounts inside a zone. Outside Geofence counts all accounts outside a zone.</CardDescription></CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No live location rows found in the database yet. This page now shows only real tracked accounts.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Role</TableHead><TableHead>Detected At</TableHead><TableHead>Last Sync</TableHead><TableHead>Matched Zone</TableHead><TableHead className="pl-3">Status</TableHead></TableRow></TableHeader>
              <TableBody>{accounts.map((account) => (<TableRow key={account.userId}><TableCell><div><p className="font-medium text-foreground">{account.name}</p><p className="text-xs text-muted-foreground">{account.email}</p></div></TableCell><TableCell>{roleLabel(account.role)}</TableCell><TableCell>{formatDateTime(account.detectedAt)}</TableCell><TableCell>{formatDateTime(account.lastSyncAt)}</TableCell><TableCell>{account.matchedZoneName ?? "Outside all zones"}</TableCell><TableCell><div className="flex flex-wrap gap-2"><Badge variant="outline" className={account.withinGeofence ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-muted bg-muted text-muted-foreground"}>{account.withinGeofence ? "Within zone" : "Outside zone"}</Badge><Badge variant="outline" className={account.online ? "border-primary/30 bg-primary/10 text-primary" : "border-muted bg-muted text-muted-foreground"}>{account.online ? "Online" : "Offline"}</Badge></div></TableCell></TableRow>))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="rounded-3xl border bg-background p-4 text-sm text-muted-foreground"><div className="flex flex-wrap items-center gap-2 font-medium text-foreground"><Info className="h-4 w-4 text-primary" />Data rules on this page</div><p className="mt-2">The map now renders directly inside the website, fills the full map area, pins from the saved campus address first, falls back to the campus name, and can jump to your current location when you allow location access.</p></div>
    </div>
  );
}








