import { AppContext } from "../types/context";
import { VoiceCloningService } from "../../services/voiceCloningService";

const voiceCloningService = new VoiceCloningService();

export const voiceQueries = {
  getVoiceJobStatus: async (_: any, { jobId }: { jobId: string }, context: AppContext) => {
    if (!context.user) throw new Error("Unauthorized");
    
    const result = await voiceCloningService.getJobStatus(jobId);

    const task = await context.taskService.getTaskByResultReferenceForUser(context.user.userId, jobId);
    if (task) {
      const normalizedStatus = String(result.status || "").toLowerCase();

      if (normalizedStatus === "completed") {
        await context.taskService.completeTask(task.id, context.user.userId, {
          resultReference: jobId,
          metadata: {
            source: "voice-job-status",
          },
        });
      }

      if (normalizedStatus === "failed") {
        await context.taskService.failTask(task.id, context.user.userId, result.error || result.message || "Voice job failed", {
          metadata: {
            source: "voice-job-status",
          },
        });
      }
    }
    
    return {
      success: result.success !== false,
      status: result.status || "FAILED",
      message: result.message,
      audioUrl: result.audioUrl,
      error: result.error
    };
  }
};
