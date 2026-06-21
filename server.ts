import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: {
    model: string;
    contents: any;
    config?: any;
  },
  retriesLeft = 2,
  delayMs = 500
): Promise<any> {
  const fallbackModels = [
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash"
  ];
  
  let currentModelIndex = fallbackModels.indexOf(params.model);
  if (currentModelIndex === -1) {
    currentModelIndex = 0;
  }

  for (let modelIdx = currentModelIndex; modelIdx < fallbackModels.length; modelIdx++) {
    const currentModelName = fallbackModels[modelIdx];
    const currentParams = { ...params, model: currentModelName };
    
    let attempt = 0;
    while (attempt <= retriesLeft) {
      try {
        console.log(`[Gemini Request] Invoking model ${currentModelName} (Attempt ${attempt + 1}/${retriesLeft + 1})`);
        const response = await ai.models.generateContent(currentParams);
        return response;
      } catch (error: any) {
        const rawMsg = error?.message || error?.toString() || "";
        const isTransient = rawMsg.includes("53") ||
                            rawMsg.includes("513") || 
                            rawMsg.includes("503") || 
                            rawMsg.includes("UNAVAILABLE") || 
                            rawMsg.includes("429") || 
                            rawMsg.includes("RESOURCE_EXHAUSTED") ||
                            rawMsg.includes("high demand") ||
                            rawMsg.includes("temporary");

        if (isTransient) {
          attempt++;
          if (attempt <= retriesLeft) {
            const waitTime = delayMs * Math.pow(2, attempt) + Math.random() * 150;
            console.log(`[Gemini Notify] Temporary high demand on ${currentModelName}. Checking again in ${Math.round(waitTime)}ms...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        console.log(`[Gemini Notify] Swapping active generation model from ${currentModelName} to next option.`);
        break; // Stop retrying this model and switch to the next fallback
      }
    }
  }

  throw new Error(`All generation engines in the fallback sequence are temporarily busy. Please try again shortly.`);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set body parser with high limit for large chat text
  app.use(express.json({ limit: "25mb" }));

  // API endpoints
  app.post("/api/digest", async (req, res) => {
    try {
      const { fileName, messages } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "No messages provided for parsing" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY environment variable is not configured on the server. Please add it to your UI/Secrets panel."
        });
      }

      // Initialize Gemini SDK with telemetry header
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      // Slice messages if extremely large to prevent too long wait times or payload issues
      const maxMsgs = 1200;
      const slicedMessages = messages.length > maxMsgs ? messages.slice(-maxMsgs) : messages;

      // Construct a clean representation of the chat logs for the LLM
      const conversationText = slicedMessages
        .map((m) => `[${m.dateStr} ${m.timeStr}] ${m.sender}: ${m.text}`)
        .join("\n");

      const todayObj = new Date();
      const todayStr = todayObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });

      const prompt = `Analyze this WhatsApp group chat conversation history and generate a high-quality analytical executive digest.

CRITICAL LOGICAL RULE & CONTEXT:
Today's date is: ${todayStr} (June 21, 2026).
Any date in the future (after ${todayStr}), such as June 27, 2026, HAS NOT HAPPENED YET. It is physically impossible for a chat conversation happening right now to contain a message sent in the future.
Therefore, any decision or action item parsed from this conversation MUST be dated ONLY with the exact date when the chat message was sent (the date in the brackets, e.g., '[June 15, 2026]').
NEVER use planned future event dates, target completion dates, or anniversary celebration dates (like 'June 27, 2026') as the decision's or action item's dateStr. The dateStr must represent the PAST or CURRENT date when the decision was agreed upon (which is <= ${todayStr}).

Here is the conversation text:
${conversationText}

Please analyze the discussions and output the result in structured JSON. Include:
1. "summary": A detailed, beautiful markdown-formatted executive summary (written in third-person, around 2-4 paragraphs). Use bold styling (**text**) or bullets for major focus points to make it read like custom-crafted engineering synthesis. Highlight key projects, consensus trends, or interesting group dynamics.
2. "executiveSummary": A highly polished, concise 2 to 3 sentence executive summary that answers 'what is the entire conversation about?' and states the core resolution or status cleanly in prose. Must be exactly 2-3 sentences.
3. "keywords": 5 to 10 key topic words / hashtags that define this chat thread.
4. "decisions": List the concrete consensus items, agreements, or signed-off choices made by members. Make sure to identify 'sender', 'text', and 'dateStr'.
   - MANDATORY DATE RULE: The 'dateStr' field MUST be the exact date when the message was sent (extracted strictly from the bracketed metadata at the start of the message, e.g., '[2026-06-20 ...]' becomes 'June 20, 2026'). Crucially, NEVER use dates of future events or anniversary celebration dates mentioned in the body of the message (e.g., if a message on June 20 discusses a party on June 27, the decision's dateStr must be June 20, 2026, NOT June 27, 2026). This date MUST always be on or before ${todayStr}.
5. "actionItems": List specific to-do tasks and assignments. Identify who is responsible ('sender'), what task was requested ('text'), and when it was defined ('dateStr').
   - MANDATORY DATE RULE: The 'dateStr' field MUST be the exact date when the message requesting the task was sent (extracted strictly from the bracketed metadata of the message). Never use event or plan dates discussed inside the message body. This date MUST always be on or before ${todayStr}.`;

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
                description: "Deep analytical executive summary in beautiful markdown. Put terms of note or project names in bold styling. 3 paragraphs minimum."
              },
              executiveSummary: {
                type: Type.STRING,
                description: "A highly polished, concise 2 to 3 sentence executive summary of the entire conversation. Exactly 2-3 sentences."
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
                    sender: { type: Type.STRING, description: "Name of the participant proposing, agreeing, or certifying the decision." },
                    text: { type: Type.STRING, description: "Detailed, concrete decision or agreement statement." },
                    dateStr: { 
                      type: Type.STRING, 
                      description: "The actual date when the chat message containing this consensus was sent (obtained ONLY from the bracketed metadata, e.g. '[2026-06-20...]'). ABSOLUTELY NEVER use future event dates mentioned relative to the text contents (like June 27, 2026). This must be <= " + todayStr
                    }
                  },
                  required: ["sender", "text", "dateStr"]
                }
              },
              actionItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sender: { type: Type.STRING, description: "Name of the person assigned or responsible. Defaults to 'The Group' if general." },
                    text: { type: Type.STRING, description: "Explicit task definition with execution detail." },
                    dateStr: { 
                      type: Type.STRING, 
                      description: "The actual date when the message containing this request was sent (obtained ONLY from the bracketed metadata, e.g. '[2026-06-20...]'). ABSOLUTELY NEVER use future event dates mentioned relative to the text contents (like June 27, 2026). This must be <= " + todayStr
                    }
                  },
                  required: ["sender", "text", "dateStr"]
                }
              }
            },
            required: ["summary", "executiveSummary", "keywords", "decisions", "actionItems"]
          }
        }
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
        actionItems: parsedJSON.actionItems
      });

    } catch (error: any) {
      console.error("Gemini API server-side parse error:", error);
      res.status(500).json({ error: error.message || "Failed to digest conversation using Gemini." });
    }
  });

  app.post("/api/parse-media", async (req, res) => {
    try {
      const { fileBase64, fileMimeType, fileName, chatSummary, userPrompt } = req.body;

      if (!fileBase64 || !fileMimeType) {
        return res.status(400).json({ error: "Missing required media file data" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY environment variable is not configured. Please supply it under Settings > Secrets."
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      // Prepare the inline media data block for multimodal input
      const mediaPart = {
        inlineData: {
          mimeType: fileMimeType,
          data: fileBase64
        }
      };

      const systemInstruction = `You are an expert AI multimodal media analyst for group chat conversations.
Analyze the provided media file (${fileName || "attached media"}) in the context of the chat thread.
We are providing a summary of the group chat conversation to give you context:
"${chatSummary || "No context chat summary available."}"

Your job is to parse this media file and extract:
1. "description": A highly detailed, professional, markdown-formatted executive summary explaining what this media file contains, what information it conveys, and how it fits into/relates to the chat group's themes. (2-3 paragraphs minimum).
2. "decisions": List any concrete agreements, approved designs, compromises, or signed-off choices explicitly stated, shown, or discussed inside this media file.
3. "actionItems": List specific to-do tasks, actions, assignments, or responsibilities mentioned, assigned, or shown in this media file (or transcripts thereof). Include who is responsible.`;

      const prompt = userPrompt || "Parse this media attachment and extract its description, key decisions, and action items.";

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: [mediaPart, prompt],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: {
                type: Type.STRING,
                description: "Deep, detailed multimodal asset summary in beautiful markdown. Put terms of note or project names in bold styling."
              },
              decisions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sender: { type: Type.STRING, description: "Name of the person proposing, agreeing, or certifying the decision." },
                    text: { type: Type.STRING, description: "Detailed, concrete decision, agreement, or consensus shown in the media." },
                    dateStr: { type: Type.STRING, description: "Today's date or date mentioned in media." }
                  },
                  required: ["sender", "text", "dateStr"]
                }
              },
              actionItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sender: { type: Type.STRING, description: "Name of the person assigned or responsible. Use 'The Group' if general." },
                    text: { type: Type.STRING, description: "Explicit task definition with execution detail." },
                    dateStr: { type: Type.STRING, description: "Today's date or date/deadline mentioned." }
                  },
                  required: ["sender", "text", "dateStr"]
                }
              }
            },
            required: ["description", "decisions", "actionItems"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response received from Gemini for media analysis.");
      }

      const parsedJSON = JSON.parse(responseText.trim());
      res.json({
        description: parsedJSON.description,
        decisions: parsedJSON.decisions,
        actionItems: parsedJSON.actionItems
      });

    } catch (error: any) {
      console.error("Gemini API media parse error:", error);
      res.status(500).json({ error: error.message || "Failed to parse media using Gemini." });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, decisions, chatHistory, userQuestion } = req.body;

      if (!messages || !Array.isArray(messages) || !userQuestion) {
        return res.status(400).json({ error: "Missing required fields for chat" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY environment variable is not configured. Please supply it under Settings > Secrets."
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const todayObj = new Date();
      const todayStr = todayObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });

      const maxMsgs = 1200;
      const slicedMessages = messages.length > maxMsgs ? messages.slice(-maxMsgs) : messages;

      const conversationText = slicedMessages
        .map((m) => `[${m.dateStr} ${m.timeStr}] ${m.sender}: ${m.text}`)
        .join("\n");

      const decisionsText = (decisions || [])
        .map((d: any) => `- [Made by: ${d.sender} on ${d.dateStr}] ${d.text}`)
        .join("\n");

      const systemInstruction = `You are an expert AI meeting analyst. You are discussing a group chat ledger that is actively being viewed in a dashboard.
Today is ${todayStr}. Any date in the future (after ${todayStr}), such as June 27, 2026, has not happened yet.
Crucially: If you see any committed key decision on the ledger dated in the future (e.g., June 27, 2026), please understand and point out to the user that this is an incorrectly attributed date (it represents the celebration or event date being planned, not the actual date when the decision was agreed upon). The actual decision was made in the past relative to ${todayStr} (e.g. around June 15, 2026 during the chat stream).
Help clarify this distinction gracefully if the user asks about dates!

Additionally, here is the official list of Key Decisions that have been committed/accepted to the team's decision ledger:
${decisionsText || "(No decisions are currently committed/accepted on the ledger)"}

Here is the group chat log context:
${conversationText}

Provide crisp, authoritative answers to the user's questions. You have access to both the raw chat messages and the official ledger of committed Decisions. Always quote specific contributors, decisions, or timestamps when answering, helping the user accurately trace discussions and verified consensus. Use formatting or lists where appropriate. Reply in clear, conversational English or Dutch if the user asks in Dutch.`;

      const contents = [];
      if (chatHistory && Array.isArray(chatHistory)) {
        for (const turn of chatHistory) {
          contents.push({
            role: turn.role,
            parts: [{ text: turn.text }]
          });
        }
      }
      contents.push({
        role: "user",
        parts: [{ text: userQuestion }]
      });

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
        }
      });

      res.json({ text: response.text || "I was unable to synthesize a response." });

    } catch (error: any) {
      console.error("Gemini API server-side chat error:", error);
      res.status(500).json({ error: error.message || "Failed to communicate with Gemini." });
    }
  });

  app.post("/api/check-contradictions", async (req, res) => {
    try {
      const { newDecisionText, existingDecisions } = req.body;

      if (!newDecisionText) {
        return res.status(400).json({ error: "Missing newDecisionText" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY environment variable is not configured. Please supply it under Settings > Secrets."
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const decisionsList = (existingDecisions || [])
        .map((d: any, index: number) => `Index: ${index} | ID: ${d.id} | Sender: ${d.sender} | Date: ${d.dateStr} | Statement: ${d.text}`)
        .join("\n");

      const systemInstruction = `You are a logical consistency and consensus auditing bot for project decisions and commitments.
Your job is to identify when a newly proposed decision contradicts existing decisions in a ledger.

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
                      description: "The ID of the existing contradictory decision on the ledger."
                    },
                    isMultiPart: {
                      type: Type.BOOLEAN,
                      description: "True if the existing decision consists of multiple distinct parts/clauses that can be split into singular commitments."
                    },
                    parts: {
                      type: Type.ARRAY,
                      description: "The list of singular commitments/parts of this decision.",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          partId: {
                            type: Type.STRING,
                            description: "A short unique key for this part (e.g. 'p0', 'p1')."
                          },
                          text: {
                            type: Type.STRING,
                            description: "The independent, polished, third-person singular commitment statement."
                          },
                          isContrary: {
                            type: Type.BOOLEAN,
                            description: "True if this specific broken-down single commitment directly opposes the new decision."
                          },
                          explanation: {
                            type: Type.STRING,
                            description: "A direct sentence explaining why this part is contrary (only if isContrary is true)."
                          }
                        },
                        required: ["partId", "text", "isContrary", "explanation"]
                      }
                    }
                  },
                  required: ["id", "isMultiPart", "parts"]
                }
              }
            },
            required: ["contradictions"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response received from contradiction auditing model.");
      }

      const parsedJSON = JSON.parse(responseText.trim());
      res.json({
        contradictions: parsedJSON.contradictions || []
      });

    } catch (error: any) {
      console.error("Gemini API server-side contradiction audit error:", error);
      res.status(500).json({ error: error.message || "Failed to audit ledger for contradictions." });
    }
  });

  app.post("/api/executive-summary", async (req, res) => {
    try {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "No messages provided for executive summary generation" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY environment variable is not configured on the server. Please define it under Settings > Secrets."
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const maxMsgs = 1200;
      const slicedMessages = messages.length > maxMsgs ? messages.slice(-maxMsgs) : messages;

      const conversationText = slicedMessages
        .map((m) => `[${m.dateStr} ${m.timeStr}] ${m.sender}: ${m.text}`)
        .join("\n");

      const systemInstruction = `You are a professional conversation analyst. 
Your task is to write a highly polished, coherent 2 to 3 sentence 'Executive Summary' of the entire conversation.
- Answer 'What is the entire chat log about?' and 'What were the key agreements or final resolutions?'
- Must be written in active, high-level prose, in third-person.
- Keep it strictly to exactly 2 or 3 sentences total.
- Do NOT use bullet points, markdown list syntax, or introductory meta-text like 'Based on the provided text...'. Just output the elegant plain-text prose directly.`;

      const prompt = `Here is the conversation text:\n${conversationText}\n\nGenerate the 2-3 sentence executive summary now.`;

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response received from executive summary synthesis model.");
      }

      res.json({
        executiveSummary: responseText.trim()
      });

    } catch (error: any) {
      console.error("Gemini API server-side executive summary error:", error);
      res.status(500).json({ error: error.message || "Failed to generate executive summary." });
    }
  });

  app.post("/api/playbook", async (req, res) => {
    try {
      const { decisions, actionItems } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY environment variable is not configured on the server. Please define it under Settings > Secrets."
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const decisionsText = (decisions || [])
        .map((d: any) => `- [${d.sender}] ${d.text}`)
        .join("\n");

      const actionsText = (actionItems || [])
        .map((a: any) => `- [${a.sender}] ${a.text} (Completed: ${a.completed ? "Yes" : "No"})`)
        .join("\n");

      const systemInstruction = `You are an expert strategic advisor, operations head, and agile systems architect.
Your job is to translate a list of key project decisions and action items into a highly actionable, structured, professional 'Operational Playbook' (runbook).

The playbook MUST be dynamic and directly inferred from the provided lists:
1. Synthesize an "overview" (a clear, 2-3 sentence strategic alignment summary and roadmap).
2. Generate 3 to 5 comprehensive operational "Plays" (e.g., split by categories like 'Technology & Stack', 'Schedules & Delivery', 'Roles & Alignment', or 'Testing & Operations' as relevant to the decisions).
3. For each Play, write:
   - A unique, descriptive 'title' (written with action verbs, e.g., 'Bootstrap Client Micro-frontend & Environment Config')
   - A distinct operability 'category'
   - A comprehensive 'description' explaining the logic, rationale, and background of this play based on the decisions.
   - A list of tactical 'steps' that need to be followed sequentially (minimum 3 steps)
   - A list of expert operational 'tips' or strategic advice (minimum 2 tips)

Output the results strictly in structured JSON. Ensure all content is cohesive, elegant, highly detailed, and tailored to the topic discussed. Do not use generic placeholders.`;

      const prompt = `Here are the active Decisions on the team ledger:
${decisionsText || "No decisions made yet."}

Here are the registered Action Items:
${actionsText || "No action items created yet."}

Generate the complete Operational Playbook now.`;

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overview: {
                type: Type.STRING,
                description: "A professional 2-3 sentence executive overview aligning the plays with the overall team's goals."
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
                      items: { type: Type.STRING }
                    },
                    tips: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    }
                  },
                  required: ["id", "title", "category", "description", "steps", "tips"]
                }
              }
            },
            required: ["overview", "plays"]
          }
        }
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
          plays: parsedJSON.plays
        }
      });

    } catch (error: any) {
      console.error("Gemini API server-side playbook error:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI Playbook." });
    }
  });

  // Enable Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
