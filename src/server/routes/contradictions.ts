import { Router } from "express";
import { Type } from "@google/genai";
import { createGeminiClient, generateContentWithRetry } from "../gemini";

const router = Router();

router.post("/check-contradictions", async (req, res) => {
  try {
    const { newDecisionText, existingDecisions, language } = req.body;

    if (!newDecisionText) {
      return res.status(400).json({ error: "Missing newDecisionText" });
    }

    const ai = createGeminiClient();

    const decisionsList = (existingDecisions || [])
      .map(
        (d: any, index: number) =>
          `Index: ${index} | ID: ${d.id} | Sender: ${d.sender} | Date: ${d.dateStr} | Statement: ${d.text}`
      )
      .join("\n");

    const langInstruction = `IMPORTANT: You must write all output text, analysis, explanations, and reasons in ${language === "nl" ? "Dutch" : "English"}.`;

    const systemInstruction = `You are a logical consistency and consensus auditing bot for project decisions and commitments.
Your job is to identify when a newly proposed decision contradicts existing decisions in a ledger.

${langInstruction}

Crucially, if a contrary decision consists of multiple parts (compound commitment), you must break it down first into singular commitments.
For example:
- Original: "We will build on React, use PostgreSQL, and deploy on Cloud Run."
- New Decision: "We decided to use Firestore instead of PostgreSQL."
- The original PostgreSQL Postgres parts must be isolated as the sole contrary commitment, while "React development" and "Cloud Run deployment" must be isolated and marked non-contrary so they are preserved.

For each flagged existing decision:
1. Determine if it consists of multiple independent commitments/assertions. If so, set isMultiPart to true and break it down into atomic, independent commitments/assertions in the "parts" array.
2. If it is a simple, single commitment, set isMultiPart to false and provide a single item in the "parts" array.
3. For each part, specify if it contradicts the new proposed decision (isContrary) and why (explanation).`;

    const prompt = `Here is the newly proposed decision:
"${newDecisionText}"

Here is the list of existing decisions on the ledger:
${decisionsList || "(No existing decisions. Ledger is empty.)"}

If any existing decisions are contrary to the new decision, identify them and break them down if multi-part. Output the results in the required JSON schema.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.0,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            contradictions: {
              type: Type.ARRAY,
              description: "List of existing decisions that have a contradiction with the new decision.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {
                    type: Type.STRING,
                    description: "The ID of the existing contradictory decision on the ledger.",
                  },
                  isMultiPart: {
                    type: Type.BOOLEAN,
                    description: "True if the existing decision consists of multiple distinct parts/clauses that can be split into singular commitments.",
                  },
                  parts: {
                    type: Type.ARRAY,
                    description: "The list of singular commitments/parts of this decision.",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        partId: {
                          type: Type.STRING,
                          description: "A short unique key for this part (e.g. 'p0', 'p1').",
                        },
                        text: {
                          type: Type.STRING,
                          description: "The independent, polished, third-person singular commitment statement.",
                        },
                        isContrary: {
                          type: Type.BOOLEAN,
                          description: "True if this specific broken-down single commitment directly opposes the new decision.",
                        },
                        explanation: {
                          type: Type.STRING,
                          description: "A direct sentence explaining why this part is contrary (only if isContrary is true).",
                        },
                      },
                      required: ["partId", "text", "isContrary", "explanation"],
                    },
                  },
                },
                required: ["id", "isMultiPart", "parts"],
              },
            },
          },
          required: ["contradictions"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response received from contradiction auditing model.");
    }

    const parsedJSON = JSON.parse(responseText.trim());
    res.json({
      contradictions: parsedJSON.contradictions || [],
    });
  } catch (error: any) {
    console.error("Gemini API server-side contradiction audit error:", error);
    res.status(500).json({ error: error.message || "Failed to audit ledger for contradictions." });
  }
});

export default router;
