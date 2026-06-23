import { Router } from "express";
import { Type } from "@google/genai";
import { createGeminiClient, generateContentWithRetry } from "../gemini";

const router = Router();

router.post("/day-analysis", async (req, res) => {
  try {
    const { messages, language } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "No messages provided for day analysis" });
    }

    const ai = createGeminiClient();

    // Limit to safety (max 300 messages to fit in Netlify's execution limit)
    const maxMsgs = 300;
    const slicedMessages = messages.length > maxMsgs ? messages.slice(-maxMsgs) : messages;

    const conversationText = slicedMessages
      .map((m) => `[${m.timeStr}] ${m.sender}: ${m.text}`)
      .join("\n");

    const langInstruction = `IMPORTANT: You must write all output text, summary, explanation, decisions, and disagreements in ${language === "nl" ? "Dutch" : "English"}.`;

    const prompt = `Analyze this daily WhatsApp group chat conversation history and generate a structured daily analysis.

${langInstruction}

Here is the conversation text:
${conversationText}

Please return the result in structured JSON. Include:
1. "summary": A concise 1-2 sentence summary of what was discussed on this day.
2. "sentiment": Sentiment and atmosphere details:
   - "label": A single-word or short phrase characterizing the overall mood (e.g., 'Positive', 'Tense', 'Collaborative', 'Urgent', 'Brainstorming', 'Constructive', 'Neutral').
   - "explanation": A 1-sentence explanation of why the atmosphere was described this way.
3. "decisions": A list of key agreements, consensus items, or decisions made on this day. If none, return an empty array.
4. "disagreements": A list of conflicts, tensions, heated debates, or disagreements that occurred on this day. If none, return an empty array.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.0,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "A concise 1-2 sentence daily summary." },
            sentiment: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, description: "Short mood label, e.g., Tense, Collaborative, Positive, Brainstorming, etc." },
                explanation: { type: Type.STRING, description: "One sentence explanation of the mood." }
              },
              required: ["label", "explanation"]
            },
            decisions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Key decisions made on this day."
            },
            disagreements: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Conflicts, disagreements, or tensions that occurred."
            }
          },
          required: ["summary", "sentiment", "decisions", "disagreements"]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response received from day analysis model.");
    }

    const parsedJSON = JSON.parse(responseText.trim());
    res.json(parsedJSON);
  } catch (error: any) {
    console.error("Gemini API server-side day analysis error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze day chat history." });
  }
});

export default router;
