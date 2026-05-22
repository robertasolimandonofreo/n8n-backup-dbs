declare module "lzma" {
  export function compress(
    data: Buffer | Uint8Array | string,
    mode: number,
    onFinish: (result: number[] | null, error: unknown) => void,
    onProgress?: (percent: number) => void
  ): void;
}
