import { Router } from "express";
import { Type } from "@google/genai";
import { createGeminiClient, generateContentWithRetry } from "../gemini";

const router = Router();

router.post("/digest-media", async (req, res) => {
  try {
    const { frames, userPrompt, language, extractMessagesOnly } = req.body;

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({ error: "Missing required media frame data" });
    }

    const ai = createGeminiClient();

    const imageParts = frames.map((base64: string) => ({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64,
      },
    }));

    const todayObj = new Date();
    const todayStr = todayObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const langInstruction = `IMPORTANT: You must write all output text, analysis, markdown text, titles, descriptions, explanations, and summaries in ${language === "nl" ? "Dutch" : "English"}.`;

    const systemInstruction = extractMessagesOnly
      ? `You are an expert AI multimodal chat log OCR parser.
You are given a chronological sequence of screenshots (frames) from a scrolling group chat (e.g. WhatsApp).
The frames contain overlapping regions as the user scrolled through the chat history.

Your tasks are:
1. Reconstruct the complete, deduplicated chat log in chronological order.
2. For each message, extract:
   - "sender": The name of the participant.
   - "text": The clean message body.
   - "dateStr": The date when the message was sent (e.g. YYYY-MM-DD or standard readable format).
   - "timeStr": The time when the message was sent (e.g. HH:MM).
3. Combine overlapping message fragments across frames so that each message appears exactly once in the final output.

${langInstruction}`
      : `You are an expert AI multimodal chat log reconstructor.
You are given a chronological sequence of screenshots (frames) from a scrolling group chat (e.g. WhatsApp).
The frames contain overlapping regions as the user scrolled.

Your tasks are:
1. Reconstruct the complete, deduplicated chat log in chronological order.
2. For each message, extract:
   - "sender": The name of the participant.
   - "text": The clean message body.
   - "dateStr": The date when the message was sent.
   - "timeStr": The time when the message was sent.
3. Combine overlapping message fragments across frames so that each message appears exactly once in the final output.
4. Generate:
   - "summary": A detailed, beautiful markdown-formatted executive summary of the chat (3 paragraphs minimum). Put terms of note or project names in bold.
   - "executiveSummary": A highly polished 2-3 sentence executive summary of the conversation.
   - "keywords": 5 to 10 principal focus topics/hashtags.
   - "decisions": List concrete consensus items or agreements (include "sender", "text", "dateStr").
   - "actionItems": List specific to-do tasks and assignments (include "sender", "text", "dateStr").

CRITICAL LOGICAL RULE & CONTEXT:
Today's date is: ${todayStr} (June 21, 2026).
Any date in the future (after ${todayStr}) HAS NOT HAPPENED YET. Any decision or action item parsed must be dated ONLY with the exact date when the message was sent.
NEVER use planned future event dates as the decision's or action item's dateStr. The dateStr must represent the date when the decision was agreed upon.

${langInstruction}`;

    const prompt = extractMessagesOnly
      ? "Reconstruct the chronological message history from these screenshots. Return ONLY the messages list in the response."
      : (userPrompt
        ? `Reconstruct the chat history and generate a digest from these screenshots. Custom Instructions: ${userPrompt}`
        : "Reconstruct the chat history and generate a digest from these screenshots.");

    const messagesSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sender: { type: Type.STRING, description: "Name of the participant." },
          text: { type: Type.STRING, description: "Clean message text." },
          dateStr: { type: Type.STRING, description: "Date of message (e.g. YYYY-MM-DD)." },
          timeStr: { type: Type.STRING, description: "Time of message (e.g. HH:MM)." }
        },
        required: ["sender", "text", "dateStr", "timeStr"]
      }
    };

    const responseSchema = extractMessagesOnly
      ? {
          type: Type.OBJECT,
          properties: {
            messages: messagesSchema
          },
          required: ["messages"]
        }
      : {
          type: Type.OBJECT,
          properties: {
            messages: messagesSchema,
            summary: {
              type: Type.STRING,
              description: `Deep analytical executive summary in beautiful markdown. MUST BE WRITTEN ENTIRELY IN ${language === "nl" ? "Dutch (Nederlands)" : "English"}. Put terms of note or project names in bold styling. 3 paragraphs minimum.`
            },
            executiveSummary: {
              type: Type.STRING,
              description: `A highly polished, concise 2 to 3 sentence executive summary of the entire conversation. MUST BE WRITTEN ENTIRELY IN ${language === "nl" ? "Dutch (Nederlands)" : "English"}. Exactly 2-3 sentences.`
            },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "5 to 10 principal focus topics/hashtags as strings."
            },
            decisions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sender: { type: Type.STRING, description: "Name of the participant." },
                  text: { type: Type.STRING, description: `Detailed, concrete decision statement. MUST BE WRITTEN ENTIRELY IN ${language === "nl" ? "Dutch (Nederlands)" : "English"}.` },
                  dateStr: { type: Type.STRING, description: "The actual date when the chat message containing this consensus was sent." }
                },
                required: ["sender", "text", "dateStr"]
              }
            },
            actionItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sender: { type: Type.STRING, description: "Name of the person assigned or responsible." },
                  text: { type: Type.STRING, description: `Explicit task definition. MUST BE WRITTEN ENTIRELY IN ${language === "nl" ? "Dutch (Nederlands)" : "English"}.` },
                  dateStr: { type: Type.STRING, description: "The actual date when the message containing this request was sent." }
                },
                required: ["sender", "text", "dateStr"]
              }
            }
          },
          required: ["messages", "summary", "executiveSummary", "keywords", "decisions", "actionItems"]
        };

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: [...imageParts, prompt],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response received from Gemini for chat media analysis.");
    }

    const parsedJSON = JSON.parse(responseText.trim());
    if (extractMessagesOnly) {
      res.json({
        messages: parsedJSON.messages
      });
    } else {
      res.json({
        messages: parsedJSON.messages,
        summary: parsedJSON.summary,
        executiveSummary: parsedJSON.executiveSummary,
        keywords: parsedJSON.keywords,
        decisions: parsedJSON.decisions,
        actionItems: parsedJSON.actionItems
      });
    }
  } catch (error: any) {
    console.error("Gemini API chat media parse error:", error);
    res.status(500).json({ error: error.message || "Failed to digest chat media using Gemini." });
  }
});

export default router;
