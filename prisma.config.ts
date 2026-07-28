// Prisma CLI の設定ファイル。
//
// Prisma 7 から、データベース接続 URL は schema.prisma ではなく
// このファイルに書く仕様に変わった。
// TypeScript なので、環境変数の読み込みや条件分岐が書ける。

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    // env() は変数が未定義だとエラーを投げる。
    // 設定漏れに気づかないまま進むより、早く落ちる方が安全
    url: env("DATABASE_URL"),
  },
});
