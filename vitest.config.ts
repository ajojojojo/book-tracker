import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // 対象は Node.js 上で動くロジック。ブラウザ環境は不要
    environment: "node",
    // src 配下の *.test.ts を自動で拾う
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Next.js の tsconfig に合わせて "@/..." を src/... に解決する
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
