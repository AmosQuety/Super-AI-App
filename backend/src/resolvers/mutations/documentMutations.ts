import { AppContext } from "../types/context";
import { Upload } from "../types/upload";
import { CloudinaryService } from "../../services/cloudinaryService";
import { processDocument } from "../../services/documentIngestionService";

export const documentMutations = {
  uploadDocument: async (
    _: any,
    { file }: { file: Promise<Upload> },
    context: AppContext
  ) => {
    if (!context.user) throw new Error("Login required");

    try {
      const { createReadStream, filename, mimetype } = await file;
      
      // 1. Convert Stream to Buffer
      const chunks: Buffer[] = [];
      for await (const chunk of createReadStream()) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // 2. Upload to Cloudinary (Storage)
      // Note: Make sure CloudinaryService.uploadFile returns the secure_url
      const uploadResult: any = await CloudinaryService.uploadFile(buffer, "rag_documents");
      const fileUrl = uploadResult.secure_url;

      // 3. Create the document in a processing state so ingestion can continue in the background.
      const document = await context.prisma.document.create({
        data: {
          filename,
          fileType: mimetype,
          fileUrl,
          userId: context.user.userId, // Use userId from token
          status: "processing",
        } as any
      });

      // 4. Kick off ingestion asynchronously so the upload mutation returns immediately.
      void processDocument(document.id, {
        prisma: context.prisma,
        embeddingService: context.geminiAIService,
      }).catch((error) => {
        console.error(`Document ingestion failed for ${document.id}:`, error);
      });

      return {
        success: true,
        message: `Uploaded ${filename}. Document processing has started.`
      };

    } catch (error: any) {
      console.error("Upload Error:", error);
      return { success: false, message: error.message };
    }
  }
};