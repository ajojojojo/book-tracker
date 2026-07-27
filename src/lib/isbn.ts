/**
 * ISBN を 13 桁形式に正規化する。
 *
 * 事前検証で以下が分かっているため、この処理が必要になる:
 * - 書籍には ISBN-10 (旧規格) と ISBN-13 (現行規格) が混在する
 * - 本の裏のバーコード (EAN-13) は ISBN-13 と同一
 * - openBD は ISBN-10 を投げても 13 桁に正規化して返す
 * - 979 で始まる ISBN には ISBN-10 が存在しない
 *
 * DB には 13 桁のみを保存する。
 */

/** ハイフン・空白を除去し、チェックディジットの X を大文字に揃える */
function clean(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * ISBN-10 のチェックディジットを計算する。
 * 左から 10, 9, 8 ... 2 の重みを掛けた合計を 11 で割る。
 * 余りが 10 になる場合は 'X' で表す (数字1桁に収まらないため)。
 */
function checkDigit10(first9: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(first9[i]) * (10 - i);
  }
  const digit = (11 - (sum % 11)) % 11;
  return digit === 10 ? "X" : String(digit);
}

/**
 * ISBN-13 のチェックディジットを計算する。
 * 左から 1, 3, 1, 3 ... の重みを掛けた合計を 10 で割る。
 * こちらは必ず 0-9 に収まる。
 */
function checkDigit13(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

/**
 * 入力された ISBN を 13 桁に正規化して返す。
 * 不正な入力の場合は null を返す (例外は投げない)。
 *
 * @example
 * normalizeIsbn("4873115655")        // "9784873115658"
 * normalizeIsbn("978-4-87311-565-8") // "9784873115658"
 * normalizeIsbn("1234567890")        // null (チェックディジット不一致)
 */
export function normalizeIsbn(input: string): string | null {
  const s = clean(input);

  // ISBN-10: 数字9桁 + チェックディジット (数字または X)
  if (/^\d{9}[\dX]$/.test(s)) {
    if (s[9] !== checkDigit10(s.slice(0, 9))) return null;

    // 978 を前置し、チェックディジットを計算し直す
    const body = "978" + s.slice(0, 9);
    return body + checkDigit13(body);
  }

  // ISBN-13: 数字13桁
  if (/^\d{13}$/.test(s)) {
    // 書籍の接頭記号は 978 または 979 のみ
    if (!/^97[89]/.test(s)) return null;
    if (s[12] !== checkDigit13(s.slice(0, 12))) return null;

    return s;
  }

  return null;
}
