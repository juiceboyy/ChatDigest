import { Router } from "express";
import { Type } from "@google/genai";
import { createGeminiClient, generateContentWithRetry } from "../gemini";

const router = Router();

router.post("/digest", async (req, res) => {
  try {
    const { messages, language } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "No messages provided for parsing" });
    }

    const ai = createGeminiClient();

    const maxMsgs = 500;
    const slicedMessages = messages.length > maxMsgs ? messages.slice(-maxMsgs) : messages;

    const conversationText = slicedMessages
      .map((m) => `[${m.dateStr} ${m.timeStr}] ${m.sender}: ${m.text}`)
      .join("\n");

    const todayObj = new Date();
    const todayStr = todayObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const langInstruction = `IMPORTANT: You must write all output text, analysis, markdown text, titles, descriptions, explanations, and summaries in ${language === "nl" ? "Dutch" : "English"}.`;

    const prompt = `Analyze this WhatsApp group chat conversation history and generate a high-quality analytical executive digest.

${langInstruction}

CRITICAL LOGICAL RULE & CONTEXT:
Today's date is: ${todayStr} (June 21, 2026).
Any date in the future (after ${todayStr}), such as June 27, 2026, HAS NOT HAPPENED YET. It is physically impossible for a chat conversation happening right now to contain a message sent in the future.
Therefore, any decision or action item parsed from this conversation MUST be dated ONLY with the exact date when the chat message was sent (the date in the brackets, e.g., '[June 15, 2026]').
NEVER use planned future event dates, target completion dates, or anniversary celebration dates (like 'June 27, 2026') as the decision's or action item's dateStr. The dateStr must represent the PAST or CURRENT date when the decision was agreed upon (which is <= ${todayStr}).

Here is the conversation text:
${conversationText}

Please analyze the discussions and output the result in structured JSON. Include:
1. "summary": A detailed, beautiful markdown-formatted executive summary (written in third-person, around 1-2 paragraphs maximum). Use bold styling (**text**) or bullets for major focus points. Keep it concise.
2. "executiveSummary": A highly polished, concise 2 to 3 sentence executive summary that answers 'what is the entire conversation about?' and states the core resolution or status cleanly in prose. Must be exactly 2-3 sentences.
3. "keywords": 5 to 10 key topic words / hashtags that define this chat thread.
4. "decisions": List the concrete consensus items, agreements, or signed-off choices made by members. Make sure to identify 'sender', 'text', and 'dateStr'.
   - MANDATORY DATE RULE: The 'dateStr' field MUST be the exact date when the message was sent (extracted strictly from the bracketed metadata at the start of the message, e.g., '[2026-06-20 ...]' becomes 'June 20, 2026'). Crucially, NEVER use dates of future events or anniversary celebration dates mentioned in the body of the message (e.g., if a message on June 20 discusses a party on June 27, the decision's dateStr must be June 20, 2026, NOT June 27, 2026). This date MUST always be on or before ${todayStr}.
5. "actionItems": List specific to-do tasks and assignments. Identify who is responsible ('sender'), what task was requested ('text'), and when it was defined ('dateStr').
   - MANDATORY DATE RULE: The 'dateStr' field MUST be the exact date when the message requesting the task was sent (extracted strictly from the bracketed metadata of the message). Never use event or plan dates discussed inside the message body. This date MUST always be on or before ${todayStr}.
   - COMPLETION ANALYSIS: Scan subsequent messages in the conversation history to see if the task was later completed or addressed in the chat. If a participant explicitly reports completing it, or it is clear from the discussion that the task is finished:
     - Set "completed" to true.
     - Set "completedBy" to the name of the participant who completed the task.
     - Set "completedMessage" to the exact message text (or a very close translation/summary of it) that refers to the completion.
     - Otherwise, set "completed" to false, and leave "completedBy" and "completedMessage" empty.`;

    const response = await generateContentWithRetry(ai, {
       model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: `Deep analytical executive summary in beautiful markdown. MUST BE WRITTEN ENTIRELY IN ${language === "nl" ? "Dutch (Nederlands)" : "English"}. Put terms of note or project names in bold styling. 1-2 paragraphs maximum.`,
            },
            executiveSummary: {
              type: Type.STRING,
              description: `A highly polished, concise 2 to 3 sentence executive summary of the entire conversation. MUST BE WRITTEN ENTIRELY IN ${language === "nl" ? "Dutch (Nederlands)" : "English"}. Exactly 2-3 sentences.`,
            },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "5 to 10 principal focus topics/hashtags as strings.",
            },
            decisions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sender: { type: Type.STRING, description: "Name of the participant proposing, agreeing, or certifying the decision." },
                  text: { type: Type.STRING, description: `Detailed, concrete decision or agreement statement. MUST BE WRITTEN ENTIRELY IN ${language === "nl" ? "Dutch (Nederlands)" : "English"}.` },
                  dateStr: {
                    type: Type.STRING,
                    description: "The actual date when the chat message containing this consensus was sent (obtained ONLY from the bracketed metadata, e.g. '[2026-06-20...]'). ABSOLUTELY NEVER use future event dates mentioned relative to the text contents (like June 27, 2026). This must be <= " + todayStr,
                  },
                },
                required: ["sender", "text", "dateStr"],
              },
            },
            actionItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sender: { type: Type.STRING, description: "Name of the person assigned or responsible. Defaults to 'The Group' if general." },
                  text: { type: Type.STRING, description: `Explicit task definition with execution detail. MUST BE WRITTEN ENTIRELY IN ${language === "nl" ? "Dutch (Nederlands)" : "English"}.` },
                  dateStr: {
                    type: Type.STRING,
                    description: "The actual date when the message containing this request was sent (obtained ONLY from the bracketed metadata, e.g. '[2026-06-20...]'). ABSOLUTELY NEVER use future event dates mentioned relative to the text contents (like June 27, 2026). This must be <= " + todayStr,
                  },
                  completed: {
                    type: Type.BOOLEAN,
                    description: "Set to true if the chat history shows this task was later completed. Otherwise false.",
                  },
                  completedBy: {
                    type: Type.STRING,
                    description: "If completed is true, the name of the participant who completed the task. Otherwise leave empty.",
                  },
                  completedMessage: {
                    type: Type.STRING,
                    description: `If completed is true, the exact or summarized text of the chat message that refers to the completion. MUST BE WRITTEN ENTIRELY IN ${language === "nl" ? "Dutch (Nederlands)" : "English"}. Otherwise leave empty.`,
                  },
                },
                required: ["sender", "text", "dateStr", "completed"],
              },
            },
          },
          required: ["summary", "executiveSummary", "keywords", "decisions", "actionItems"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response received from Gemini.");
    }

    const parsedJSON = JSON.parse(responseText.trim());

    res.json({
      summary: parsedJSON.summary,
      executiveSummary: parsedJSON.executiveSummary,
      keywords: parsedJSON.keywords,
      decisions: parsedJSON.decisions,
      actionItems: parsedJSON.actionItems,
    });
  } catch (error: any) {
    console.error("Gemini API server-side parse error:", error);
    res.status(500).json({ error: error.message || "Failed to digest conversation using Gemini." });
  }
});

export default router;
