/**
 * アプリ全体で共有する Prisma クライアント。
 *
 * DB を触るコードは必ずここから import する:
 *   import { prisma } from "@/lib/prisma";
 */

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * DATABASE_URL を分解してドライバに渡す形に変換する。
 *
 * Prisma 7 から、DB ドライバが本体から切り離された。
 * 「Prisma がどう繋ぐか」を明示的に指定する必要がある。
 */
function createPrismaClient(): PrismaClient {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    // 起動時に落とす。接続時まで気づかないより、ここで気づく方が早い
    throw new Error(
      "DATABASE_URL が設定されていません。.env を確認してください",
    );
  }

  // "mysql://user:pass@host:3306/dbname" を部品に分解する。
  // URL は JavaScript の標準機能で、自前で文字列を切る必要はない
  const url = new URL(raw);

  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port) || 3306,

    // URL の中ではパスワードの記号が %40 のように符号化されている。
    // ドライバには元の文字列を渡す必要があるため復号する
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),

    // pathname は "/book_tracker" の形なので先頭の / を落とす
    database: url.pathname.slice(1),

    // 同時に張る接続の上限。
    // 開発中は少なくてよい。増やすほど MySQL 側の負荷が上がる
    connectionLimit: 5,
  });

  return new PrismaClient({ adapter });
}

/**
 * Next.js の開発サーバーはファイル保存のたびにコードを再読み込みする。
 * その都度 new PrismaClient() すると接続が増え続け、
 * やがて "Too many connections" で MySQL が悲鳴を上げる。
 *
 * globalThis に保持しておくことで、再読み込みされても
 * 同じインスタンスを使い回す。
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// 本番はプロセスが再読み込みされないため、保持する必要がない
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
