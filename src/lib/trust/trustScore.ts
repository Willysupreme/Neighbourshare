/**
 * MVP trust score algorithm.
 *
 * score = weighted average of review ratings, nudged by verification and
 * transaction history. This is intentionally simple - see
 * Technical_Debt_Plan.pdf item NS-TD-02 for a discussion of its limitations
 * (no weighting by reviewer reputation, no recency decay, no fraud/collusion
 * detection) and the proposed future weighted-reputation model.
 */
export interface TrustScoreInput {
  ratings: number[]; // each 1-5
  isVerified: boolean;
  completedTransactions: number;
}

export function calculateTrustScore(input: TrustScoreInput): number {
  const { ratings, isVerified, completedTransactions } = input;

  if (ratings.length === 0) {
    // New/unrated users start at a neutral baseline, slightly higher if verified.
    return isVerified ? 3.5 : 3.0;
  }

  const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;

  let score = average;
  if (isVerified) score += 0.15;
  score += Math.min(completedTransactions, 20) * 0.01; // small experience bonus, capped

  return Math.max(0, Math.min(5, Number(score.toFixed(2))));
}
