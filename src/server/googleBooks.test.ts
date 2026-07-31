import { describe, it, expect } from "vitest";
import {
  normalizePageCount,
  parsePublishedYear,
  toHttpsUrl,
  normalizeVolume,
} from "./googleBooks";

/**
 * 以下のテストデータは、実際に Google Books API を叩いて
 * 観測したレスポンスを元にしている (不要なフィールドは省略)。
 */

describe("normalizePageCount", () => {
  it("正の整数はそのまま通す", () => {
    expect(normalizePageCount(366)).toBe(366);
  });

  it("0 は null にする（新潮文庫『ペスト』が返す値。実際は476ページ）", () => {
    expect(normalizePageCount(0)).toBeNull();
  });

  it("負の数は null にする", () => {
    expect(normalizePageCount(-5)).toBeNull();
  });

  it("undefined は null にする", () => {
    expect(normalizePageCount(undefined)).toBeNull();
  });

  it("数値以外は null にする", () => {
    expect(normalizePageCount("366")).toBeNull();
  });
});

describe("parsePublishedYear", () => {
  it("日まである形式", () => {
    expect(parsePublishedYear("2001-05-01")).toBe(2001);
  });

  it("月まである形式", () => {
    expect(parsePublishedYear("2012-06")).toBe(2012);
  });

  it("年だけの形式", () => {
    expect(parsePublishedYear("1994")).toBe(1994);
  });

  it("欠損している場合", () => {
    expect(parsePublishedYear(undefined)).toBeNull();
  });

  it("解釈できない文字列", () => {
    expect(parsePublishedYear("不明")).toBeNull();
  });
});

describe("toHttpsUrl", () => {
  it("http を https に置き換える（混在コンテンツで遮断されるため）", () => {
    expect(toHttpsUrl("http://books.google.com/books/content?id=abc")).toBe(
      "https://books.google.com/books/content?id=abc",
    );
  });

  it("すでに https ならそのまま", () => {
    expect(toHttpsUrl("https://books.google.com/x")).toBe(
      "https://books.google.com/x",
    );
  });

  it("欠損している場合", () => {
    expect(toHttpsUrl(undefined)).toBeNull();
  });
});

describe("normalizeVolume", () => {
  it("新潮文庫『ペスト』— pageCount が 0 なので null にする", () => {
    const result = normalizeVolume({
      volumeInfo: {
        title: "ペスト",
        authors: ["カミュ"],
        publishedDate: "1969-10",
        industryIdentifiers: [
          { type: "ISBN_10", identifier: "4102114033" },
          { type: "ISBN_13", identifier: "9784102114032" },
        ],
        pageCount: 0,
        imageLinks: {
          thumbnail: "http://books.google.com/books/content?id=Yr3TAAAACAAJ",
        },
      },
    });

    expect(result).toEqual({
      isbn13: "9784102114032",
      title: "ペスト",
      author: "カミュ",
      publisher: null, // このレコードには publisher が無い
      publishedYear: 1969,
      pageCount: null, // 0 を通さない
      coverUrl: "https://books.google.com/books/content?id=Yr3TAAAACAAJ",
      isEbook: false,
    });
  });

  it("中公文庫『日の名残り』— 書影も出版社も無いが登録できる", () => {
    const result = normalizeVolume({
      volumeInfo: {
        title: "日の名残り",
        authors: ["Kazuo Ishiguro", "政雄·土屋"],
        publishedDate: "1994",
        industryIdentifiers: [
          { type: "ISBN_10", identifier: "4122020638" },
          { type: "ISBN_13", identifier: "9784122020634" },
        ],
        pageCount: 366,
        // imageLinks なし
        // publisher なし
      },
      saleInfo: { isEbook: false },
    });

    expect(result).toMatchObject({
      isbn13: "9784122020634",
      title: "日の名残り",
      author: "Kazuo Ishiguro, 政雄·土屋", // 複数著者は連結する
      publisher: null,
      publishedYear: 1994,
      pageCount: 366,
      coverUrl: null,
      isEbook: false,
    });
  });

  it("ハヤカワepi文庫『日の名残り』— 電子版があるレコードには印を付ける", () => {
    const result = normalizeVolume({
      volumeInfo: {
        title: "日の名残り",
        authors: ["カズオ・イシグロ"],
        publisher: "早川書房",
        publishedDate: "2001-05-01",
        industryIdentifiers: [
          { type: "ISBN_13", identifier: "9784151200038" },
        ],
        // 紙は365ページだが、電子版のこのレコードは178を返す
        pageCount: 178,
      },
      saleInfo: { isEbook: true },
    });

    expect(result?.isEbook).toBe(true);
    expect(result?.pageCount).toBe(178);
    expect(result?.publisher).toBe("早川書房");
  });

  it("ISBN-13 が無いレコードは扱わない", () => {
    const result = normalizeVolume({
      volumeInfo: {
        title: "ISBNのない古い資料",
        industryIdentifiers: [
          { type: "OTHER", identifier: "OCLC:12345678" },
        ],
      },
    });

    expect(result).toBeNull();
  });

  it("industryIdentifiers 自体が無いレコードも扱わない", () => {
    const result = normalizeVolume({
      volumeInfo: { title: "スキャンされただけの資料" },
    });

    expect(result).toBeNull();
  });

  it("タイトルが無いレコードは扱わない", () => {
    const result = normalizeVolume({
      volumeInfo: {
        industryIdentifiers: [
          { type: "ISBN_13", identifier: "9784102114032" },
        ],
      },
    });

    expect(result).toBeNull();
  });

  it("volumeInfo ごと欠けていても落ちない", () => {
    expect(normalizeVolume({})).toBeNull();
  });
});
