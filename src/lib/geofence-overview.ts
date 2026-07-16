import { db } from "@/lib/db";
import { getAdminUsers, getGeofenceZones, getSystemSettings } from "@/lib/admin-data";
import type { GeofenceOverviewResponse } from "@/lib/admin-types";

const DEFAULT_CENTER = {
  lat: 10.293,
  lng: 123.882,
};

const LOCATION_TABLE = "UserLocationStatus";
const LOCATION_TABLE_CACHE_TTL_MS = 30_000;

let locationTableCache = null;

function formatTimestamp(value) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

function isOnline(lastLogin) {
  if (!lastLogin) {
    return false;
  }

  const loginDate = new Date(lastLogin.replace(" ", "T"));
  if (Number.isNaN(loginDate.getTime())) {
    return false;
  }

  return Date.now() - loginDate.getTime() <= 30 * 60 * 1000;
}

async function hasLocationTable() {
  if (locationTableCache && Date.now() - locationTableCache.checkedAt < LOCATION_TABLE_CACHE_TTL_MS) {
    return locationTableCache.available;
  }

  try {
    const rows = await db.$queryRawUnsafe(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS present`,
      LOCATION_TABLE,
    );

    const available = Boolean(rows[0]?.present);
    locationTableCache = { checkedAt: Date.now(), available };
    return available;
  } catch {
    locationTableCache = { checkedAt: Date.now(), available: false };
    return false;
  }
}

function distanceMeters(latA, lngA, latB, lngB) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const deltaLat = toRadians(latB - latA);
  const deltaLng = toRadians(lngB - lngA);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findMatchedZone(lat, lng, zones) {
  let bestMatch = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const zone of zones) {
    const distance = distanceMeters(lat, lng, zone.lat, zone.lng);
    if (distance <= zone.radius && distance < bestDistance) {
      bestMatch = zone;
      bestDistance = distance;
    }
  }

  return bestMatch;
}

async function getLocationRows() {
  if (!(await hasLocationTable())) {
    return [];
  }

  return await db.$queryRawUnsafe(
    `SELECT "userId", "lat", "lng", "detectedAt", "lastSyncAt"
     FROM "UserLocationStatus"
     ORDER BY "detectedAt" DESC`,
  );
}

function computeCenter(zones) {
  if (zones.length === 0) {
    return DEFAULT_CENTER;
  }

  const total = zones.reduce(
    (accumulator, zone) => ({ lat: accumulator.lat + zone.lat, lng: accumulator.lng + zone.lng }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: total.lat / zones.length,
    lng: total.lng / zones.length,
  };
}

export async function getGeofenceOverview(): Promise<GeofenceOverviewResponse> {
  const [settings, zones, users, locationRows] = await Promise.all([
    getSystemSettings(),
    getGeofenceZones(),
    getAdminUsers(),
    getLocationRows(),
  ]);

  const rowsByUserId = new Map(locationRows.map((row) => [row.userId, row]));

  const accounts = users
    .filter((user) => rowsByUserId.has(user.id))
    .map((user) => {
      const row = rowsByUserId.get(user.id);
      const matchedZone = findMatchedZone(row.lat, row.lng, zones);

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        online: isOnline(user.lastLogin),
        lastLogin: user.lastLogin,
        lat: row.lat,
        lng: row.lng,
        detectedAt: formatTimestamp(row.detectedAt),
        lastSyncAt: formatTimestamp(row.lastSyncAt),
        withinGeofence: Boolean(matchedZone),
        matchedZoneId: matchedZone?.id,
        matchedZoneName: matchedZone?.name,
      };
    });

  const withinGeofenceTotal = accounts.filter((account) => account.withinGeofence).length;
  const withinGeofenceOnline = accounts.filter((account) => account.withinGeofence && account.online).length;
  const outsideGeofence = accounts.filter((account) => !account.withinGeofence).length;
  const coveragePct = accounts.length > 0 ? Math.round((withinGeofenceTotal / accounts.length) * 100) : 0;

  return {
    organizationName: settings.organizationName,
    campusAddress: settings.campusAddress,
    campusLandmark: settings.campusLandmark,
    campusPlaceId: settings.campusPlaceId,
    center: computeCenter(zones),
    geofenceZones: zones,
    summary: {
      totalZones: zones.length,
      totalAccounts: accounts.length,
      withinGeofenceOnline,
      withinGeofenceTotal,
      outsideGeofence,
      coveragePct,
    },
    accounts,
  };
}