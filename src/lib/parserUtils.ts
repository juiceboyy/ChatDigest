// Standard English stop words to filter out for keyword extraction
export const STOP_WORDS = new Set([
  'the', 'a', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after', 'is', 'was', 'were', 'are', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'omitted', 'media', 'message', 'messages', 'chat', 'deleted', 'just', 'like', 'ok', 'okay', 'yeah', 'yes', 'no', 'not', 'so', 'then', 'there', 'here', 'when', 'whic', 'who', 'how', 'why', 'what', 'now', 'any', 'get', 'got', 'go', 'going', 'out', 'all', 'out', 'up', 'some', 'well', 'good'
]);

/**
 * Strips common emojis from string to clean up presentation
 */
export function stripEmojis(text: string): string {
  return text.replace(/[\u{1F600}-\u{1F6DF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
}

/**
 * Standardizes raw date strings we pull from regexes into a readable date format
 */
export function standardizeDateStr(rawDate: string): string {
  // Replace symbols like dots or dashes with forward slashes
  let sanitized = rawDate.replace(/[.\-]/g, '/');
  
  // Try to parse format 15/06/2026 or 06/15/2026
  const parts = sanitized.split('/');
  if (parts.length === 3) {
    let day = parts[0];
    let month = parts[1];
    let year = parts[2];

    // Handle year 2 digits
    if (year.length === 2) {
      year = '20' + year;
    }

    // Standardize to YYYY-MM-DD
    const yStr = year;
    const mStr = month.padStart(2, '0');
    const dStr = day.padStart(2, '0');

    // Return friendly form e.g. "Jun 15, 2026"
    try {
      const parsedDate = new Date(`${yStr}-${mStr}-${dStr}T00:00:00`);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    } catch {
      // fallback
    }
  }

  return rawDate; // Fallback to raw match
}
