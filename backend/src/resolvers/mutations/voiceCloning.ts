import { IResolvers } from "@graphql-tools/utils";
import { AppContext } from "../types/context";
import { VoiceCloningService } from "../../services/voiceCloningService";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";

const voiceCloningService = new VoiceCloningService();

// Initialize Supabase for storage
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.Supabase_Service_Role_Secret || process.env.SUPABASE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export const voiceCloningResolvers = {
  Mutation: {
    registerVoice: async (_: any, { referenceAudio }: { referenceAudio: any }, context: AppContext) => {
      try {
        if (!context.user) throw new Error("Unauthorized");
        const userId = context.user.userId;

        logger.info(`🎙️ Registering voice for user ${userId}`);
        const result = await voiceCloningService.registerVoice(userId, referenceAudio);

        if (!result.success) {
          return {
            success: false,
            error: result.error || "Voice registration failed"
          };
        }

        // Update user record to reflect registration (if it was polled successfully)
        if (result.jobId && result.message?.includes('successfully')) {
          await context.prisma.user.update({
             where: { id: userId },
             data: { hasVoiceRegistered: true }
          });
        }

        return {
          success: true,
          jobId: result.jobId,
          status: "COMPLETED",
        };
      } catch (error: any) {
        logger.error("❌ registerVoice Error:", error);
        return {
          success: false,
          error: error.message
        };
      }
    },
    
    removeVoice: async (_: any, __: any, context: AppContext) => {
      try {
        if (!context.user) throw new Error("Unauthorized");
        const userId = context.user.userId;

        logger.info(`🗑️ Deleting voice profile for user ${userId}`);

        // 1. Delete Files from Storage
        const { error: storageError } = await supabase.storage
          .from("biometric_faces")
          .remove([
            `voice-latents/${userId}/gpt_cond_latent.npy.enc`,
            `voice-latents/${userId}/speaker_embedding.npy.enc`,
            `voice-latents/${userId}/speechbrain.npy.enc`
          ]);

        if (storageError) {
          logger.warn(`⚠️ Supabase Storage cleanup warning: ${storageError.message}`);
          // We continue anyway, as the DB record is the primary source of truth for the UI
        }

        // 2. Delete Embedding from DB
        await supabase
          .from("voice_embeddings")
          .delete()
          .eq("user_id", userId);

        // 3. Update User Flag
        await context.prisma.user.update({
          where: { id: userId },
          data: { hasVoiceRegistered: false }
        });

        return { success: true, message: "Voice profile removed successfully." };
      } catch (err: any) {
        logger.error("❌ removeVoice Error:", err);
        return { success: false, message: err.message || "Failed to remove voice profile" };
      }
    },

    cloneVoice: async (_: any, { text, referenceAudio }: { text: string; referenceAudio?: any }, context: AppContext) => {
      try {
        if (!context.user) throw new Error("Unauthorized");
        const userId = context.user.userId;

        logger.info(`🎙️ Starting voice clone for user ${userId}`);

        const result = await voiceCloningService.cloneVoice(text, referenceAudio, userId);

        if (!result.success || !result.jobId) {
          return {
            success: false,
            error: result.error || "Voice cloning failed to initialize"
          };
        }

        // Return immediately with Job ID so the frontend can start polling
        return {
          success: true,
          jobId: result.jobId,
          status: result.status,
        };

      } catch (error: any) {
        logger.error("❌ voiceCloningResolver Error:", error);
        return {
          success: false,
          error: error.message
        };
      }
    }
  }
};
