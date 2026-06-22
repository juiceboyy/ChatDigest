import { Router } from "express";
import { Type } from "@google/genai";
import { createGeminiClient, generateContentWithRetry } from "../gemini";

const router = Router();

router.post("/parse-media", async (req, res) => {
  try {
    const { fileBase64, fileMimeType, fileName, chatSummary, userPrompt, language } = req.body;

    if (!fileBase64 || !fileMimeType) {
      return res.status(400).json({ error: "Missing required media file data" });
    }

    const ai = createGeminiClient();

    const mediaPart = {
      inlineData: {
        mimeType: fileMimeType,
        data: fileBase64,
      },
    };

    const langInstruction = `IMPORTANT: You must write all output text, analysis, markdown text, titles, descriptions, explanations, and summaries in ${language === "nl" ? "Dutch" : "English"}.`;

    const systemInstruction = `You are an expert AI multimodal media analyst for group chat conversations.
Analyze the provided media file (${fileName || "attached media"}) in the context of the chat thread.
We are providing a summary of the group chat conversation to give you context:
"${chatSummary || "No context chat summary available."}"

${langInstruction}

Your job is to parse this media file and extract:
1. "description": A highly detailed, professional, markdown-formatted executive summary explaining what this media file contains, what information it conveys, and how it fits into/relates to the chat group's themes. (2-3 paragraphs minimum).
2. "decisions": List any concrete agreements, approved designs, compromises, or signed-off choices explicitly stated, shown, or discussed inside this media file.
3. "actionItems": List specific to-do tasks, actions, assignments, or responsibilities mentioned, assigned, or shown in this media file (or transcripts thereof). Include who is responsible.`;

    const prompt = userPrompt || "Parse this media attachment and extract its description, key decisions, and action items.";

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: [mediaPart, prompt],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: {
              type: Type.STRING,
              description: "Deep, detailed multimodal asset summary in beautiful markdown. Put terms of note or project names in bold styling.",
            },
            decisions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sender: { type: Type.STRING, description: "Name of the person proposing, agreeing, or certifying the decision." },
                  text: { type: Type.STRING, description: "Detailed, concrete decision, agreement, or consensus shown in the media." },
                  dateStr: { type: Type.STRING, description: "Today's date or date mentioned in media." },
                },
                required: ["sender", "text", "dateStr"],
              },
            },
            actionItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sender: { type: Type.STRING, description: "Name of the person assigned or responsible. Use 'The Group' if general." },
                  text: { type: Type.STRING, description: "Explicit task definition with execution detail." },
                  dateStr: { type: Type.STRING, description: "Today's date or date/deadline mentioned." },
                },
                required: ["sender", "text", "dateStr"],
              },
            },
          },
          required: ["description", "decisions", "actionItems"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response received from Gemini for media analysis.");
    }

    const parsedJSON = JSON.parse(responseText.trim());
    res.json({
      description: parsedJSON.description,
      decisions: parsedJSON.decisions,
      actionItems: parsedJSON.actionItems,
    });
  } catch (error: any) {
    console.error("Gemini API media parse error:", error);
    res.status(500).json({ error: error.message || "Failed to parse media using Gemini." });
  }
});

export default router;
