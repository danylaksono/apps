export function calculateBearing(lat1, lon1, lat2, lon2) {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const earthRadiusMeters = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function withHemisphere(value, positive, negative) {
  const direction = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(4)}\u00B0${direction}`;
}

export function formatCoordinates(lat, lon) {
  return `${withHemisphere(lat, 'N', 'S')} / ${withHemisphere(lon, 'E', 'W')}`;
}
