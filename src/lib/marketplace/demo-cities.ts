export type DemoCity = {
  id: "hyderabad" | "bengaluru" | "mumbai" | "delhi";
  name: string;
  state: string;
  coordinates: { latitude: number; longitude: number };
  neighborhoods: Array<{ id: string; name: string }>;
};

export const demoCities: Record<string, DemoCity> = {
  hyderabad: {
    id: "hyderabad",
    name: "Hyderabad",
    state: "Telangana",
    coordinates: { latitude: 17.385, longitude: 78.4867 },
    neighborhoods: [
      { id: "hyderabad-banjara-hills", name: "Banjara Hills" },
      { id: "hyderabad-jubilee-hills", name: "Jubilee Hills" },
      { id: "hyderabad-gachibowli", name: "Gachibowli" },
    ],
  },
  bengaluru: {
    id: "bengaluru",
    name: "Bengaluru",
    state: "Karnataka",
    coordinates: { latitude: 12.9716, longitude: 77.5946 },
    neighborhoods: [
      { id: "bengaluru-indiranagar", name: "Indiranagar" },
      { id: "bengaluru-koramangala", name: "Koramangala" },
      { id: "bengaluru-whitefield", name: "Whitefield" },
    ],
  },
  mumbai: {
    id: "mumbai",
    name: "Mumbai",
    state: "Maharashtra",
    coordinates: { latitude: 19.076, longitude: 72.8777 },
    neighborhoods: [
      { id: "mumbai-bandra", name: "Bandra" },
      { id: "mumbai-andheri", name: "Andheri" },
      { id: "mumbai-colaba", name: "Colaba" },
    ],
  },
  delhi: {
    id: "delhi",
    name: "Delhi",
    state: "Delhi",
    coordinates: { latitude: 28.6139, longitude: 77.209 },
    neighborhoods: [
      { id: "delhi-connaught-place", name: "Connaught Place" },
      { id: "delhi-hauz-khas", name: "Hauz Khas" },
      { id: "delhi-gurgaon", name: "Gurgaon" },
    ],
  },
};

export const defaultDemoCity = demoCities.bengaluru;

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type LocationMatchResult = {
  isWithinSupportedRegion: boolean;
  matchedCity: DemoCity;
  distanceKm: number;
  actualCoordinates: { latitude: number; longitude: number };
};

export function matchGpsToDemoCity(
  coordinates: { latitude: number; longitude: number },
  maxRadiusKm = 45,
): LocationMatchResult {
  let nearestCity = defaultDemoCity;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const city of Object.values(demoCities)) {
    const dist = calculateDistanceKm(
      coordinates.latitude,
      coordinates.longitude,
      city.coordinates.latitude,
      city.coordinates.longitude,
    );
    if (dist < minDistance) {
      minDistance = dist;
      nearestCity = city;
    }
  }

  const isWithinSupportedRegion = minDistance <= maxRadiusKm;
  return {
    isWithinSupportedRegion,
    matchedCity: isWithinSupportedRegion ? nearestCity : defaultDemoCity,
    distanceKm: Math.round(minDistance),
    actualCoordinates: coordinates,
  };
}
