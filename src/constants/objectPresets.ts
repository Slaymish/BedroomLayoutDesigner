export interface BedSizePreset {
  name: string;
  widthCm: number;
  heightCm: number;
}

export interface ObjectPreset {
  type: string;
  widthCm: number;
  heightCm: number;
}

export const BED_SIZE_PRESETS: BedSizePreset[] = [
  { name: 'Single', widthCm: 90, heightCm: 190 },
  { name: 'King Single', widthCm: 107, heightCm: 203 },
  { name: 'Double', widthCm: 135, heightCm: 190 },
  { name: 'Queen', widthCm: 150, heightCm: 190 },
  { name: 'King', widthCm: 150, heightCm: 200 },
  { name: 'Super King', widthCm: 180, heightCm: 200 },
];

export const OBJECT_PRESETS: ObjectPreset[] = [
  { type: 'Wardrobe', widthCm: 150, heightCm: 60 },
  { type: 'Desk', widthCm: 120, heightCm: 60 },
  { type: 'Couch', widthCm: 200, heightCm: 90 },
  { type: 'Bedside Table', widthCm: 45, heightCm: 45 },
  { type: 'Door', widthCm: 80, heightCm: 10 },
  { type: 'Window', widthCm: 100, heightCm: 10 },
];
