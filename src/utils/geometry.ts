export interface BoundingBox {
  width: number;
  height: number;
}

export const clamp = (value: number, min: number, max: number): number => (
  Math.max(min, Math.min(value, max))
);

export const getBoundingBox = (w: number, h: number, rotation = 0): BoundingBox => {
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  return {
    width: w * cos + h * sin,
    height: w * sin + h * cos,
  };
};
