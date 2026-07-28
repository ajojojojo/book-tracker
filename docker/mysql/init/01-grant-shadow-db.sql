-- MySQL コンテナの初回起動時に自動実行される SQL。
--
-- Prisma Migrate は、スキーマの差分を検証するために
-- `prisma_migrate_shadow_db_<ランダムな文字列>` という
-- 一時データベースを作成し、終わったら削除する。
--
-- MySQL 公式イメージは MYSQL_USER に対して MYSQL_DATABASE の
-- 権限しか与えないため、そのままではこの一時データベースを作れない。
--
-- root を使えば動くが、アプリケーションを管理者権限で
-- 動かすのは避けたい。そこで「シャドウ DB の名前に一致するものだけ」
-- を対象に権限を追加する。
--
-- ワイルドカード `%` により prisma_migrate_shadow_db_ で始まる
-- データベースのみが対象になり、他のデータベースには影響しない。

GRANT ALL PRIVILEGES ON `prisma_migrate_shadow_db_%`.* TO 'bookuser'@'%';

FLUSH PRIVILEGES;
