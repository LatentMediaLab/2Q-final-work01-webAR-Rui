#!/usr/bin/env sh

set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$PROJECT_ROOT"

if ! command -v npm >/dev/null 2>&1; then
  echo "エラー: npmが見つかりません。Node.jsをインストールしてください。" >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "エラー: node_modulesがありません。先に npm install を実行してください。" >&2
  exit 1
fi

echo "Fav Collection開発サーバーをLAN公開で起動します。"
echo "停止するには Ctrl+C を押してください。"

exec npm run dev -- --host 0.0.0.0 "$@"
