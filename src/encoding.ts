export class TextEncoder {
  encode(s: string): Uint8Array {
    return Buffer.from(s);
  }
}
export class TextDecoder {
  decode(u: Uint8Array): string {
    return Buffer.from(u).toString();
  }
}
