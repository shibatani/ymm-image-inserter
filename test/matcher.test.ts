import { describe, expect, test } from "bun:test";
import { matchEntries } from "../src/matcher.ts";
import type { ImageGroup, VoiceEntry } from "../src/types.ts";

function makeGroup(
  imageId: string,
  entries: Array<{ character: string; serif: string }>,
  imageType: "AI" | "実写" | "図解" = "AI",
): ImageGroup {
  return {
    imageId,
    description: "test image",
    imageType,
    referenceUrl: "",
    aiPrompt: "test prompt",
    entries: entries.map((e) => ({
      ...e,
      imageId,
      description: "test image",
      imageType,
      referenceUrl: "",
      aiPrompt: "test prompt",
    })),
  };
}

function makeVoice(
  characterName: string,
  serif: string,
  frame: number,
  length: number,
): VoiceEntry {
  return { characterName, serif, frame, length };
}

describe("matchEntries", () => {
  test("basic single-entry match", () => {
    const groups = [makeGroup("img_001", [{ character: "魔理沙", serif: "こんにちは" }])];
    const voices = [makeVoice("魔理沙", "こんにちは", 100, 200)];

    const { blocks, failures } = matchEntries(groups, voices);
    expect(blocks).toHaveLength(1);
    expect(failures).toHaveLength(0);
    expect(blocks[0]!.frame).toBe(100);
    expect(blocks[0]!.length).toBe(200);
  });

  test("multi-entry group matches multiple voice items", () => {
    const groups = [
      makeGroup("img_001", [
        { character: "魔理沙", serif: "最初のセリフ" },
        { character: "魔理沙", serif: "二番目のセリフ" },
      ]),
    ];
    const voices = [
      makeVoice("魔理沙", "最初のセリフ", 100, 200),
      makeVoice("魔理沙", "二番目のセリフ", 300, 180),
    ];

    const { blocks, failures } = matchEntries(groups, voices);
    expect(blocks).toHaveLength(1);
    expect(failures).toHaveLength(0);
    expect(blocks[0]!.frame).toBe(100);
    expect(blocks[0]!.length).toBe(380); // 300 + 180 - 100
  });

  test("normalization handles newlines in voice serif", () => {
    const groups = [
      makeGroup("img_001", [
        { character: "魔理沙", serif: "突然だけど霊夢福岡で一番" },
      ]),
    ];
    const voices = [
      makeVoice("魔理沙", "突然だけど霊夢、\n福岡で一番", 100, 200),
    ];

    const { blocks, failures } = matchEntries(groups, voices);
    // After normalization: both become "突然だけど霊夢、福岡で一番" vs "突然だけど霊夢福岡で一番"
    // These won't match because the comma is still present in the voice version
    // This tests exact normalization behavior
    expect(blocks).toHaveLength(0);
    expect(failures).toHaveLength(1);
  });

  test("normalization matches when both normalize identically", () => {
    const groups = [
      makeGroup("img_001", [
        { character: "魔理沙", serif: "突然だけど霊夢、福岡で一番" },
      ]),
    ];
    const voices = [
      makeVoice("魔理沙", "突然だけど霊夢、\n福岡で一番", 100, 200),
    ];

    const { blocks, failures } = matchEntries(groups, voices);
    expect(blocks).toHaveLength(1);
    expect(failures).toHaveLength(0);
  });

  test("no match reports failure", () => {
    const groups = [
      makeGroup("img_001", [{ character: "魔理沙", serif: "存在しないセリフ" }]),
    ];
    const voices = [makeVoice("魔理沙", "違うセリフ", 100, 200)];

    const { blocks, failures } = matchEntries(groups, voices);
    expect(blocks).toHaveLength(0);
    expect(failures).toHaveLength(1);
    expect(failures[0]!.reason).toBe("該当セリフなし");
  });

  test("character name must match", () => {
    const groups = [
      makeGroup("img_001", [{ character: "霊夢", serif: "こんにちは" }]),
    ];
    const voices = [makeVoice("魔理沙", "こんにちは", 100, 200)];

    const { blocks, failures } = matchEntries(groups, voices);
    expect(blocks).toHaveLength(0);
    expect(failures).toHaveLength(1);
  });

  test("same serif by same character consumed in order", () => {
    const groups = [
      makeGroup("img_001", [{ character: "魔理沙", serif: "そうだね" }]),
      makeGroup("img_002", [{ character: "魔理沙", serif: "そうだね" }]),
    ];
    const voices = [
      makeVoice("魔理沙", "そうだね", 100, 50),
      makeVoice("魔理沙", "そうだね", 500, 50),
    ];

    const { blocks, failures } = matchEntries(groups, voices);
    expect(blocks).toHaveLength(2);
    expect(failures).toHaveLength(0);
    expect(blocks[0]!.frame).toBe(100);
    expect(blocks[1]!.frame).toBe(500);
  });

  test("excess consumption reports failure", () => {
    const groups = [
      makeGroup("img_001", [{ character: "魔理沙", serif: "一度きり" }]),
      makeGroup("img_002", [{ character: "魔理沙", serif: "一度きり" }]),
    ];
    const voices = [makeVoice("魔理沙", "一度きり", 100, 50)];

    const { blocks, failures } = matchEntries(groups, voices);
    expect(blocks).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });
});
