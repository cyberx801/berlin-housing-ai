import type {
  BuildingEra,
  Condition,
  EnergyClass,
  Furnishing,
  PropertyType,
  TriState,
  Unknown,
} from "./enums";

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Apartment",
  maisonette: "Maisonette",
  penthouse: "Penthouse",
  loft: "Loft",
  house: "House",
  other: "Other",
};

export const BUILDING_ERA_LABELS: Record<BuildingEra | Unknown, string> = {
  pre_1919: "Before 1919 (Altbau)",
  "1919_1949": "1919–1949",
  "1950_1972": "1950–1972",
  "1973_1990": "1973–1990",
  "1991_2009": "1991–2009",
  "2010_plus": "2010 or later",
  unknown: "Not sure",
};

export const ENERGY_CLASS_LABELS: Record<EnergyClass | Unknown, string> = {
  A_plus: "A+",
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  E: "E",
  F: "F",
  G: "G",
  H: "H",
  unknown: "Not sure",
};

export const CONDITION_LABELS: Record<Condition | Unknown, string> = {
  first_occupancy: "First occupancy",
  renovated: "Renovated",
  well_kept: "Well kept",
  needs_renovation: "Needs renovation",
  unknown: "Not sure",
};

export const FURNISHING_LABELS: Record<Furnishing | Unknown, string> = {
  unfurnished: "Unfurnished",
  partly_furnished: "Partly furnished",
  furnished: "Furnished",
  unknown: "Not sure",
};

export const TRI_STATE_LABELS: Record<TriState, string> = {
  yes: "Yes",
  no: "No",
  unknown: "Not sure",
};

export const RING_STATUS_LABELS = {
  inside: "Inside the ring",
  partly: "Partly inside the ring",
  outside: "Outside the ring",
} as const;
