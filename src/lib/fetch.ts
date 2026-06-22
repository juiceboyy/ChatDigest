/**
 * Performs a fetch request with automatic retries for transient errors (429, 502, 503, 504).
 */
export const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries = 2,
  delay = 1000
): Promise<Response> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      const isTransient = [429, 502, 503, 504].includes(response.status);
      if (!isTransient || attempt === maxRetries) return response;
    } catch (err) {
      if (attempt === maxRetries) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, attempt)));
  }
  throw new Error("Request failed after retries");
};
