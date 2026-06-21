import { Router } from "express";
import { createGeminiClient, generateContentWithRetry } from "../gemini";

const router = Router();

router.post("/executive-summary", async (req, res) => {
  try {
    const { messages, language } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "No messages provided for executive summary generation" });
    }

    const ai = createGeminiClient();

    const maxMsgs = 1200;
    const slicedMessages = messages.length > maxMsgs ? messages.slice(-maxMsgs) : messages;

    const conversationText = slicedMessages
      .map((m) => `[${m.dateStr} ${m.timeStr}] ${m.sender}: ${m.text}`)
      .join("\n");

    const langInstruction = `IMPORTANT: You must write the executive summary in ${language === "nl" ? "Dutch" : "English"}.`;

    const systemInstruction = `You are a professional conversation analyst. 
Your task is to write a highly polished, coherent 2 to 3 sentence 'Executive Summary' of the entire conversation.
- Answer 'What is the entire chat log about?' and 'What were the key agreements or final resolutions?'
- Must be written in active, high-level prose, in third-person.
- Keep it strictly to exactly 2 or 3 sentences total.
- Do NOT use bullet points, markdown list syntax, or introductory meta-text like 'Based on the provided text...'. Just output the elegant plain-text prose directly.

${langInstruction}`;

    const prompt = `Here is the conversation text:\n${conversationText}\n\nGenerate the 2-3 sentence executive summary now.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response received from executive summary synthesis model.");
    }

    res.json({
      executiveSummary: responseText.trim(),
    });
  } catch (error: any) {
    console.error("Gemini API server-side executive summary error:", error);
    res.status(500).json({ error: error.message || "Failed to generate executive summary." });
  }
});

export default router;
