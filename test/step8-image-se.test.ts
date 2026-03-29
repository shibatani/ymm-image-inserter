import { describe, expect, test, beforeEach } from "bun:test";
import { step8_insertImageSE } from "../src/steps.ts";
import type { ImageBlock, ImageGroup, YmmpData, YmmpItem } from "../src/types.ts";
import {
  IMAGE_TRANSITION_SE,
  IMAGE_SE_LENGTH,
  LAYER_IMAGE_SE,
} from "../src/constants.ts";
import { REMARK_PREFIX } from "../src/util.ts";

// --- Test helpers ---

function makeGroup(imageId: string, imageType: "AI" | "実写" | "図解" = "AI"): ImageGroup {
  return {
    imageId,
    description: `test image ${imageId}`,
    imageType,
    referenceUrl: "",
    aiPrompt: "",
    entries: [],
  };
}

function makeBlock(imageId: string, frame: number, length: number, imageType: "AI" | "実写" | "図解" = "AI"): ImageBlock {
  return {
    group: makeGroup(imageId, imageType),
    voiceItems: [],
    frame,
    length,
  };
}

function makeYmmpData(existingItems: YmmpItem[] = []): YmmpData {
  return {
    FilePath: "",
    Timelines: [{ Items: [...existingItems] }],
    Characters: [],
  } as YmmpData;
}

function getInsertedSE(data: YmmpData): YmmpItem[] {
  const items = data.Timelines[0]!.Items as YmmpItem[];
  return items.filter(
    (i) => i.$type?.includes("AudioItem") && i.Remark?.includes(":se"),
  );
}

function av(item: YmmpItem, prop: string): number {
  const val = (item as Record<string, unknown>)[prop] as { Values: { Value: number }[] } | undefined;
  return val?.Values?.[0]?.Value ?? 0;
}

// --- Tests ---

describe("step8_insertImageSE", () => {
  describe("基本動作: SE挿入数", () => {
    test("ブロック0件 → SE挿入なし", () => {
      const data = makeYmmpData();
      const result = step8_insertImageSE(data, []);
      expect(result).toBe(0);
      expect(getInsertedSE(data)).toHaveLength(0);
    });

    test("ブロック1件 → SE挿入なし（最初のブロックにはSEを付けない）", () => {
      const data = makeYmmpData();
      const blocks = [makeBlock("1", 0, 300)];
      const result = step8_insertImageSE(data, blocks);
      expect(result).toBe(0);
      expect(getInsertedSE(data)).toHaveLength(0);
    });

    test("ブロック2件 → SE 1件（2番目のブロック開始位置）", () => {
      const data = makeYmmpData();
      const blocks = [
        makeBlock("1", 0, 300),
        makeBlock("2", 300, 400),
      ];
      const result = step8_insertImageSE(data, blocks);
      expect(result).toBe(1);
      expect(getInsertedSE(data)).toHaveLength(1);
    });

    test("ブロック5件 → SE 4件", () => {
      const data = makeYmmpData();
      const blocks = [
        makeBlock("1", 0, 300),
        makeBlock("2", 300, 400),
        makeBlock("3", 700, 500),
        makeBlock("4", 1200, 300),
        makeBlock("5", 1500, 600),
      ];
      const result = step8_insertImageSE(data, blocks);
      expect(result).toBe(4);
      expect(getInsertedSE(data)).toHaveLength(4);
    });

    test("ブロック100件 → SE 99件", () => {
      const data = makeYmmpData();
      const blocks: ImageBlock[] = [];
      let frame = 0;
      for (let i = 1; i <= 100; i++) {
        blocks.push(makeBlock(String(i), frame, 300));
        frame += 300;
      }
      const result = step8_insertImageSE(data, blocks);
      expect(result).toBe(99);
      expect(getInsertedSE(data)).toHaveLength(99);
    });
  });

  describe("フレーム位置: 画像の開始フレームにSEが配置される", () => {
    test("各SEのFrameがブロックの開始フレームと一致する", () => {
      const data = makeYmmpData();
      const blocks = [
        makeBlock("1", 0, 375),
        makeBlock("2", 375, 951),
        makeBlock("3", 1326, 864),
        makeBlock("4", 2190, 563),
      ];
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      // SE should be at frame 375, 1326, 2190 (not at 0)
      const seFrames = seItems.map((s) => s.Frame).sort((a, b) => a - b);
      expect(seFrames).toEqual([375, 1326, 2190]);
    });

    test("最初のブロック(Frame=0)にはSEが配置されない", () => {
      const data = makeYmmpData();
      const blocks = [
        makeBlock("1", 0, 300),
        makeBlock("2", 300, 400),
      ];
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      expect(seItems.every((s) => s.Frame !== 0)).toBe(true);
    });

    test("最初のブロックがFrame=0以外でも、先頭ブロックにはSEが付かない", () => {
      const data = makeYmmpData();
      const blocks = [
        makeBlock("1", 100, 200),
        makeBlock("2", 300, 400),
      ];
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      expect(seItems).toHaveLength(1);
      expect(seItems[0]!.Frame).toBe(300);
    });
  });

  describe("ブロック順序: ソートの正確性", () => {
    test("逆順で渡されたブロックでも正しくソートされSEが配置される", () => {
      const data = makeYmmpData();
      const blocks = [
        makeBlock("4", 2190, 563),
        makeBlock("1", 0, 375),
        makeBlock("3", 1326, 864),
        makeBlock("2", 375, 951),
      ];
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      // 先頭はFrame=0のブロック1なのでSEなし。残り3つにSE
      expect(seItems).toHaveLength(3);
      const seFrames = seItems.map((s) => s.Frame).sort((a, b) => a - b);
      expect(seFrames).toEqual([375, 1326, 2190]);
    });

    test("ランダム順でもフレーム昇順の先頭ブロックが正しく判定される", () => {
      const data = makeYmmpData();
      const blocks = [
        makeBlock("3", 600, 200),
        makeBlock("1", 200, 200),
        makeBlock("2", 400, 200),
      ];
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      // 先頭はFrame=200のブロック1
      expect(seItems).toHaveLength(2);
      expect(seItems.every((s) => s.Frame !== 200)).toBe(true);
    });
  });

  describe("SEプロパティ: AudioItemの属性が正しい", () => {
    test("$typeがAudioItemである", () => {
      const data = makeYmmpData();
      const blocks = [makeBlock("1", 0, 300), makeBlock("2", 300, 400)];
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      expect(seItems[0]!.$type).toBe(
        "YukkuriMovieMaker.Project.Items.AudioItem, YukkuriMovieMaker",
      );
    });

    test("Layer が LAYER_IMAGE_SE (13) である", () => {
      const data = makeYmmpData();
      const blocks = [makeBlock("1", 0, 300), makeBlock("2", 300, 400)];
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      expect(seItems[0]!.Layer).toBe(LAYER_IMAGE_SE);
      expect(seItems[0]!.Layer).toBe(13);
    });

    test("Length が IMAGE_SE_LENGTH (53) である", () => {
      const data = makeYmmpData();
      const blocks = [makeBlock("1", 0, 300), makeBlock("2", 300, 400)];
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      expect(seItems[0]!.Length).toBe(IMAGE_SE_LENGTH);
      expect(seItems[0]!.Length).toBe(53);
    });

    test("FilePathがIMAGE_TRANSITION_SEのいずれかである", () => {
      const data = makeYmmpData();
      const blocks = [makeBlock("1", 0, 300), makeBlock("2", 300, 400)];
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      const validPaths = IMAGE_TRANSITION_SE.map((s) => s.path);
      expect(validPaths).toContain(seItems[0]!.FilePath);
    });

    test("VolumeがFilePathに対応するSEの音量と一致する", () => {
      const data = makeYmmpData();
      // 十分な数のブロックを生成してランダム性をカバー
      const blocks: ImageBlock[] = [];
      let frame = 0;
      for (let i = 1; i <= 50; i++) {
        blocks.push(makeBlock(String(i), frame, 300));
        frame += 300;
      }
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      const seMap = new Map(IMAGE_TRANSITION_SE.map((s) => [s.path, s.volume]));
      for (const se of seItems) {
        const expectedVolume = seMap.get(se.FilePath!);
        expect(expectedVolume).toBeDefined();
        expect(av(se, "Volume")).toBe(expectedVolume!);
      }
    });

    test("IsLoopedがfalseである", () => {
      const data = makeYmmpData();
      const blocks = [makeBlock("1", 0, 300), makeBlock("2", 300, 400)];
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      expect((seItems[0] as Record<string, unknown>).IsLooped).toBe(false);
    });

    test("PlaybackRateが100である", () => {
      const data = makeYmmpData();
      const blocks = [makeBlock("1", 0, 300), makeBlock("2", 300, 400)];
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      expect(seItems[0]!.PlaybackRate).toBe(100);
    });

    test("Panが0である", () => {
      const data = makeYmmpData();
      const blocks = [makeBlock("1", 0, 300), makeBlock("2", 300, 400)];
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      expect(av(seItems[0]!, "Pan")).toBe(0);
    });
  });

  describe("Remark: 識別子の形式", () => {
    test("Remarkが 'ymm-auto{imageId}:se' の形式である", () => {
      const data = makeYmmpData();
      const blocks = [
        makeBlock("1", 0, 300),
        makeBlock("42", 300, 400),
      ];
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      expect(seItems[0]!.Remark).toBe(`${REMARK_PREFIX}42:se`);
    });

    test("各SEのRemarkが一意である", () => {
      const data = makeYmmpData();
      const blocks = [
        makeBlock("1", 0, 300),
        makeBlock("2", 300, 400),
        makeBlock("3", 700, 500),
        makeBlock("4", 1200, 300),
      ];
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      const remarks = seItems.map((s) => s.Remark);
      expect(new Set(remarks).size).toBe(remarks.length);
    });
  });

  describe("冪等性: 2回実行しても重複しない", () => {
    test("同じブロックで2回実行してもSE数は変わらない", () => {
      const data = makeYmmpData();
      const blocks = [
        makeBlock("1", 0, 300),
        makeBlock("2", 300, 400),
        makeBlock("3", 700, 500),
      ];

      const result1 = step8_insertImageSE(data, blocks);
      expect(result1).toBe(2);

      const result2 = step8_insertImageSE(data, blocks);
      expect(result2).toBe(0);

      expect(getInsertedSE(data)).toHaveLength(2);
    });

    test("3回実行してもSE数は変わらない", () => {
      const data = makeYmmpData();
      const blocks = [
        makeBlock("1", 0, 300),
        makeBlock("2", 300, 400),
      ];

      step8_insertImageSE(data, blocks);
      step8_insertImageSE(data, blocks);
      step8_insertImageSE(data, blocks);

      expect(getInsertedSE(data)).toHaveLength(1);
    });

    test("一部のSEが既に存在する場合、不足分だけ追加される", () => {
      const existingSE: YmmpItem = {
        $type: "YukkuriMovieMaker.Project.Items.AudioItem, YukkuriMovieMaker",
        Frame: 300,
        Layer: LAYER_IMAGE_SE,
        Length: IMAGE_SE_LENGTH,
        Remark: `${REMARK_PREFIX}2:se`,
      } as YmmpItem;

      const data = makeYmmpData([existingSE]);
      const blocks = [
        makeBlock("1", 0, 300),
        makeBlock("2", 300, 400),
        makeBlock("3", 700, 500),
      ];

      const result = step8_insertImageSE(data, blocks);
      // ブロック2のSEは既に存在するのでスキップ、ブロック3のみ追加
      expect(result).toBe(1);
      expect(getInsertedSE(data)).toHaveLength(2);
    });
  });

  describe("ランダム性: 4種類のSEが使用される", () => {
    test("十分な数のブロックがあれば複数種類のSEが使用される", () => {
      const data = makeYmmpData();
      const blocks: ImageBlock[] = [];
      let frame = 0;
      for (let i = 1; i <= 200; i++) {
        blocks.push(makeBlock(String(i), frame, 100));
        frame += 100;
      }
      step8_insertImageSE(data, blocks);
      const seItems = getInsertedSE(data);

      const usedPaths = new Set(seItems.map((s) => s.FilePath));
      // 200ブロックあれば4種類全て使われる確率は極めて高い
      expect(usedPaths.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("画像種別: AI/実写/図解すべてにSEが挿入される", () => {
    test("AI画像の切り替わりにSEが挿入される", () => {
      const data = makeYmmpData();
      const blocks = [
        makeBlock("1", 0, 300, "AI"),
        makeBlock("2", 300, 400, "AI"),
      ];
      step8_insertImageSE(data, blocks);
      expect(getInsertedSE(data)).toHaveLength(1);
    });

    test("実写画像の切り替わりにSEが挿入される", () => {
      const data = makeYmmpData();
      const blocks = [
        makeBlock("1", 0, 300, "実写"),
        makeBlock("2", 300, 400, "実写"),
      ];
      step8_insertImageSE(data, blocks);
      expect(getInsertedSE(data)).toHaveLength(1);
    });

    test("図解画像の切り替わりにSEが挿入される", () => {
      const data = makeYmmpData();
      const blocks = [
        makeBlock("1", 0, 300, "図解"),
        makeBlock("2", 300, 400, "図解"),
      ];
      step8_insertImageSE(data, blocks);
      expect(getInsertedSE(data)).toHaveLength(1);
    });

    test("異なる画像種別が混在してもSEが挿入される", () => {
      const data = makeYmmpData();
      const blocks = [
        makeBlock("1", 0, 300, "実写"),
        makeBlock("2", 300, 400, "AI"),
        makeBlock("3", 700, 500, "図解"),
        makeBlock("4", 1200, 300, "実写"),
      ];
      step8_insertImageSE(data, blocks);
      expect(getInsertedSE(data)).toHaveLength(3);
    });
  });

  describe("既存アイテムとの共存", () => {
    test("既存のVoiceItemやImageItemが保持される", () => {
      const existingItems: YmmpItem[] = [
        {
          $type: "YukkuriMovieMaker.Project.Items.VoiceItem, YukkuriMovieMaker",
          Frame: 0,
          Layer: 11,
          Length: 100,
          Remark: "",
        } as YmmpItem,
        {
          $type: "YukkuriMovieMaker.Project.Items.ImageItem, YukkuriMovieMaker",
          Frame: 0,
          Layer: 5,
          Length: 300,
          Remark: "",
        } as YmmpItem,
      ];

      const data = makeYmmpData(existingItems);
      const blocks = [
        makeBlock("1", 0, 300),
        makeBlock("2", 300, 400),
      ];
      step8_insertImageSE(data, blocks);

      const allItems = data.Timelines[0]!.Items as YmmpItem[];
      // 既存2件 + SE1件 = 3件
      expect(allItems).toHaveLength(3);
      expect(allItems.filter((i) => i.$type?.includes("VoiceItem"))).toHaveLength(1);
      expect(allItems.filter((i) => i.$type?.includes("ImageItem"))).toHaveLength(1);
      expect(allItems.filter((i) => i.$type?.includes("AudioItem"))).toHaveLength(1);
    });

    test("既存のBGM AudioItemと競合しない", () => {
      const bgm: YmmpItem = {
        $type: "YukkuriMovieMaker.Project.Items.AudioItem, YukkuriMovieMaker",
        Frame: 0,
        Layer: 1,
        Length: 5000,
        Remark: "",
        FilePath: "C:\\動画作成\\BGM\\test.mp3",
      } as YmmpItem;

      const data = makeYmmpData([bgm]);
      const blocks = [
        makeBlock("1", 0, 300),
        makeBlock("2", 300, 400),
      ];
      step8_insertImageSE(data, blocks);

      const allAudio = (data.Timelines[0]!.Items as YmmpItem[]).filter(
        (i) => i.$type?.includes("AudioItem"),
      );
      expect(allAudio).toHaveLength(2); // BGM + SE
      expect(allAudio.find((a) => a.Layer === 1)).toBeDefined(); // BGM preserved
      expect(allAudio.find((a) => a.Layer === LAYER_IMAGE_SE)).toBeDefined(); // SE added
    });
  });

  describe("音量保持: SEごとに正しい音量が設定される", () => {
    test("カーソル移動2 → volume 30", () => {
      const se = IMAGE_TRANSITION_SE.find((s) => s.path.includes("カーソル移動2"));
      expect(se).toBeDefined();
      expect(se!.volume).toBe(30.0);
    });

    test("決定ボタンを押す3 → volume 30", () => {
      const se = IMAGE_TRANSITION_SE.find((s) => s.path.includes("決定ボタンを押す3"));
      expect(se).toBeDefined();
      expect(se!.volume).toBe(30.0);
    });

    test("決定ボタンを押す7 → volume 30", () => {
      const se = IMAGE_TRANSITION_SE.find((s) => s.path.includes("決定ボタンを押す7"));
      expect(se).toBeDefined();
      expect(se!.volume).toBe(30.0);
    });

    test("決定ボタンを押す31 → volume 20", () => {
      const se = IMAGE_TRANSITION_SE.find((s) => s.path.includes("決定ボタンを押す31"));
      expect(se).toBeDefined();
      expect(se!.volume).toBe(20.0);
    });

    test("IMAGE_TRANSITION_SEは4種類定義されている", () => {
      expect(IMAGE_TRANSITION_SE).toHaveLength(4);
    });
  });

  describe("定数値の整合性", () => {
    test("LAYER_IMAGE_SEが他のレイヤーと衝突しない (13)", () => {
      expect(LAYER_IMAGE_SE).toBe(13);
    });

    test("IMAGE_SE_LENGTHが妥当な値 (53フレーム ≈ 0.88秒)", () => {
      expect(IMAGE_SE_LENGTH).toBe(53);
      expect(IMAGE_SE_LENGTH).toBeGreaterThan(0);
      expect(IMAGE_SE_LENGTH).toBeLessThan(120); // 2秒以内
    });

    test("全SEファイルパスが C:\\動画作成\\画像切り替え効果音\\ 配下", () => {
      for (const se of IMAGE_TRANSITION_SE) {
        expect(se.path).toMatch(/^C:\\動画作成\\画像切り替え効果音\\/);
      }
    });
  });
});
