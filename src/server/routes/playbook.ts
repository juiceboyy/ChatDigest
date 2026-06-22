import { Router } from "express";
import { Type } from "@google/genai";
import { createGeminiClient, generateContentWithRetry } from "../gemini";

const router = Router();

router.post("/playbook", async (req, res) => {
  try {
    const { decisions, actionItems, language } = req.body;

    const ai = createGeminiClient();

    const decisionsText = (decisions || [])
      .map((d: any) => `- [${d.sender}] ${d.text}`)
      .join("\n");

    const actionsText = (actionItems || [])
      .map((a: any) => `- [${a.sender}] ${a.text} (Completed: ${a.completed ? "Yes" : "No"})`)
      .join("\n");

    const langInstruction = `IMPORTANT: You must write all output text, analysis, plays, steps, tips, descriptions, and summaries in ${language === "nl" ? "Dutch" : "English"}.`;

    const systemInstruction = `You are an expert strategic advisor, operations head, and agile systems architect.
Your job is to translate a list of key project decisions and action items into a highly actionable, structured, professional 'Operational Playbook' (runbook).

The playbook MUST be dynamic and directly inferred from the provided lists:
1. Synthesize an "overview" (a clear, 1-2 sentence strategic alignment summary and roadmap).
2. Generate 2 to 3 operational "Plays" (e.g., split by categories like 'Technology & Stack', 'Schedules & Delivery', 'Roles & Alignment', or 'Testing & Operations' as relevant to the decisions).
3. For each Play, write:
   - A unique, descriptive 'title' (written with action verbs, e.g., 'Bootstrap Client Micro-frontend & Environment Config')
   - A distinct operability 'category'
   - A concise 'description' (1-2 sentences) explaining the logic, rationale, and background of this play based on the decisions.
   - A list of tactical 'steps' that need to be followed sequentially (exactly 3 steps)
   - A list of expert operational 'tips' or strategic advice (exactly 2 tips)

${langInstruction}

Output the results strictly in structured JSON. Ensure all content is cohesive, elegant, and tailored to the topic discussed. Do not use generic placeholders.`;

    const prompt = `Here are the active Decisions on the team ledger:
${decisionsText || "No decisions made yet."}

Here are the registered Action Items:
${actionsText || "No action items created yet."}

Generate the complete Operational Playbook now.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overview: {
              type: Type.STRING,
              description: "A professional 2-3 sentence executive overview aligning the plays with the overall team's goals.",
            },
            plays: {
              type: Type.ARRAY,
              description: "The list of operational plays/chapters.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                  description: { type: Type.STRING },
                  steps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  tips: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ["id", "title", "category", "description", "steps", "tips"],
              },
            },
          },
          required: ["overview", "plays"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response received from playbook generation model.");
    }

    const parsedJSON = JSON.parse(responseText.trim());
    res.json({
      playbook: {
        generatedAt: new Date().toISOString(),
        overview: parsedJSON.overview,
        plays: parsedJSON.plays,
      },
    });
  } catch (error: any) {
    console.error("Gemini API server-side playbook error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI Playbook." });
  }
});

export default router;
