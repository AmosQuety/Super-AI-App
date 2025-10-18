// src/resolvers/types/upload.ts
import { ReadStream } from "fs-capacitor";

export interface Upload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => ReadStream;
}