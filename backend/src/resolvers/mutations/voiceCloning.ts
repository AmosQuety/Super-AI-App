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
            message: result.error || "Voice registration failed"
          };
        }

        // Update user record to reflect registration
        await context.prisma.user.update({
          where: { id: userId },
          data: { hasVoiceRegistered: true }
        });

        return {
          success: true,
          message: result.message || "Voice registered successfully"
        };
      } catch (error: any) {
        logger.error("❌ registerVoice Error:", error);
        return {
          success: false,
          message: error.message
        };
      }
    },

    cloneVoice: async (_: any, { text, referenceAudio }: { text: string; referenceAudio?: any }, context: AppContext) => {
      try {
        if (!context.user) throw new Error("Unauthorized");
        const userId = context.user.userId;

        logger.info(`🎙️ Starting voice clone for user ${userId}`);

        const result = await voiceCloningService.cloneVoice(text, referenceAudio, userId);

        if (!result.success || !result.data) {
          return {
            success: false,
            error: result.error || "Voice cloning failed"
          };
        }

        // Upload generated audio to Supabase Storage
        const fileName = `voice-clones/${userId}/${Date.now()}.wav`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("biometric_faces")
          .upload(fileName, result.data, {
            contentType: "audio/wav",
            upsert: true
          });

        if (uploadError) {
          logger.error("❌ Failed to upload voice clone to Supabase", uploadError);
          return {
            success: false,
            error: "Failed to store generated audio"
          };
        }

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from("biometric_faces")
          .getPublicUrl(fileName);

        // Optional: Save AudioJob record in DB
        await context.prisma.audioJob.create({
          data: {
            userId: userId,
            type: "VOICE_CLONE",
            inputText: text,
            outputUrl: publicUrl,
            status: "COMPLETED"
          }
        });

        return {
          success: true,
          audioUrl: publicUrl
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
