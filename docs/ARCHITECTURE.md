# このプロジェクトの構造

「どのファイルが何をしていて、どう繋がっているか」をまとめたもの。
迷ったらここに戻る。

---

## 1. ファイルの地図

```
book-tracker/
│
├─【土台】動かすための設定。一度作ればほぼ触らない
│   ├── docker-compose.yml          MySQL を起動する設定
│   ├── docker/mysql/init/*.sql     MySQL 初回起動時に実行する SQL
│   ├── .env                        秘密情報（Git に入れない）
│   ├── .env.example                .env の見本（Git に入れる）
│   ├── package.json                依存パッケージとコマンドの定義
│   ├── prisma.config.ts            Prisma CLI の設定（接続先）
│   ├── vitest.config.ts            テストの設定
│   ├── next.config.ts              Next.js の設定
│   └── tsconfig.json               TypeScript の設定
│
├─【設計図】DB の形を決める
│   └── prisma/
│       ├── schema.prisma           テーブル定義（人が書く）
│       └── migrations/*.sql        そこから生成された SQL（自動）
│
└─ src/
   │
   ├─【ロジック層】判断をする場所。Next.js に依存しない
   │   ├── lib/
   │   │   ├── isbn.ts              ISBN を 13 桁に正規化する
   │   │   ├── isbn.test.ts         そのテスト
   │   │   └── prisma.ts            DB 接続の入り口（唯一）
   │   └── server/
   │       ├── googleBooks.ts       外部 API から書誌情報を取る
   │       └── googleBooks.test.ts  そのテスト
   │
   ├─【表示層】画面
   │   └── app/
   │       ├── layout.tsx           全ページ共通の外枠
   │       ├── page.tsx             トップページ（"/"）
   │       └── globals.css          全体のスタイル
   │
   └─【自動生成】触らない・Git に入れない
       └── generated/prisma/        schema.prisma から作られる型とメソッド
```

### 3つの層に分けている理由

| 層 | 役割 | 特徴 |
|---|---|---|
| **土台** | アプリを動かす環境を作る | 最初に一度作れば、ほぼ触らない |
| **ロジック層** | 判断・変換・データ操作 | **テストしやすい。移設できる** |
| **表示層** | 画面に出す | Next.js に強く依存する |

**ロジック層が Next.js に依存しないことが重要。**
`src/lib/` と `src/server/` は普通の TypeScript なので、
将来 API を別サービスに切り出すとき、そのまま移せる。

---

## 2. 実行時にどう繋がるか

「ISBN を入力して本を登録する」を例にすると、こうなる。

```
 ①ブラウザ
    │  ISBN を入力して送信
    ↓
 ②src/app/... （表示層）
    │  受け取る
    ↓
 ③src/lib/isbn.ts
    │  normalizeIsbn("4-15-120003-8") → "9784151200038"
    │  不正なら、ここで弾いて①にエラーを返す
    ↓
 ④src/server/googleBooks.ts
    │  findBookByIsbn("9784151200038")
    │  → 外部 API を叩く
    │  → pageCount が 0 なら null にするなど整形
    ↓
 ⑤src/lib/prisma.ts
    │  prisma.book.create({ ... })
    ↓
 ⑥MySQL（Docker コンテナ）
    │  books テーブルに 1 行入る
    ↓
 ⑦画面に反映
```

**各ファイルが1つのことだけをしている。**

- `isbn.ts` は ISBN のことしか知らない（API も DB も知らない）
- `googleBooks.ts` は外部 API のことしか知らない（DB を知らない）
- `prisma.ts` は接続のことしか知らない（何を保存するか知らない）

だからそれぞれ単独でテストできるし、片方を差し替えても他方が壊れない。

---

## 3. なぜこの順番で作ってきたか

**下から積み上げている。** 上から作ると、土台が無いので動作確認ができない。

```
Step 1  Next.js プロジェクト作成        ← 何もない状態から箱を作る
Step 2  .gitignore / README            ← 秘密情報を守る仕組みを先に置く
Step 3  src/lib/isbn.ts + テスト        ← 外部依存ゼロの部品。DBもAPIも要らない
Step 4  docker-compose.yml             ← DB を用意する
Step 5  prisma/schema.prisma           ← テーブルを設計する
Step 6  src/lib/prisma.ts              ← DB への配線
Step 7  src/app/page.tsx（接続確認）    ← 「本当に繋がったか」を目で見る
Step 8  src/server/googleBooks.ts      ← 外部 API の部品
        ↑ いまここ
Step 9  検索・登録画面                  ← ここから部品を組み合わせる
Step 10 積み上げ描画
Step 11 認証
Step 12 CI/CD
Step 13 デプロイ
```

### この順番の原則

**「動作確認できる最小単位」を1つずつ増やす。**

| Step | 何を確認できたか |
|---|---|
| 3 | テストが緑 → ISBN の変換は正しい |
| 4 | `docker compose ps` が healthy → DB は動いている |
| 5 | `SHOW TABLES` で3つ出る → テーブルはできた |
| 7 | 画面に 0 が3つ → **全部が繋がった** |
| 8 | テストが緑 → API のレスポンス整形は正しい |

**Step 7 が重要。** ここまでは部品がバラバラで、
「繋いだら動くはず」という想像でしかなかった。
実際に画面に数字が出て初めて、土台が完成したと確認できる。

もし Step 9（画面）を先に作っていたら、
エラーが出たとき「画面が悪いのか、DB が悪いのか、接続が悪いのか」
が分からず、原因究明に何時間もかかっていた。

---

## 4. どのファイルを、いつ触るか

| やりたいこと | 触るファイル |
|---|---|
| テーブルに列を足す | `prisma/schema.prisma` → `npx prisma migrate dev` |
| 画面を変える | `src/app/**` |
| 外部 API の扱いを変える | `src/server/googleBooks.ts` |
| DB 接続の設定を変える | `.env`（値）/ `src/lib/prisma.ts`（繋ぎ方） |
| MySQL の設定を変える | `docker-compose.yml` → `docker compose up -d` |
| コマンドを足す | `package.json` の `scripts` |

**`src/generated/` は絶対に手で編集しない。** 次の `prisma generate` で消える。

---

## 5. よく使うコマンド

```bash
# 開発
npm run dev                      開発サーバー起動（localhost:3000）
npm test                         テストを1回実行
npm run test:watch               保存のたびにテスト

# データベース
docker compose up -d             MySQL 起動
docker compose ps                状態確認
docker compose down              停止（データは残る）
docker compose down -v           停止＋データ削除（危険）
npx prisma studio                DB の中身を GUI で見る

# スキーマを変えたとき
npx prisma migrate dev --name 変更内容   マイグレーション作成＋適用
npx prisma generate                      型を作り直すだけ（DB不要）
```

---

## 6. これから作るもの

```
Step 9  検索・登録画面
   ├── src/app/books/search/page.tsx    検索画面
   ├── src/app/api/books/route.ts       JSON API（登録）
   └── src/server/bookService.ts        登録のロジック（重複判定など）

Step 10 積み上げ描画
   ├── src/app/page.tsx                 トップを積み上げ画面に置き換え
   └── src/components/BookStack.tsx     SVG で本を積む

Step 11 認証
   ├── src/server/auth.ts               パスワードのハッシュ化・検証
   └── src/app/login/page.tsx           ログイン画面

Step 12 CI/CD
   └── .github/workflows/ci.yml         push時にテストを自動実行

Step 13 デプロイ
   └── Dockerfile                       本番用のコンテナ定義
```
