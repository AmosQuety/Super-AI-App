// src/resolvers/queries/index.ts - UPDATED
import { userQueries } from "./userQueries";
import { chatQueries } from "./chatQueries";
import { faceServiceQueries } from "./faceServiceQueries";
import { imageQueries } from "./imageQueries"; // ADD THIS
import { voiceQueries } from "./voiceQueries";
import { taskQueries } from "./taskQueries";
import { pushQueries } from "./pushQueries";

export const queryResolvers = {
  ...userQueries,
  ...chatQueries,
  ...faceServiceQueries,
  ...imageQueries, // ADD THIS
  ...voiceQueries,
  ...taskQueries,
  ...pushQueries,

};