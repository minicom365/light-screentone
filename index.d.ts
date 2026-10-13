export type ScreentonePattern =
  | 'dot'
  | 'line'
  | 'cross'
  | 'bayer4'
  | 'bayer8'
  | 'stochastic'
  | 'concentric';

export interface ScreentoneOptions {
  pattern?: ScreentonePattern;
  frequency?: number;
  angle?: number;
  invert?: boolean;
}

export interface EulerianHatchOptions {
  step?: number;
  threshold?: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export declare function screentone(
  x: number,
  y: number,
  intensity: number,
  opts?: ScreentoneOptions
): number;

export declare function applyToImageData(
  imageData: ImageData,
  opts?: ScreentoneOptions
): ImageData;

export declare function generateEulerianHatch(
  width: number,
  height: number,
  intensitySource: ((x: number, y: number) => number) | Float32Array | Uint8Array,
  opts?: EulerianHatchOptions
): Point2D[];

export declare const BAYER_4X4: Float32Array;
export declare const BAYER_8X8: Float32Array;
