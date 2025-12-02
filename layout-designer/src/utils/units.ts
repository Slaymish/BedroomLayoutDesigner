export type Unit = 'mm' | 'cm' | 'm' | 'in' | 'ft';

// Conversion factors to centimeters
const unitToCm: Record<Unit, number> = {
  mm: 0.1,      // 1 mm = 0.1 cm
  cm: 1,        // 1 cm = 1 cm
  m: 100,       // 1 m = 100 cm
  in: 2.54,     // 1 inch = 2.54 cm
  ft: 30.48,    // 1 foot = 30.48 cm
};

export function toBaseCm(value: number, unit: Unit = 'cm'): number {
  return value * unitToCm[unit];
}

export function fromBaseCm(valueCm: number, unit: Unit = 'cm'): number {
  return valueCm / unitToCm[unit];
}

export function formatValue(valueCm: number, unit: Unit): string {
  const v = fromBaseCm(valueCm, unit);
  // For meters & feet show 2 decimals, others show up to 1 unless small
  const decimals = unit === 'm' || unit === 'ft' ? 2 : 1;
  return Number(v.toFixed(decimals)).toString();
}
