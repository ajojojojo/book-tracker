import { describe, it, expect } from "vitest";
import { normalizeIsbn } from "./isbn";

describe("normalizeIsbn", () => {
  describe("ISBN-13 はそのまま返す", () => {
    it("リーダブルコード", () => {
      expect(normalizeIsbn("9784873115658")).toBe("9784873115658");
    });

    it("ペスト (新潮文庫)", () => {
      expect(normalizeIsbn("9784102114032")).toBe("9784102114032");
    });

    it("日の名残り (中公文庫)", () => {
      expect(normalizeIsbn("9784122020634")).toBe("9784122020634");
    });

    it("979 で始まる ISBN も受け付ける", () => {
      expect(normalizeIsbn("9791234567896")).toBe("9791234567896");
    });
  });

  describe("ISBN-10 は 13 桁に変換する", () => {
    it("978 を前置してチェックディジットを再計算する", () => {
      expect(normalizeIsbn("4873115655")).toBe("9784873115658");
    });

    it("チェックディジットが X の場合も扱える", () => {
      expect(normalizeIsbn("486152010X")).toBe("9784861520105");
    });

    it("小文字の x も受け付ける", () => {
      expect(normalizeIsbn("486152010x")).toBe("9784861520105");
    });
  });

  describe("表記ゆれを吸収する", () => {
    it("ハイフン区切り (13桁)", () => {
      expect(normalizeIsbn("978-4-87311-565-8")).toBe("9784873115658");
    });

    it("ハイフン区切り (10桁)", () => {
      expect(normalizeIsbn("4-87311-565-5")).toBe("9784873115658");
    });

    it("前後の空白", () => {
      expect(normalizeIsbn("  9784873115658  ")).toBe("9784873115658");
    });

    it("空白区切り", () => {
      expect(normalizeIsbn("978 4 87311 565 8")).toBe("9784873115658");
    });
  });

  describe("不正な入力は null を返す", () => {
    it("チェックディジットが合わない (13桁)", () => {
      expect(normalizeIsbn("9784873115659")).toBeNull();
    });

    it("チェックディジットが合わない (10桁)", () => {
      expect(normalizeIsbn("4873115650")).toBeNull();
    });

    it("接頭記号が 978/979 以外 (チェックディジットは正しい)", () => {
      // 977 は雑誌 (ISSN) 用の接頭記号。書籍ではない
      expect(normalizeIsbn("9771234567898")).toBeNull();
    });

    it("桁数が足りない", () => {
      expect(normalizeIsbn("123456789")).toBeNull();
    });

    it("桁数が多い", () => {
      expect(normalizeIsbn("12345678901234")).toBeNull();
    });

    it("数字以外が混ざる", () => {
      expect(normalizeIsbn("97848731156AB")).toBeNull();
    });

    it("空文字", () => {
      expect(normalizeIsbn("")).toBeNull();
    });

    it("X が末尾以外にある", () => {
      expect(normalizeIsbn("48X3115655")).toBeNull();
    });
  });
});
