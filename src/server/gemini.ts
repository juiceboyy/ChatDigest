import { GoogleGenAI } from "@google/genai";

/**
 * Creates a configured GoogleGenAI instance using the GEMINI_API_KEY env var.
 * Throws a descriptive error if the key is missing.
 */
export function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not configured on the server. Please add it to your UI/Secrets panel."
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

/**
 * Invokes Gemini content generation with automatic model fallback and retry
 * on transient errors (rate limits, service unavailability).
 */
export async function generateContentWithRetry(
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
    "gemini-2.5-flash",
    "gemini-1.5-flash",
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
        console.log(
          `[Gemini Request] Invoking model ${currentModelName} (Attempt ${attempt + 1}/${retriesLeft + 1})`
        );
        const response = await ai.models.generateContent(currentParams);
        return response;
      } catch (error: any) {
        const rawMsg = error?.message || error?.toString() || "";
        const isTransient =
          rawMsg.includes("53") ||
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
            console.log(
              `[Gemini Notify] Temporary high demand on ${currentModelName}. Checking again in ${Math.round(waitTime)}ms...`
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }
          // Exhausted retries for transient error: throw immediately to avoid Netlify function timeout
          throw error;
        }

        console.log(
          `[Gemini Notify] Swapping active generation model from ${currentModelName} to next option.`
        );
        break;
      }
    }
  }

  throw new Error(
    "All generation engines in the fallback sequence are temporarily busy. Please try again shortly."
  );
}
