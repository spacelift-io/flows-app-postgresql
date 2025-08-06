declare module "pg-copy-streams" {
  import { Writable, Readable, Transform } from "stream";

  export function from(text: string): Writable;
  export function to(text: string): Readable;
}
