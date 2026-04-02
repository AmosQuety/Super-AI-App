import { AppContext } from "../types/context";
import { VoiceCloningService } from "../../services/voiceCloningService";

const voiceCloningService = new VoiceCloningService();

export const voiceQueries = {
  getVoiceJobStatus: async (_: any, { jobId }: { jobId: string }, context: AppContext) => {
    if (!context.user) throw new Error("Unauthorized");
    
    const result = await voiceCloningService.getJobStatus(jobId);
    
    return {
      success: result.success !== false,
      status: result.status || "FAILED",
      message: result.message,
      audioUrl: result.audioUrl,
      error: result.error
    };
  }
};
