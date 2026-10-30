// ETRS89-LAEA Europe (EPSG:3035) to WGS84 longitude and latitude, the projection of the Zensus grid
// cells. Ellipsoidal Lambert azimuthal equal-area, inverse (Snyder, Map Projections, eq. 24-28 to 24-32).
// Written out here so the build does not depend on a projection library; the test checks it against proj4.

const A = 6378137; // GRS80
const E2 = 0.00669438002290078;
const E = Math.sqrt(E2);
const LAT0 = (52 * Math.PI) / 180;
const LON0 = (10 * Math.PI) / 180;
const FALSE_EASTING = 4321000;
const FALSE_NORTHING = 3210000;

const q = (phi) => {
  const s = Math.sin(phi);
  return (1 - E2) * (s / (1 - E2 * s * s) - Math.log((1 - E * s) / (1 + E * s)) / (2 * E));
};
const QP = q(Math.PI / 2);
const BETA0 = Math.asin(q(LAT0) / QP);
const RQ = A * Math.sqrt(QP / 2);
const D = (A * Math.cos(LAT0)) / Math.sqrt(1 - E2 * Math.sin(LAT0) ** 2) / (RQ * Math.cos(BETA0));

/**
 * @param {number} easting metres, EPSG:3035
 * @param {number} northing metres, EPSG:3035
 * @returns {{ lon: number, lat: number }} degrees
 */
export function laeaToLonLat(easting, northing) {
  const x = easting - FALSE_EASTING;
  const y = northing - FALSE_NORTHING;
  const rho = Math.hypot(x / D, D * y);
  if (rho === 0) return { lon: (LON0 * 180) / Math.PI, lat: (LAT0 * 180) / Math.PI };
  const ce = 2 * Math.asin(rho / (2 * RQ));
  const betaP = Math.asin(Math.cos(ce) * Math.sin(BETA0) + ((D * y * Math.sin(ce) * Math.cos(BETA0)) / rho));
  const lon = LON0 + Math.atan2(x * Math.sin(ce), D * rho * Math.cos(BETA0) * Math.cos(ce) - D * D * y * Math.sin(BETA0) * Math.sin(ce));
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  const lat =
    betaP +
    (E2 / 3 + (31 * e4) / 180 + (517 * e6) / 5040) * Math.sin(2 * betaP) +
    ((23 * e4) / 360 + (251 * e6) / 3780) * Math.sin(4 * betaP) +
    ((761 * e6) / 45360) * Math.sin(6 * betaP);
  return { lon: (lon * 180) / Math.PI, lat: (lat * 180) / Math.PI };
}
