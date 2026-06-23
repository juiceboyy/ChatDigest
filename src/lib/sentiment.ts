export const POSITIVE_WORDS = new Set([
  // English
  'agree', 'agreed', 'perfect', 'awesome', 'love', 'great', 'happy', 'thanks', 'thank', 'deal', 'excellent', 'good', 'correct', 'yes', 'absolutely', 'definitely', 'super', 'cool', 'nice', 'brilliant', 'sure', 'fine', 'completed', 'resolved', 'perfectly', 'done', 'approved', 'success', 'amazing', 'fantastic', 'wonderful', 'yay', 'glad', 'celebrate', 'congrats', 'congratulations', 'solved', 'helpful', 'indeed',
  // Dutch
  'eens', 'akkoord', 'perfect', 'geweldig', 'super', 'leuk', 'blij', 'bedankt', 'dank', 'dankje', 'dankjewel', 'top', 'goed', 'ja', 'zeker', 'absoluut', 'tof', 'mooi', 'prima', 'opgelost', 'gedaan', 'klaar', 'goedgekeurd', 'gelukt', 'fijn', 'klopt', 'mooie', 'goede', 'dankbaar', 'fijne', 'gefeliciteerd', 'oplossing', 'helpt', 'inderdaad'
]);

export const NEGATIVE_WORDS = new Set([
  // English
  'disagree', 'sad', 'wrong', 'fail', 'bad', 'unhappy', 'delay', 'cancel', 'unfortunately', 'error', 'issue', 'problem', 'wait', 'cannot', "can't", "don't", 'no', 'difficult', 'struggle', 'hard', 'concerned', 'concern', 'threat', 'danger', 'risk', 'disappointed', 'stuck', 'blocking', 'refuse', 'hate', 'annoyed', 'broken', 'failure', 'worst', 'poor', 'slow', 'frustrated', 'worry', 'worried', 'negative',
  // Dutch
  'oneens', 'jammer', 'slecht', 'fout', 'verkeerd', 'helaas', 'probleem', 'problemen', 'wachten', 'niet', 'geen', 'nee', 'moeilijk', 'lastig', 'risico', 'teleurgesteld', 'vast', 'blokkeert', 'vertraging', 'geannuleerd', 'foutmelding', 'mislukt', 'baal', 'balen', 'irritant', 'boos', 'verdrietig', 'fouten', 'traag', 'zorgen', 'negatief', 'hekel', 'kapot', 'falen'
]);

/**
 * Calculates a local heuristics sentiment score for a message
 */
export function calculateSentiment(text: string): { score: number; type: 'positive' | 'negative' | 'neutral' } {
  const words = text.toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/);
  let score = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) score += 0.3;
    if (NEGATIVE_WORDS.has(word)) score -= 0.3;
  }

  // Bound between -1 and 1
  score = Math.max(-1, Math.min(1, score));

  let type: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (score > 0.1) type = 'positive';
  else if (score < -0.1) type = 'negative';

  return { score, type };
}
