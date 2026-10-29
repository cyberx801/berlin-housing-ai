// Domain enumerations shared by the form schema and the DRAFT prediction contract.
// All values are proposals pending the ML feature schema (PREDICTION_API.md §2).

export const PROPERTY_TYPES = ["apartment", "maisonette", "penthouse", "loft", "house", "other"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const BUILDING_ERAS = [
  "pre_1919",
  "1919_1949",
  "1950_1972",
  "1973_1990",
  "1991_2009",
  "2010_plus",
] as const;
export type BuildingEra = (typeof BUILDING_ERAS)[number];

/** German Energieausweis classes A+ to H. */
export const ENERGY_CLASSES = ["A_plus", "A", "B", "C", "D", "E", "F", "G", "H"] as const;
export type EnergyClass = (typeof ENERGY_CLASSES)[number];

export const CONDITIONS = ["first_occupancy", "renovated", "well_kept", "needs_renovation"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const FURNISHINGS = ["unfurnished", "partly_furnished", "furnished"] as const;
export type Furnishing = (typeof FURNISHINGS)[number];

export const UNKNOWN = "unknown" as const;
export type Unknown = typeof UNKNOWN;

/** Yes / No / Not sure — booleans never default to false (DECISIONS D-015). */
export const TRI_STATES = ["yes", "no", "unknown"] as const;
export type TriState = (typeof TRI_STATES)[number];

export const LIMITS = {
  areaM2: { min: 10, max: 500 },
  rooms: { min: 1, max: 10, step: 0.5 },
  floor: { min: -1, max: 60 },
  totalFloors: { min: 1, max: 60 },
  transitMinutes: { min: 0, max: 60 },
  address: { max: 120 },
} as const;
