import { prisma } from "@/lib/prisma";

// このページは表示のたびに DB を見に行く。
// 指定しないと Next.js はビルド時に一度だけ実行して結果を固定してしまう
export const dynamic = "force-dynamic";

export default async function Home() {
  // Server Component なので、この処理は「サーバー上で」実行される。
  // ブラウザに届くのは結果の HTML だけで、この行自体は送られない。
  // だから API を経由せず直接 DB を触れる
  const [userCount, bookCount, logCount] = await Promise.all([
    prisma.user.count(),
    prisma.book.count(),
    prisma.readingLog.count(),
  ]);

  const tables = [
    { name: "users", label: "ユーザー", count: userCount },
    { name: "books", label: "書籍", count: bookCount },
    { name: "reading_logs", label: "読書記録", count: logCount },
  ];

  return (
    <main className="mx-auto max-w-2xl p-8 font-sans">
      <h1 className="text-2xl font-bold">接続確認</h1>
      <p className="mt-2 text-sm text-zinc-500">
        この数字が表示されていれば、Next.js から MySQL まで繋がっています。
      </p>

      <ul className="mt-8 space-y-3">
        {tables.map((table) => (
          <li
            key={table.name}
            className="flex items-baseline justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800"
          >
            <span>
              <span className="font-medium">{table.label}</span>
              <code className="ml-2 text-xs text-zinc-400">{table.name}</code>
            </span>
            <span className="text-xl tabular-nums">{table.count}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
