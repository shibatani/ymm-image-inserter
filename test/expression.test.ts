import { describe, it, expect } from "bun:test";
import { applyExpressions } from "../src/expression.ts";
import { EXPRESSION_MAP, type MotionDef } from "../src/constants.ts";
import type { ImageEntry, VoiceEntry, YmmpItem } from "../src/types.ts";

function makeVoiceItem(characterName: string, serif: string, frame: number): YmmpItem {
  return {
    $type: "YukkuriMovieMaker.Project.Items.VoiceItem, YukkuriMovieMaker",
    CharacterName: characterName,
    Serif: serif,
    Frame: frame,
    Length: 100,
    Layer: 1,
    TachieFaceParameter: {
      $type: "YukkuriMovieMaker.Plugin.Tachie.AnimationTachie.FaceParameter, YukkuriMovieMaker.Plugin.Tachie.AnimationTachie",
      Eyebrow: `C:\\動画作成\\立ち絵\\まりさ\\眉\\00.png`,
      Eye: `C:\\動画作成\\立ち絵\\まりさ\\目\\00.png`,
      Mouth: `C:\\動画作成\\立ち絵\\まりさ\\口\\00.png`,
      Hair: `C:\\動画作成\\立ち絵\\まりさ\\髪\\00.png`,
      Body: null,
    },
  } as YmmpItem;
}

function makeReimuVoiceItem(serif: string, frame: number): YmmpItem {
  return {
    $type: "YukkuriMovieMaker.Project.Items.VoiceItem, YukkuriMovieMaker",
    CharacterName: "ゆっくり霊夢",
    Serif: serif,
    Frame: frame,
    Length: 100,
    Layer: 2,
    TachieFaceParameter: {
      $type: "YukkuriMovieMaker.Plugin.Tachie.AnimationTachie.FaceParameter, YukkuriMovieMaker.Plugin.Tachie.AnimationTachie",
      Eyebrow: `C:\\動画作成\\立ち絵\\れいむ\\眉\\00.png`,
      Eye: `C:\\動画作成\\立ち絵\\れいむ\\目\\00.png`,
      Mouth: `C:\\動画作成\\立ち絵\\れいむ\\口\\00.png`,
      Hair: `C:\\動画作成\\立ち絵\\れいむ\\髪\\00.png`,
      Body: `C:\\動画作成\\立ち絵\\れいむ\\体\\00.png`,
    },
  } as YmmpItem;
}

function makeEntry(character: string, serif: string, expression?: string): ImageEntry {
  return {
    character,
    serif,
    imageId: "",
    description: "",
    imageType: "AI",
    referenceUrl: "",
    aiPrompt: "",
    ...(expression && { expression }),
  };
}

function makeVoiceEntry(characterName: string, serif: string, frame: number): VoiceEntry {
  return { characterName, serif, frame, length: 100 };
}

// --- Expression mapping tests ---

describe("EXPRESSION_MAP", () => {
  it("should have all 6 non-default expressions", () => {
    expect(Object.keys(EXPRESSION_MAP)).toEqual([
      "焦り", "にやり", "驚き", "悲しみ", "泣く", "怒り",
    ]);
  });

  it("焦り should have null eyebrow", () => {
    expect(EXPRESSION_MAP["焦り"]!.eyebrow).toBeNull();
  });

  it("all expressions should have eye and mouth defined", () => {
    for (const [name, def] of Object.entries(EXPRESSION_MAP)) {
      expect(def.eye).toBeTruthy();
      expect(def.mouth).toBeTruthy();
    }
  });
});

// --- Expression application tests ---

describe("applyExpressions", () => {
  it("should apply expression to matching VoiceItem", () => {
    const entries = [
      makeEntry("ゆっくり魔理沙", "テストセリフ", "にやり"),
    ];
    const voiceEntries = [
      makeVoiceEntry("ゆっくり魔理沙", "テストセリフ", 0),
    ];
    const ymmpItems = [
      makeVoiceItem("ゆっくり魔理沙", "テストセリフ", 0),
    ];

    const result = applyExpressions(entries, voiceEntries, ymmpItems, false);

    expect(result.applied.length).toBe(1);
    expect(result.applied[0]!.expression).toBe("にやり");

    const face = ymmpItems[0]!.TachieFaceParameter as Record<string, unknown>;
    expect(face.Eye).toBe("C:\\動画作成\\立ち絵\\まりさ\\目\\01.png");
    expect(face.Mouth).toBe("C:\\動画作成\\立ち絵\\まりさ\\口\\06.png");
    expect(face.Eyebrow).toBe("C:\\動画作成\\立ち絵\\まりさ\\眉\\00.png");
    // Hair should be untouched
    expect(face.Hair).toBe("C:\\動画作成\\立ち絵\\まりさ\\髪\\00.png");
  });

  it("should set eyebrow to null for 焦り", () => {
    const entries = [
      makeEntry("ゆっくり霊夢", "びっくり", "焦り"),
    ];
    const voiceEntries = [
      makeVoiceEntry("ゆっくり霊夢", "びっくり", 100),
    ];
    const ymmpItems = [
      makeReimuVoiceItem("びっくり", 100),
    ];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    const face = ymmpItems[0]!.TachieFaceParameter as Record<string, unknown>;
    expect(face.Eyebrow).toBeNull();
    expect(face.Eye).toBe("C:\\動画作成\\立ち絵\\れいむ\\目\\06.png");
    expect(face.Mouth).toBe("C:\\動画作成\\立ち絵\\れいむ\\口\\13.png");
    // Body should be untouched
    expect(face.Body).toBe("C:\\動画作成\\立ち絵\\れいむ\\体\\00.png");
  });

  it("should not modify VoiceItem when expression is empty", () => {
    const entries = [
      makeEntry("ゆっくり魔理沙", "普通のセリフ"),
    ];
    const voiceEntries = [
      makeVoiceEntry("ゆっくり魔理沙", "普通のセリフ", 0),
    ];
    const ymmpItems = [
      makeVoiceItem("ゆっくり魔理沙", "普通のセリフ", 0),
    ];

    const result = applyExpressions(entries, voiceEntries, ymmpItems, false);

    expect(result.applied.length).toBe(0);
    expect(result.skipped).toBe(1);

    const face = ymmpItems[0]!.TachieFaceParameter as Record<string, unknown>;
    expect(face.Eye).toBe("C:\\動画作成\\立ち絵\\まりさ\\目\\00.png");
  });

  it("should not modify anything when no entries have expressions", () => {
    const entries = [
      makeEntry("ゆっくり魔理沙", "セリフ1"),
      makeEntry("ゆっくり霊夢", "セリフ2"),
    ];
    const voiceEntries = [
      makeVoiceEntry("ゆっくり魔理沙", "セリフ1", 0),
      makeVoiceEntry("ゆっくり霊夢", "セリフ2", 100),
    ];
    const ymmpItems = [
      makeVoiceItem("ゆっくり魔理沙", "セリフ1", 0),
      makeReimuVoiceItem("セリフ2", 100),
    ];

    const result = applyExpressions(entries, voiceEntries, ymmpItems, false);

    expect(result.applied.length).toBe(0);
    expect(result.skipped).toBe(2);
  });

  it("should report unknown expression names", () => {
    const entries = [
      makeEntry("ゆっくり魔理沙", "セリフ", "ドヤ顔"),
    ];
    const voiceEntries = [
      makeVoiceEntry("ゆっくり魔理沙", "セリフ", 0),
    ];
    const ymmpItems = [
      makeVoiceItem("ゆっくり魔理沙", "セリフ", 0),
    ];

    const result = applyExpressions(entries, voiceEntries, ymmpItems, false);

    expect(result.unknownExpressions).toEqual(["ドヤ顔"]);
    expect(result.applied.length).toBe(0);
  });

  it("should not modify ymmp items in dry-run mode", () => {
    const entries = [
      makeEntry("ゆっくり魔理沙", "テスト", "驚き"),
    ];
    const voiceEntries = [
      makeVoiceEntry("ゆっくり魔理沙", "テスト", 0),
    ];
    const ymmpItems = [
      makeVoiceItem("ゆっくり魔理沙", "テスト", 0),
    ];

    const result = applyExpressions(entries, voiceEntries, ymmpItems, true);

    expect(result.applied.length).toBe(1);
    // ymmp should NOT be modified
    const face = ymmpItems[0]!.TachieFaceParameter as Record<string, unknown>;
    expect(face.Eye).toBe("C:\\動画作成\\立ち絵\\まりさ\\目\\00.png");
  });

  it("should handle multiple entries with mixed expressions", () => {
    const entries = [
      makeEntry("ゆっくり魔理沙", "普通", undefined),
      makeEntry("ゆっくり霊夢", "びっくり", "驚き"),
      makeEntry("ゆっくり魔理沙", "にやっ", "にやり"),
      makeEntry("ゆっくり霊夢", "かなしい", "悲しみ"),
    ];
    const voiceEntries = [
      makeVoiceEntry("ゆっくり魔理沙", "普通", 0),
      makeVoiceEntry("ゆっくり霊夢", "びっくり", 100),
      makeVoiceEntry("ゆっくり魔理沙", "にやっ", 200),
      makeVoiceEntry("ゆっくり霊夢", "かなしい", 300),
    ];
    const ymmpItems = [
      makeVoiceItem("ゆっくり魔理沙", "普通", 0),
      makeReimuVoiceItem("びっくり", 100),
      makeVoiceItem("ゆっくり魔理沙", "にやっ", 200),
      makeReimuVoiceItem("かなしい", 300),
    ];

    const result = applyExpressions(entries, voiceEntries, ymmpItems, false);

    expect(result.applied.length).toBe(3);
    expect(result.skipped).toBe(1);

    // First item should be unchanged
    const face0 = ymmpItems[0]!.TachieFaceParameter as Record<string, unknown>;
    expect(face0.Eye).toBe("C:\\動画作成\\立ち絵\\まりさ\\目\\00.png");

    // Second item should have 驚き
    const face1 = ymmpItems[1]!.TachieFaceParameter as Record<string, unknown>;
    expect(face1.Eye).toBe("C:\\動画作成\\立ち絵\\れいむ\\目\\05.png");
    expect(face1.Mouth).toBe("C:\\動画作成\\立ち絵\\れいむ\\口\\11.png");

    // Third item should have にやり
    const face2 = ymmpItems[2]!.TachieFaceParameter as Record<string, unknown>;
    expect(face2.Eye).toBe("C:\\動画作成\\立ち絵\\まりさ\\目\\01.png");

    // Fourth item should have 悲しみ
    const face3 = ymmpItems[3]!.TachieFaceParameter as Record<string, unknown>;
    expect(face3.Eyebrow).toBe("C:\\動画作成\\立ち絵\\れいむ\\眉\\03.png");
    expect(face3.Eye).toBe("C:\\動画作成\\立ち絵\\れいむ\\目\\02.png");
    expect(face3.Mouth).toBe("C:\\動画作成\\立ち絵\\れいむ\\口\\01.png");
  });

  it("should handle same serif with different expressions in order", () => {
    const entries = [
      makeEntry("ゆっくり霊夢", "えっ", "驚き"),
      makeEntry("ゆっくり霊夢", "えっ", "焦り"),
    ];
    const voiceEntries = [
      makeVoiceEntry("ゆっくり霊夢", "えっ", 0),
      makeVoiceEntry("ゆっくり霊夢", "えっ", 200),
    ];
    const ymmpItems = [
      makeReimuVoiceItem("えっ", 0),
      makeReimuVoiceItem("えっ", 200),
    ];

    const result = applyExpressions(entries, voiceEntries, ymmpItems, false);

    expect(result.applied.length).toBe(2);

    // First should be 驚き
    const face0 = ymmpItems[0]!.TachieFaceParameter as Record<string, unknown>;
    expect(face0.Eye).toBe("C:\\動画作成\\立ち絵\\れいむ\\目\\05.png");

    // Second should be 焦り
    const face1 = ymmpItems[1]!.TachieFaceParameter as Record<string, unknown>;
    expect(face1.Eyebrow).toBeNull();
    expect(face1.Eye).toBe("C:\\動画作成\\立ち絵\\れいむ\\目\\06.png");
  });

  it("should skip VoiceItem without TachieFaceParameter", () => {
    const entries = [
      makeEntry("ゆっくり魔理沙", "テスト", "にやり"),
    ];
    const voiceEntries = [
      makeVoiceEntry("ゆっくり魔理沙", "テスト", 0),
    ];
    const ymmpItems: YmmpItem[] = [{
      $type: "YukkuriMovieMaker.Project.Items.VoiceItem, YukkuriMovieMaker",
      CharacterName: "ゆっくり魔理沙",
      Serif: "テスト",
      Frame: 0,
      Length: 100,
      Layer: 1,
      // No TachieFaceParameter
    } as YmmpItem];

    const result = applyExpressions(entries, voiceEntries, ymmpItems, false);
    expect(result.applied.length).toBe(1);
    // Should not throw
  });

  it("should report unmatched entries with expressions", () => {
    const entries = [
      makeEntry("ゆっくり魔理沙", "存在しないセリフ", "驚き"),
    ];
    const voiceEntries: VoiceEntry[] = [];
    const ymmpItems: YmmpItem[] = [];

    const result = applyExpressions(entries, voiceEntries, ymmpItems, false);
    expect(result.unmatched.length).toBe(1);
    expect(result.unmatched[0]!.expression).toBe("驚き");
  });
});

// --- EXPRESSION_MAP motion definition tests ---

describe("EXPRESSION_MAP motion definitions", () => {
  it("全6表情にmotionが定義されている", () => {
    for (const [name, def] of Object.entries(EXPRESSION_MAP)) {
      expect(def.motion).not.toBeNull();
      expect(def.motion!.motionType).toBeTruthy();
    }
  });

  it("焦り → QuakeSmall (speed=100, pos=10)", () => {
    const m = EXPRESSION_MAP["焦り"]!.motion!;
    expect(m.motionType).toBe("QuakeSmall");
    expect(m.speed).toBe(100);
    expect(m.positionCorrection).toBe(10);
  });

  it("にやり → FunSmall (speed=50, pos=10)", () => {
    const m = EXPRESSION_MAP["にやり"]!.motion!;
    expect(m.motionType).toBe("FunSmall");
    expect(m.speed).toBe(50);
    expect(m.positionCorrection).toBe(10);
  });

  it("驚き → JumpSmall01 (speed=100, pos=10)", () => {
    const m = EXPRESSION_MAP["驚き"]!.motion!;
    expect(m.motionType).toBe("JumpSmall01");
    expect(m.speed).toBe(100);
    expect(m.positionCorrection).toBe(10);
  });

  it("悲しみ → BreathSmall (speed=100, pos=100)", () => {
    const m = EXPRESSION_MAP["悲しみ"]!.motion!;
    expect(m.motionType).toBe("BreathSmall");
    expect(m.speed).toBe(100);
    expect(m.positionCorrection).toBe(100);
  });

  it("泣く → QuakeSmall (speed=100, pos=10)", () => {
    const m = EXPRESSION_MAP["泣く"]!.motion!;
    expect(m.motionType).toBe("QuakeSmall");
    expect(m.speed).toBe(100);
    expect(m.positionCorrection).toBe(10);
  });

  it("怒り → JumpSmallLoop (speed=50, pos=10)", () => {
    const m = EXPRESSION_MAP["怒り"]!.motion!;
    expect(m.motionType).toBe("JumpSmallLoop");
    expect(m.speed).toBe(50);
    expect(m.positionCorrection).toBe(10);
  });
});

// --- TachieFaceEffects application tests ---

describe("applyExpressions - TachieFaceEffects (モーションエフェクト)", () => {
  it("表情適用時にTachieFaceEffectsにCharactorMotionEffectが設定される", () => {
    const entries = [makeEntry("ゆっくり魔理沙", "テスト", "にやり")];
    const voiceEntries = [makeVoiceEntry("ゆっくり魔理沙", "テスト", 0)];
    const ymmpItems = [makeVoiceItem("ゆっくり魔理沙", "テスト", 0)];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    const effects = ymmpItems[0]!.TachieFaceEffects as unknown[];
    expect(effects).toBeDefined();
    expect(effects).toHaveLength(1);
  });

  it("CharactorMotionEffectの$typeが正しい", () => {
    const entries = [makeEntry("ゆっくり魔理沙", "テスト", "驚き")];
    const voiceEntries = [makeVoiceEntry("ゆっくり魔理沙", "テスト", 0)];
    const ymmpItems = [makeVoiceItem("ゆっくり魔理沙", "テスト", 0)];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    const effect = (ymmpItems[0]!.TachieFaceEffects as Record<string, unknown>[])[0]!;
    expect(effect.$type).toBe("CharactorMotion.CharactorMotionEffect, CharactorMotion");
  });

  it("にやり → FunSmall のMotionTypeとパラメータが正しい", () => {
    const entries = [makeEntry("ゆっくり魔理沙", "テスト", "にやり")];
    const voiceEntries = [makeVoiceEntry("ゆっくり魔理沙", "テスト", 0)];
    const ymmpItems = [makeVoiceItem("ゆっくり魔理沙", "テスト", 0)];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    const effect = (ymmpItems[0]!.TachieFaceEffects as Record<string, unknown>[])[0]!;
    expect(effect.MotionType).toBe("FunSmall");
    expect(effect.Speed).toBe(50);
    expect(effect.PositionCorrection).toBe(10);
  });

  it("焦り → QuakeSmall のMotionTypeとパラメータが正しい", () => {
    const entries = [makeEntry("ゆっくり霊夢", "テスト", "焦り")];
    const voiceEntries = [makeVoiceEntry("ゆっくり霊夢", "テスト", 100)];
    const ymmpItems = [makeReimuVoiceItem("テスト", 100)];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    const effect = (ymmpItems[0]!.TachieFaceEffects as Record<string, unknown>[])[0]!;
    expect(effect.MotionType).toBe("QuakeSmall");
    expect(effect.Speed).toBe(100);
    expect(effect.PositionCorrection).toBe(10);
  });

  it("驚き → JumpSmall01 のMotionTypeとパラメータが正しい", () => {
    const entries = [makeEntry("ゆっくり霊夢", "テスト", "驚き")];
    const voiceEntries = [makeVoiceEntry("ゆっくり霊夢", "テスト", 100)];
    const ymmpItems = [makeReimuVoiceItem("テスト", 100)];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    const effect = (ymmpItems[0]!.TachieFaceEffects as Record<string, unknown>[])[0]!;
    expect(effect.MotionType).toBe("JumpSmall01");
    expect(effect.Speed).toBe(100);
    expect(effect.PositionCorrection).toBe(10);
  });

  it("悲しみ → BreathSmall のPositionCorrectionが100", () => {
    const entries = [makeEntry("ゆっくり霊夢", "テスト", "悲しみ")];
    const voiceEntries = [makeVoiceEntry("ゆっくり霊夢", "テスト", 100)];
    const ymmpItems = [makeReimuVoiceItem("テスト", 100)];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    const effect = (ymmpItems[0]!.TachieFaceEffects as Record<string, unknown>[])[0]!;
    expect(effect.MotionType).toBe("BreathSmall");
    expect(effect.PositionCorrection).toBe(100);
  });

  it("泣く → QuakeSmall", () => {
    const entries = [makeEntry("ゆっくり霊夢", "テスト", "泣く")];
    const voiceEntries = [makeVoiceEntry("ゆっくり霊夢", "テスト", 100)];
    const ymmpItems = [makeReimuVoiceItem("テスト", 100)];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    const effect = (ymmpItems[0]!.TachieFaceEffects as Record<string, unknown>[])[0]!;
    expect(effect.MotionType).toBe("QuakeSmall");
  });

  it("怒り → JumpSmallLoop (speed=50)", () => {
    const entries = [makeEntry("ゆっくり魔理沙", "テスト", "怒り")];
    const voiceEntries = [makeVoiceEntry("ゆっくり魔理沙", "テスト", 0)];
    const ymmpItems = [makeVoiceItem("ゆっくり魔理沙", "テスト", 0)];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    const effect = (ymmpItems[0]!.TachieFaceEffects as Record<string, unknown>[])[0]!;
    expect(effect.MotionType).toBe("JumpSmallLoop");
    expect(effect.Speed).toBe(50);
  });

  it("共通パラメータ（Loop, Interval, IsEnabled等）が正しく設定される", () => {
    const entries = [makeEntry("ゆっくり魔理沙", "テスト", "にやり")];
    const voiceEntries = [makeVoiceEntry("ゆっくり魔理沙", "テスト", 0)];
    const ymmpItems = [makeVoiceItem("ゆっくり魔理沙", "テスト", 0)];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    const effect = (ymmpItems[0]!.TachieFaceEffects as Record<string, unknown>[])[0]!;
    expect(effect.StartNaturally).toBe(true);
    expect(effect.EndNaturally).toBe(true);
    expect(effect.Loop).toBe(true);
    expect(effect.Interval).toBe(0.5);
    expect(effect.Invert).toBe(false);
    expect(effect.ZoomCorrection).toBe(100);
    expect(effect.RotationCorrection).toBe(100);
    expect(effect.IsEnabled).toBe(true);
    expect(effect.Remark).toBe("");
  });

  it("表情なし（通常）の場合はTachieFaceEffectsが設定されない", () => {
    const entries = [makeEntry("ゆっくり魔理沙", "普通のセリフ")];
    const voiceEntries = [makeVoiceEntry("ゆっくり魔理沙", "普通のセリフ", 0)];
    const ymmpItems = [makeVoiceItem("ゆっくり魔理沙", "普通のセリフ", 0)];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    expect(ymmpItems[0]!.TachieFaceEffects).toBeUndefined();
  });

  it("dry-runモードではTachieFaceEffectsが設定されない", () => {
    const entries = [makeEntry("ゆっくり魔理沙", "テスト", "驚き")];
    const voiceEntries = [makeVoiceEntry("ゆっくり魔理沙", "テスト", 0)];
    const ymmpItems = [makeVoiceItem("ゆっくり魔理沙", "テスト", 0)];

    applyExpressions(entries, voiceEntries, ymmpItems, true);

    expect(ymmpItems[0]!.TachieFaceEffects).toBeUndefined();
  });

  it("未知の表情名の場合はTachieFaceEffectsが設定されない", () => {
    const entries = [makeEntry("ゆっくり魔理沙", "テスト", "ドヤ顔")];
    const voiceEntries = [makeVoiceEntry("ゆっくり魔理沙", "テスト", 0)];
    const ymmpItems = [makeVoiceItem("ゆっくり魔理沙", "テスト", 0)];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    expect(ymmpItems[0]!.TachieFaceEffects).toBeUndefined();
  });

  it("複数セリフで異なる表情の場合、各VoiceItemに正しいモーションが設定される", () => {
    const entries = [
      makeEntry("ゆっくり霊夢", "びっくり", "驚き"),
      makeEntry("ゆっくり魔理沙", "にやっ", "にやり"),
      makeEntry("ゆっくり霊夢", "かなしい", "悲しみ"),
      makeEntry("ゆっくり魔理沙", "おこ", "怒り"),
    ];
    const voiceEntries = [
      makeVoiceEntry("ゆっくり霊夢", "びっくり", 0),
      makeVoiceEntry("ゆっくり魔理沙", "にやっ", 100),
      makeVoiceEntry("ゆっくり霊夢", "かなしい", 200),
      makeVoiceEntry("ゆっくり魔理沙", "おこ", 300),
    ];
    const ymmpItems = [
      makeReimuVoiceItem("びっくり", 0),
      makeVoiceItem("ゆっくり魔理沙", "にやっ", 100),
      makeReimuVoiceItem("かなしい", 200),
      makeVoiceItem("ゆっくり魔理沙", "おこ", 300),
    ];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    const e0 = (ymmpItems[0]!.TachieFaceEffects as Record<string, unknown>[])[0]!;
    expect(e0.MotionType).toBe("JumpSmall01");

    const e1 = (ymmpItems[1]!.TachieFaceEffects as Record<string, unknown>[])[0]!;
    expect(e1.MotionType).toBe("FunSmall");

    const e2 = (ymmpItems[2]!.TachieFaceEffects as Record<string, unknown>[])[0]!;
    expect(e2.MotionType).toBe("BreathSmall");

    const e3 = (ymmpItems[3]!.TachieFaceEffects as Record<string, unknown>[])[0]!;
    expect(e3.MotionType).toBe("JumpSmallLoop");
  });

  it("同じセリフで異なる表情の場合、順序通りにモーションが適用される", () => {
    const entries = [
      makeEntry("ゆっくり霊夢", "えっ", "驚き"),
      makeEntry("ゆっくり霊夢", "えっ", "焦り"),
    ];
    const voiceEntries = [
      makeVoiceEntry("ゆっくり霊夢", "えっ", 0),
      makeVoiceEntry("ゆっくり霊夢", "えっ", 200),
    ];
    const ymmpItems = [
      makeReimuVoiceItem("えっ", 0),
      makeReimuVoiceItem("えっ", 200),
    ];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    const e0 = (ymmpItems[0]!.TachieFaceEffects as Record<string, unknown>[])[0]!;
    expect(e0.MotionType).toBe("JumpSmall01"); // 驚き

    const e1 = (ymmpItems[1]!.TachieFaceEffects as Record<string, unknown>[])[0]!;
    expect(e1.MotionType).toBe("QuakeSmall"); // 焦り
  });

  it("TachieFaceParameterがないVoiceItemにはTachieFaceEffectsも設定されない", () => {
    const entries = [makeEntry("ゆっくり魔理沙", "テスト", "にやり")];
    const voiceEntries = [makeVoiceEntry("ゆっくり魔理沙", "テスト", 0)];
    const ymmpItems: YmmpItem[] = [{
      $type: "YukkuriMovieMaker.Project.Items.VoiceItem, YukkuriMovieMaker",
      CharacterName: "ゆっくり魔理沙",
      Serif: "テスト",
      Frame: 0,
      Length: 100,
      Layer: 1,
    } as YmmpItem];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    // TachieFaceParameterがないのでスキップされ、エフェクトも付与されない
    expect(ymmpItems[0]!.TachieFaceEffects).toBeUndefined();
  });

  it("表情とモーションが同時に正しく適用される（表情パーツ+モーション一貫性）", () => {
    const entries = [makeEntry("ゆっくり霊夢", "テスト", "焦り")];
    const voiceEntries = [makeVoiceEntry("ゆっくり霊夢", "テスト", 100)];
    const ymmpItems = [makeReimuVoiceItem("テスト", 100)];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    // 表情パーツが正しい
    const face = ymmpItems[0]!.TachieFaceParameter as Record<string, unknown>;
    expect(face.Eyebrow).toBeNull();
    expect(face.Eye).toBe("C:\\動画作成\\立ち絵\\れいむ\\目\\06.png");
    expect(face.Mouth).toBe("C:\\動画作成\\立ち絵\\れいむ\\口\\13.png");

    // モーションも正しい
    const effect = (ymmpItems[0]!.TachieFaceEffects as Record<string, unknown>[])[0]!;
    expect(effect.MotionType).toBe("QuakeSmall");
    expect(effect.Speed).toBe(100);
    expect(effect.PositionCorrection).toBe(10);
  });

  it("既存のTachieFaceEffectsがある場合、上書きされる", () => {
    const entries = [makeEntry("ゆっくり魔理沙", "テスト", "にやり")];
    const voiceEntries = [makeVoiceEntry("ゆっくり魔理沙", "テスト", 0)];
    const ymmpItems = [makeVoiceItem("ゆっくり魔理沙", "テスト", 0)];

    // 既存のTachieFaceEffectsを設定
    ymmpItems[0]!.TachieFaceEffects = [{ $type: "old", MotionType: "Old" }];

    applyExpressions(entries, voiceEntries, ymmpItems, false);

    const effects = ymmpItems[0]!.TachieFaceEffects as Record<string, unknown>[];
    expect(effects).toHaveLength(1);
    expect(effects[0]!.MotionType).toBe("FunSmall"); // 上書きされた
  });
});
