declare module "lz4js" {
  export function compress(data: Buffer | Uint8Array): Uint8Array;
  export function decompress(data: Buffer | Uint8Array): Uint8Array;
}
