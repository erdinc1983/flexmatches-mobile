/**
 * Distance unit helpers.
 *
 * The server always stores and returns distances in KILOMETERS
 * (users.units says which unit the user wants to SEE, not store).
 * These helpers render km → the user's preferred unit.
 */

export type Units = "imperial" | "metric";

const KM_PER_MILE = 1.60934;

/**
 * Format a distance in km for display in the given unit system.
 * Rounds to nearest whole number. Returns e.g. "5 km" or "3 mi".
 */
export function formatDistance(km: number, units: Units): string {
  if (units === "imperial") {
    const mi = km / KM_PER_MILE;
    return `${Math.round(mi)} mi`;
  }
  return `${Math.round(km)} km`;
}

/**
 * Default distance filter options for the user's unit system.
 * Imperial and metric use different round numbers (3/6/15/30 mi vs 5/10/25/50 km)
 * so chips read naturally in either unit. Each option is returned as the
 * km value (for server comparison) plus the localized display label.
 */
export function distanceOptions(units: Units): { km: number; label: string }[] {
  if (units === "imperial") {
    return [
      { km: 5,  label: "3 mi"  },   // ≈3mi
      { km: 10, label: "6 mi"  },   // ≈6mi
      { km: 24, label: "15 mi" },   // ≈15mi
      { km: 48, label: "30 mi" },   // ≈30mi
    ];
  }
  return [
    { km: 5,  label: "5 km"  },
    { km: 10, label: "10 km" },
    { km: 25, label: "25 km" },
    { km: 50, label: "50 km" },
  ];
}
