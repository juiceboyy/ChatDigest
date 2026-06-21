import { Router } from "express";
import { createGeminiClient, generateContentWithRetry } from "../gemini";

const router = Router();

router.post("/chat", async (req, res) => {
  try {
    const { messages, decisions, chatHistory, userQuestion, language } = req.body;

    if (!messages || !Array.isArray(messages) || !userQuestion) {
      return res.status(400).json({ error: "Missing required fields for chat" });
    }

    const ai = createGeminiClient();

    const todayObj = new Date();
    const todayStr = todayObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const maxMsgs = 1200;
    const slicedMessages = messages.length > maxMsgs ? messages.slice(-maxMsgs) : messages;

    const conversationText = slicedMessages
      .map((m) => `[${m.dateStr} ${m.timeStr}] ${m.sender}: ${m.text}`)
      .join("\n");

    const decisionsText = (decisions || [])
      .map((d: any) => `- [Made by: ${d.sender} on ${d.dateStr}] ${d.text}`)
      .join("\n");

    const langInstruction = `IMPORTANT: You must reply and write all responses in ${language === "nl" ? "Dutch" : "English"}.`;

    const systemInstruction = `You are an expert AI meeting analyst. You are discussing a group chat ledger that is actively being viewed in a dashboard.
Today is ${todayStr}. Any date in the future (after ${todayStr}), such as June 27, 2026, has not happened yet.
Crucially: If you see any committed key decision on the ledger dated in the future (e.g., June 27, 2026), please understand and point out to the user that this is an incorrectly attributed date (it represents the celebration or event date being planned, not the actual date when the decision was agreed upon). The actual decision was made in the past relative to ${todayStr} (e.g. around June 15, 2026 during the chat stream).
Help clarify this distinction gracefully if the user asks about dates!

Additionally, here is the official list of Key Decisions that have been committed/accepted to the team's decision ledger:
${decisionsText || "(No decisions are currently committed/accepted on the ledger)"}

Here is the group chat log context:
${conversationText}

${langInstruction}

Provide crisp, authoritative answers to the user's questions. You have access to both the raw chat messages and the official ledger of committed Decisions. Always quote specific contributors, decisions, or timestamps when answering, helping the user accurately trace discussions and verified consensus. Use formatting or lists where appropriate.`;

    const contents = [];
    if (chatHistory && Array.isArray(chatHistory)) {
      for (const turn of chatHistory) {
        contents.push({
          role: turn.role,
          parts: [{ text: turn.text }],
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: userQuestion }],
    });

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction,
      },
    });

    res.json({ text: response.text || "I was unable to synthesize a response." });
  } catch (error: any) {
    console.error("Gemini API server-side chat error:", error);
    res.status(500).json({ error: error.message || "Failed to communicate with Gemini." });
  }
});

export default router;
