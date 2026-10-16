import { fetchSpecificLocation } from './device';

export interface GpsLocationInfo {
  latitude: number;
  longitude: number;
  accuracy: number;
  address: string;
  timestamp: number;
  isNetworkFallback?: boolean;
}

type GpsCallback = (location: GpsLocationInfo | null, error?: string) => void;

let watchId: number | null = null;
let currentGpsLocation: GpsLocationInfo | null = null;
const listeners: Set<GpsCallback> = new Set();
let isPolicyBlocked = false;

export function registerGpsListener(cb: GpsCallback): () => void {
  listeners.add(cb);
  if (currentGpsLocation) {
    cb(currentGpsLocation);
  }
  return () => listeners.delete(cb);
}

function notifyGpsListeners(loc: GpsLocationInfo | null, err?: string) {
  listeners.forEach(cb => {
    try { cb(loc, err); } catch {}
  });
}

export function isPermissionsPolicyBlocked(): boolean {
  if (isPolicyBlocked) return true;
  if (typeof document === 'undefined') return false;
  try {
    if ((document as any).featurePolicy && !(document as any).featurePolicy.allowsFeature('geolocation')) {
      isPolicyBlocked = true;
      return true;
    }
    if ((document as any).permissionsPolicy && !(document as any).permissionsPolicy.allowsFeature('geolocation')) {
      isPolicyBlocked = true;
      return true;
    }
  } catch {}
  return false;
}

/**
 * Reverse geocode latitude and longitude into precise human-readable local address
 */
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
      headers: {
        'Accept-Language': 'vi,en'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const country = (addr.country || '').toLowerCase();
        const isVietnam = country.includes('việt nam') || country.includes('viet nam') || country.includes('vietnam');

        const road = addr.road || addr.pedestrian || addr.footway || '';
        const houseNumber = addr.house_number ? `${addr.house_number} ` : '';
        const street = road ? `${houseNumber}${road}` : '';
        const ward = addr.suburb || addr.quarter || addr.neighbourhood || addr.village || addr.hamlet || addr.residential || '';
        const district = addr.county || addr.city_district || addr.district || '';
        const cityOrProvince = addr.city || addr.town || addr.state || addr.province || '';

        if (isVietnam) {
          const segments = [];
          if (street) segments.push(street);
          if (ward) segments.push(ward);
          if (district) segments.push(district);
          if (cityOrProvince) segments.push(cityOrProvince);

          if (segments.length > 0) {
            return segments.join(', ');
          }
        } else {
          const segments = [];
          if (street) segments.push(street);
          if (ward) segments.push(ward);
          if (cityOrProvince) segments.push(cityOrProvince);
          if (addr.country) segments.push(addr.country);

          if (segments.length > 0) {
            return segments.join(', ');
          }
        }

        if (data.display_name) {
          const parts = data.display_name.split(',');
          return parts.slice(0, 3).join(',').trim();
        }
      }
    }
  } catch {
    // Silent fallback
  }
  return `GPS: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

export async function startRealtimeGpsTracking(): Promise<void> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    await fallbackToNetworkLocation();
    return;
  }

  // If inside an iframe where permissions policy blocks geolocation, fallback silently
  if (isPermissionsPolicyBlocked()) {
    await fallbackToNetworkLocation();
    return;
  }

  if (watchId !== null) {
    return;
  }

  try {
    watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const address = await reverseGeocode(latitude, longitude);

        currentGpsLocation = {
          latitude,
          longitude,
          accuracy,
          address,
          timestamp: Date.now(),
          isNetworkFallback: false
        };

        try {
          localStorage.setItem('cloudsend_live_gps', JSON.stringify(currentGpsLocation));
          localStorage.setItem('cloudsend_cached_location', address);
        } catch {}

        notifyGpsListeners(currentGpsLocation);
      },
      async (error) => {
        // Stop watching immediately on permission error to prevent spamming
        stopRealtimeGpsTracking();

        if (error.code === 1 || error.message.toLowerCase().includes('permissions policy') || error.message.toLowerCase().includes('denied')) {
          isPolicyBlocked = true;
        }

        await fallbackToNetworkLocation();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 12000
      }
    );
  } catch {
    await fallbackToNetworkLocation();
  }
}

async function fallbackToNetworkLocation(): Promise<GpsLocationInfo> {
  const address = await fetchSpecificLocation();
  currentGpsLocation = {
    latitude: 0,
    longitude: 0,
    accuracy: 0,
    address: address || 'Khu vực mạng an toàn',
    timestamp: Date.now(),
    isNetworkFallback: true
  };
  notifyGpsListeners(currentGpsLocation);
  return currentGpsLocation;
}

export function stopRealtimeGpsTracking(): void {
  if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      navigator.geolocation.clearWatch(watchId);
    } catch {}
    watchId = null;
  }
}

export async function refreshGpsOrNetworkLocation(): Promise<GpsLocationInfo> {
  try {
    localStorage.removeItem('cloudsend_cached_location');
  } catch {}

  if (!isPermissionsPolicyBlocked() && typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0
        });
      });

      const { latitude, longitude, accuracy } = pos.coords;
      const address = await reverseGeocode(latitude, longitude);

      currentGpsLocation = {
        latitude,
        longitude,
        accuracy,
        address,
        timestamp: Date.now(),
        isNetworkFallback: false
      };

      try {
        localStorage.setItem('cloudsend_live_gps', JSON.stringify(currentGpsLocation));
        localStorage.setItem('cloudsend_cached_location', address);
      } catch {}

      notifyGpsListeners(currentGpsLocation);
      return currentGpsLocation;
    } catch {
      isPolicyBlocked = true;
    }
  }

  return await fallbackToNetworkLocation();
}

export function getCurrentGpsLocation(): GpsLocationInfo | null {
  if (currentGpsLocation) return currentGpsLocation;
  try {
    const raw = localStorage.getItem('cloudsend_live_gps');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.address) {
        currentGpsLocation = parsed;
        return currentGpsLocation;
      }
    }
  } catch {}
  return null;
}

