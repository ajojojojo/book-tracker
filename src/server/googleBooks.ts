/**
 * Google Books API から書誌情報を取得する。
 *
 * このファイルは Next.js に依存しない。
 * 将来 API を別サービスへ切り出すときは、そのまま移設できる。
 *
 * ------------------------------------------------------------------
 * 事前検証で分かっていること (README の「技術検証の記録」参照):
 *
 *  - API キーが無いと常に 429 が返る (匿名枠が 0)
 *  - pageCount は「欠損」だけでなく「0 が入っている」ことがある
 *  - industryIdentifiers ごと存在しないレコードがある
 *  - publisher / imageLinks も欠けることがある
 *  - publishedDate は "2001-05-01" / "2012-06" / "1994" の3形式がある
 *  - imageLinks の URL は http:// で返ってくる
 * ------------------------------------------------------------------
 */

const API_ENDPOINT = "https://www.googleapis.com/books/v1/volumes";

/** 画面に出す候補1件分。DB の Book とは別物 (まだ保存していない状態) */
export type BookCandidate = {
  isbn13: string;
  title: string;
  author: string | null;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  coverUrl: string | null;

  /**
   * 電子書籍として販売されているレコードか。
   *
   * 検証中、電子版のあるレコードの pageCount が
   * 紙のページ数と大きく異なる例が見つかった (366 に対して 178)。
   * ただし確認できたのは1件のみで、法則として確定していない。
   *
   * そのため値を捨てる処理はせず、呼び出し側が
   * 「参考値である」と伝えられるよう情報として残す。
   */
  isEbook: boolean;
};

/** Google Books のレスポンス。欠損だらけなので全て optional で受ける */
type GoogleBooksVolume = {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    industryIdentifiers?: { type?: string; identifier?: string }[];
    pageCount?: number;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
  saleInfo?: { isEbook?: boolean };
};

type GoogleBooksResponse = {
  totalItems?: number;
  items?: GoogleBooksVolume[];
};

// ====================================================================
// 変換ロジック (純粋関数。ネットワークに触れないのでテストしやすい)
// ====================================================================

/**
 * pageCount を正規化する。
 *
 * `?? null` では 0 を弾けない。?? は null と undefined しか拾わないため。
 * 新潮文庫『ペスト』(実際は476ページ) は 0 を返してくるので、
 * これを通すと厚み 0 の本が積み上げ画面から消える。
 */
export function normalizePageCount(raw: unknown): number | null {
  if (typeof raw !== "number") return null;
  if (!Number.isFinite(raw)) return null;
  if (raw <= 0) return null;
  return Math.trunc(raw);
}

/**
 * publishedDate から西暦年だけを取り出す。
 *
 * "2001-05-01" / "2012-06" / "1994" の3形式が確認されている。
 * new Date() に渡すと形式によって結果がぶれるため、先頭4桁を読む。
 */
export function parsePublishedYear(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const matched = raw.trim().match(/^(\d{4})/);
  if (!matched) return null;
  const year = Number(matched[1]);
  return year >= 1000 && year <= 2999 ? year : null;
}

/**
 * 書影 URL を https に揃える。
 *
 * Google Books は http:// で返してくる。
 * https のページから http の画像を読むとブラウザが遮断するため
 * (混在コンテンツ)、書影が表示されなくなる。
 */
export function toHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  return raw.replace(/^http:\/\//, "https://");
}

/**
 * API のレスポンス1件を、アプリで扱う形へ変換する。
 * 扱えないレコードは null を返す (例外は投げない)。
 */
export function normalizeVolume(
  volume: GoogleBooksVolume,
): BookCandidate | null {
  const info = volume.volumeInfo;
  if (!info) return null;

  // ISBN-13 が無い本は DB に保存できない (isbn13 が一意キーのため)。
  // 古い本やスキャン資料は ISBN を持たないことがある
  const isbn13 = info.industryIdentifiers?.find(
    (id) => id.type === "ISBN_13",
  )?.identifier;
  if (!isbn13 || !/^\d{13}$/.test(isbn13)) return null;

  const title = info.title?.trim();
  if (!title) return null;

  return {
    isbn13,
    title,
    // 複数著者は配列で来る。訳者も含まれる
    author: info.authors?.length ? info.authors.join(", ") : null,
    publisher: info.publisher?.trim() || null,
    publishedYear: parsePublishedYear(info.publishedDate),
    pageCount: normalizePageCount(info.pageCount),
    coverUrl: toHttpsUrl(info.imageLinks?.thumbnail),
    isEbook: volume.saleInfo?.isEbook === true,
  };
}

// ====================================================================
// 通信部分
// ====================================================================

function buildUrl(params: Record<string, string>): URL {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_BOOKS_API_KEY が設定されていません。.env を確認してください",
    );
  }

  const url = new URL(API_ENDPOINT);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("key", apiKey);
  return url;
}

async function fetchCandidates(url: URL): Promise<BookCandidate[]> {
  const response = await fetch(url, {
    // Next.js のキャッシュに任せる。同じ検索語の再取得を抑える
    next: { revalidate: 60 * 60 },
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "Google Books API の1日の上限に達しました。時間をおいて再度お試しください",
      );
    }
    throw new Error(`Google Books API エラー (HTTP ${response.status})`);
  }

  const data = (await response.json()) as GoogleBooksResponse;

  // ヒット0件のとき items フィールド自体が存在しない
  if (!data.items) return [];

  return data.items
    .map(normalizeVolume)
    .filter((candidate): candidate is BookCandidate => candidate !== null);
}

/**
 * キーワードで書籍を検索する。
 *
 * langRestrict / printType を付けないと、洋書の原著や雑誌が大量に混ざる。
 */
export async function searchBooksByKeyword(
  keyword: string,
): Promise<BookCandidate[]> {
  const trimmed = keyword.trim();
  if (trimmed === "") return [];

  return fetchCandidates(
    buildUrl({
      q: trimmed,
      langRestrict: "ja",
      printType: "books",
      maxResults: "20",
    }),
  );
}

/**
 * ISBN-13 で1冊を特定する。
 * 事前に src/lib/isbn.ts の normalizeIsbn を通した値を渡すこと。
 */
export async function findBookByIsbn(
  isbn13: string,
): Promise<BookCandidate | null> {
  const candidates = await fetchCandidates(
    buildUrl({ q: `isbn:${isbn13}` }),
  );

  // 念のため、要求した ISBN と一致するものを優先する
  return candidates.find((c) => c.isbn13 === isbn13) ?? candidates[0] ?? null;
}
