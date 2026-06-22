import { Router } from "express";
import { Type } from "@google/genai";
import { createGeminiClient, generateContentWithRetry } from "../gemini";

const router = Router();

router.post("/translate", async (req, res) => {
  try {
    const { summary, executiveSummary, decisions, actionItems, language } = req.body;

    const ai = createGeminiClient();

    const targetLang = language === "nl" ? "Dutch" : "English";

    const prompt = `You are a professional translator and meeting analyst.
Translate the following chat digest parts into ${targetLang}. 

CRITICAL: Keep the same markdown format, the same meaning, and the exact same tone. 
For decisions and action items, translate the text, sender (if general like "The Group"), and completedMessage fields (do not translate dates, IDs, or usernames, but translate the task/agreement description text and the referencing completion message text).
If sender is "The Group" or "The Group", translate it to the target language if appropriate (e.g., "De Groep" in Dutch, or keep it). Keep other names as they are.

Here is the data to translate:
1. "summary":
${summary || ""}

2. "executiveSummary":
${executiveSummary || ""}

3. "decisions":
${JSON.stringify(decisions || [])}

4. "actionItems":
${JSON.stringify(actionItems || [])}

Output the translations in the exact same structured JSON schema.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "The translated summary in markdown." },
            executiveSummary: { type: Type.STRING, description: "The translated executiveSummary text." },
            decisions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  sender: { type: Type.STRING },
                  text: { type: Type.STRING, description: "The translated decision statement." },
                  dateStr: { type: Type.STRING },
                },
                required: ["id", "sender", "text", "dateStr"],
              },
            },
            actionItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  sender: { type: Type.STRING },
                  text: { type: Type.STRING, description: "The translated action item description." },
                  dateStr: { type: Type.STRING },
                  completed: { type: Type.BOOLEAN },
                  completedBy: { type: Type.STRING },
                  completedMessage: { type: Type.STRING, description: "The translated referencing completion message." },
                },
                required: ["id", "sender", "text", "dateStr", "completed"],
              },
            },
          },
          required: ["summary", "executiveSummary", "decisions", "actionItems"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response received from translation model.");
    }

    const parsedJSON = JSON.parse(responseText.trim());
    res.json(parsedJSON);
  } catch (error: any) {
    console.error("Gemini API server-side translation error:", error);
    res.status(500).json({ error: error.message || "Failed to translate digest." });
  }
});

export default router;
