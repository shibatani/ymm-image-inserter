import type {
  ImageBlock,
  ImageGroup,
  MatchFailure,
  VoiceEntry,
} from "./types.ts";
import { normalizeSerif } from "./util.ts";

/**
 * Build composite key for matching: characterName::normalizedSerif
 */
function makeKey(characterName: string, serif: string): string {
  return `${characterName}::${normalizeSerif(serif)}`;
}

/**
 * Match CSV image groups to ymmp VoiceItems
 * Returns matched ImageBlocks and a list of failures
 */
export function matchEntries(
  groups: ImageGroup[],
  voiceItems: VoiceEntry[],
): { blocks: ImageBlock[]; failures: MatchFailure[] } {
  // Build a map of voice items keyed by character+serif
  // Each key may have multiple voice items (same character says same line multiple times)
  const voiceMap = new Map<string, VoiceEntry[]>();
  for (const vi of voiceItems) {
    const key = makeKey(vi.characterName, vi.serif);
    const existing = voiceMap.get(key);
    if (existing) {
      existing.push(vi);
    } else {
      voiceMap.set(key, [vi]);
    }
  }

  // Sort each group's candidates by Frame ascending
  for (const candidates of voiceMap.values()) {
    candidates.sort((a, b) => a.frame - b.frame);
  }

  // Track consumption index per key (CSV order = Frame ascending order)
  const consumedIndex = new Map<string, number>();

  const blocks: ImageBlock[] = [];
  const failures: MatchFailure[] = [];

  for (const group of groups) {
    const matchedVoiceItems: VoiceEntry[] = [];
    let groupFailed = false;

    for (const entry of group.entries) {
      const key = makeKey(entry.character, entry.serif);
      const candidates = voiceMap.get(key);

      if (!candidates || candidates.length === 0) {
        failures.push({
          imageId: group.imageId,
          serif: entry.serif,
          reason: "該当セリフなし",
        });
        groupFailed = true;
        break;
      }

      const idx = consumedIndex.get(key) ?? 0;
      if (idx >= candidates.length) {
        failures.push({
          imageId: group.imageId,
          serif: entry.serif,
          reason: `候補が既に消費済み（${candidates.length}件中${idx}件目を超過）`,
        });
        groupFailed = true;
        break;
      }

      const matched = candidates[idx]!;
      consumedIndex.set(key, idx + 1);
      matchedVoiceItems.push(matched);
    }

    if (groupFailed || matchedVoiceItems.length === 0) continue;

    // Sort matched voice items by frame
    matchedVoiceItems.sort((a, b) => a.frame - b.frame);

    const firstVoice = matchedVoiceItems[0]!;
    const lastVoice = matchedVoiceItems[matchedVoiceItems.length - 1]!;
    const frame = firstVoice.frame;
    const length = lastVoice.frame + lastVoice.length - frame;

    blocks.push({
      group,
      voiceItems: matchedVoiceItems,
      frame,
      length,
    });
  }

  return { blocks, failures };
}
