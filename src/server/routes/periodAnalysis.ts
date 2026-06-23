import { Router } from "express";
import { Type } from "@google/genai";
import { createGeminiClient, generateContentWithRetry } from "../gemini";

const router = Router();

router.post("/period-analysis", async (req, res) => {
  try {
    const { messages, includeTrends, language } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "No messages provided for period analysis" });
    }

    const ai = createGeminiClient();

    // Limit to safety (max 300 messages to stay within Netlify serverless limits)
    const maxMsgs = 300;
    const slicedMessages = messages.length > maxMsgs ? messages.slice(-maxMsgs) : messages;

    const conversationText = slicedMessages
      .map((m) => `[${m.dateStr} ${m.timeStr}] ${m.sender}: ${m.text}`)
      .join("\n");

    const langInstruction = `IMPORTANT: You must write all output text, summary, trends, decisions, and action items in ${language === "nl" ? "Dutch" : "English"}.`;

    const prompt = `Analyze this WhatsApp group chat conversation history for a custom selected time period and generate a structured period overview.

${langInstruction}

Here is the conversation text:
${conversationText}

Please return the result in structured JSON. Include:
1. "summary": A detailed, high-quality summary in beautiful markdown (1-2 paragraphs maximum) explaining the core of the discussion during this period.
2. "trends": ${
      includeTrends
        ? "A detailed analysis in beautiful markdown outlining the conversational trends, atmosphere shifts, topic changes, or participant interaction dynamics over this period."
        : "Set this field to null. DO NOT write anything else."
    }
3. "decisions": A list of key agreements, consensus items, or decisions made in this period. If none, return an empty array.
4. "actionItems": A list of key tasks, assignments, or action items defined in this period, noting who is responsible. If none, return an empty array.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.0,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Detailed summary of the period in beautiful markdown." },
            trends: {
              type: Type.STRING,
              nullable: true,
              description: includeTrends 
                ? "Detailed markdown analysis of trends, mood shifts, or group dynamics."
                : "Must be null since includeTrends is false."
            },
            decisions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Key decisions made during this period."
            },
            actionItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Key action items or tasks assigned during this period."
            }
          },
          required: ["summary", "decisions", "actionItems"]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response received from period analysis model.");
    }

    const parsedJSON = JSON.parse(responseText.trim());
    res.json({
      summary: parsedJSON.summary,
      trends: parsedJSON.trends || null,
      decisions: parsedJSON.decisions || [],
      actionItems: parsedJSON.actionItems || [],
    });
  } catch (error: any) {
    console.error("Gemini API server-side period analysis error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze period chat history." });
  }
});

export default router;
