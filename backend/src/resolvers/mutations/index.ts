// src/resolvers/mutations/index.ts - UPDATED
import { userMutations } from "./userMutations";
import { chatMutations } from "./chatMutations";
import { messageMutations } from "./messageMutations";
import { faceAuthMutations } from "./faceAuthMutations";
import { geminiMutations } from "./geminiMutations";
import { imageMutations } from "./imageMutations"; // ADD THIS
import { documentMutations } from "./documentMutations";

export const mutationResolvers = {
  ...userMutations,
  ...chatMutations,
  ...messageMutations,
  ...faceAuthMutations,
  ...geminiMutations,
  ...imageMutations, 
  ...documentMutations,
};