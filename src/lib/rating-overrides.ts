/**
 * Local persistence for community rating overrides.
 * When a user votes, we recalculate the weighted average for the spot
 * and store it in localStorage so it survives modal close/reopen.
 */

const STORAGE_KEY = 'ezetu_spot_ratings_overrides';

export interface UserVote {
  overall: number;
  photogenic: number;
  tranquility: number;
  accessibility: number;
}

export interface SpotRatingOverride {
  rating: number;
  reviewsCount: number;
  photogenic: number;
  tranquility: number;
  accessibility: number;
  userVote: UserVote;
}

export type OverrideMap = Record<string, SpotRatingOverride>;

function readAll(): OverrideMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as OverrideMap;
  } catch {
    return {};
  }
}

function writeAll(map: OverrideMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage full or unavailable */
  }
}

export function getOverride(spotId: string): SpotRatingOverride | null {
  return readAll()[spotId] ?? null;
}

/**
 * Weighted average when the user votes for the first time.
 *   newCount = N + 1
 *   newAvg = (prevAvg * N + userVal) / newCount
 */
function calcNew(prevAvg: number, baseCount: number, userVal: number): number {
  const newCount = baseCount + 1;
  return Number((((prevAvg * baseCount) + userVal) / newCount).toFixed(1));
}

/**
 * Weighted average when the user edits a previous vote.
 *   newAvg = (prevAvg * count - oldVal + newVal) / count
 */
function calcEdit(prevAvg: number, count: number, oldVal: number, newVal: number): number {
  return Number((((prevAvg * count) - oldVal + newVal) / count).toFixed(1));
}

export interface SaveRatingInput {
  spotId: string;
  baseRating: number;
  baseCount: number;
  basePhotogenic: number;
  baseTranquility: number;
  baseAccessibility: number;
  overall: number;
  photogenic: number;
  tranquility: number;
  accessibility: number;
  isFirstVote: boolean;
}

export function saveRatingOverride(input: SaveRatingInput): SpotRatingOverride {
  const map = readAll();
  const existing = map[input.spotId];

  if (input.isFirstVote) {
    const N = input.baseCount;
    const override: SpotRatingOverride = {
      rating: calcNew(input.baseRating, N, input.overall),
      reviewsCount: N + 1,
      photogenic: calcNew(input.basePhotogenic, N, input.photogenic),
      tranquility: calcNew(input.baseTranquility, N, input.tranquility),
      accessibility: calcNew(input.baseAccessibility, N, input.accessibility),
      userVote: {
        overall: input.overall,
        photogenic: input.photogenic,
        tranquility: input.tranquility,
        accessibility: input.accessibility,
      },
    };
    map[input.spotId] = override;
    writeAll(map);
    return override;
  }

  // Editing — use existing override's count (not base) because the user's
  // vote is already baked into the stored averages.
  const count = existing?.reviewsCount ?? input.baseCount + 1;
  const prevRating = existing?.rating ?? input.baseRating;
  const prevPhotogenic = existing?.photogenic ?? input.basePhotogenic;
  const prevTranquility = existing?.tranquility ?? input.baseTranquility;
  const prevAccessibility = existing?.accessibility ?? input.baseAccessibility;
  const oldVote = existing?.userVote ?? {
    overall: input.overall,
    photogenic: input.photogenic,
    tranquility: input.tranquility,
    accessibility: input.accessibility,
  };

  const override: SpotRatingOverride = {
    rating: calcEdit(prevRating, count, oldVote.overall, input.overall),
    reviewsCount: count,
    photogenic: calcEdit(prevPhotogenic, count, oldVote.photogenic, input.photogenic),
    tranquility: calcEdit(prevTranquility, count, oldVote.tranquility, input.tranquility),
    accessibility: calcEdit(prevAccessibility, count, oldVote.accessibility, input.accessibility),
    userVote: {
      overall: input.overall,
      photogenic: input.photogenic,
      tranquility: input.tranquility,
      accessibility: input.accessibility,
    },
  };
  map[input.spotId] = override;
  writeAll(map);
  return override;
}
