import { Router } from "express";
import { Type } from "@google/genai";
import { createGeminiClient, generateContentWithRetry } from "../gemini";

const router = Router();

router.post("/meta-analysis", async (req, res) => {
  try {
    const { dayAnalyses, periodAnalyses, timeline, language } = req.body;

    const ai = createGeminiClient();

    const langInstruction = `IMPORTANT: You must write all output text, chronology narrative, dynamics analysis, milestones, and summary in ${language === "nl" ? "Dutch" : "English"}.`;

    const prompt = `You are an expert conversation analyst and team dynamics consultant.
We have collected timeline metrics, along with previously generated daily AI analyses and period AI analyses from a WhatsApp group chat.
Your task is to perform an overall META-ANALYSIS (overkoepelende analyse) of this conversation history over time.
Identify key phases/chapters of progress, track tone shifts and team dynamics, and compile critical milestones.

${langInstruction}

Here is the daily timeline metadata (dates, message counts, and peak speakers):
${JSON.stringify(timeline, null, 2)}

Here are the saved Day AI Analyses (keyed by date):
${JSON.stringify(dayAnalyses || {}, null, 2)}

Here are the saved Custom Period AI Analyses (keyed by start_end dates):
${JSON.stringify(periodAnalyses || {}, null, 2)}

Please return the meta-analysis in structured JSON. Include:
1. "chronology": A detailed chronological progression overview in beautiful markdown (1-3 phases or chapters) summarizing how the group's discussions, themes, and goals evolved from start to end (tijdsbeeld).
2. "dynamics": A detailed markdown-formatted analysis explaining how group dynamics, active participation, and conversational atmosphere (tone) shifted over the course of the chat.
3. "milestones": A chronological list of key decisions, agreements, or breakthrough moments achieved, noting the date they occurred.
4. "actionSummary": A high-level overview summary of key deliverables and future directions discussed.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.0,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            chronology: { type: Type.STRING, description: "Chronological progression narrative in beautiful markdown." },
            dynamics: { type: Type.STRING, description: "Analysis of team dynamics and tone shifts in beautiful markdown." },
            milestones: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Key chronological milestones and their dates."
            },
            actionSummary: { type: Type.STRING, description: "Brief overview of action items and deliverables." }
          },
          required: ["chronology", "dynamics", "milestones", "actionSummary"]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response received from meta analysis model.");
    }

    const parsedJSON = JSON.parse(responseText.trim());
    res.json(parsedJSON);
  } catch (error: any) {
    console.error("Gemini API server-side meta analysis error:", error);
    res.status(500).json({ error: error.message || "Failed to perform overall meta analysis." });
  }
});

export default router;
