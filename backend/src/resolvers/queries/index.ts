// src/resolvers/queries/index.ts - UPDATED
import { userQueries } from "./userQueries";
import { chatQueries } from "./chatQueries";
import { faceServiceQueries } from "./faceServiceQueries";
import { imageQueries } from "./imageQueries"; // ADD THIS

export const queryResolvers = {
  ...userQueries,
  ...chatQueries,
  ...faceServiceQueries,
  ...imageQueries, // ADD THIS
};