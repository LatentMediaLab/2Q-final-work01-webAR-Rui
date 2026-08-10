import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const defaults = {
  source: path.join(repositoryRoot, "public/assets/posts/custom"),
  output: path.join(repositoryRoot, "public/data/posts.custom.json"),
  urlPrefix: "/assets/posts/custom",
  allowEmpty: false,
};
const imageExtensions = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);
const videoExtensions = new Set([".m4v", ".mp4", ".webm"]);
const viewCounts = [10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000];

function readOptions(argumentsList) {
  const options = { ...defaults };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--help" || argument === "-h") {
      printHelp();
      process.exit(0);
    }

    if (argument === "--allow-empty") {
      options.allowEmpty = true;
      continue;
    }

    const value = argumentsList[index + 1];
    if (value === undefined) {
      throw new Error(`${argument}の値がありません。`);
    }

    switch (argument) {
      case "--source":
        options.source = path.resolve(value);
        break;
      case "--output":
        options.output = path.resolve(value);
        break;
      case "--url-prefix":
        options.urlPrefix = value.replace(/\/$/, "");
        break;
      default:
        throw new Error(`未対応の引数です: ${argument}`);
    }
    index += 1;
  }
  return options;
}

function printHelp() {
  console.log(`Usage: ./generate-custom-posts.command [options]

Options:
  --source <directory>   素材ディレクトリ
  --output <json>        出力JSON
  --url-prefix <path>    JSON内の公開URL接頭辞
  --allow-empty          素材0件でも空配列を書き出す
  -h, --help             ヘルプ表示`);
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

function classifyFiles(files, sourceRoot) {
  const assets = { images: [], videos: [], posters: [], avatars: [], texts: [] };
  for (const filePath of files) {
    const extension = path.extname(filePath).toLowerCase();
    const relativePath = path.relative(sourceRoot, filePath).toLowerCase();
    const segments = relativePath.split(path.sep);
    const baseName = path.basename(filePath, extension).toLowerCase();

    if (videoExtensions.has(extension)) {
      assets.videos.push(filePath);
    } else if (extension === ".txt") {
      assets.texts.push(filePath);
    } else if (imageExtensions.has(extension)) {
      if (segments.includes("avatars") || baseName.startsWith("avatar")) {
        assets.avatars.push(filePath);
      } else if (
        segments.includes("posters") ||
        /(?:^|[-_.])poster(?:$|[-_.])/.test(baseName)
      ) {
        assets.posters.push(filePath);
      } else {
        assets.images.push(filePath);
      }
    }
  }
  return assets;
}

function toPublicUrl(filePath, sourceRoot, urlPrefix) {
  const relativePath = path.relative(sourceRoot, filePath);
  const encodedPath = relativePath
    .split(path.sep)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${urlPrefix}/${encodedPath}`;
}

function displayName(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[-_]+/g, " ")
    .trim();
}

function slugify(value, fallback) {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug.length === 0 ? fallback : slug;
}

function createUniqueId(type, filePath, index, usedIds) {
  const base = `${type}-${slugify(displayName(filePath), String(index + 1).padStart(2, "0"))}`;
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

async function readImageDimensions(filePath) {
  if (path.extname(filePath).toLowerCase() === ".svg") {
    const source = await readFile(filePath, "utf8");
    const svgTag = source.match(/<svg\b[^>]*>/i)?.[0] ?? "";
    const width = readSvgNumber(svgTag, "width");
    const height = readSvgNumber(svgTag, "height");
    if (width !== null && height !== null) {
      return { width, height };
    }
    const viewBox = svgTag.match(/\bviewBox=["']([^"']+)["']/i)?.[1];
    const values = viewBox?.trim().split(/[\s,]+/).map(Number);
    if (
      values !== undefined &&
      values.length === 4 &&
      Number.isFinite(values[2]) &&
      Number.isFinite(values[3]) &&
      (values[2] ?? 0) > 0 &&
      (values[3] ?? 0) > 0
    ) {
      return { width: values[2], height: values[3] };
    }
  }

  const result = spawnSync(
    "sips",
    ["-g", "pixelWidth", "-g", "pixelHeight", filePath],
    { encoding: "utf8", stdio: "pipe" },
  );
  if (result.status === 0) {
    const width = Number(result.stdout.match(/pixelWidth:\s*(\d+)/)?.[1]);
    const height = Number(result.stdout.match(/pixelHeight:\s*(\d+)/)?.[1]);
    if (width > 0 && height > 0) {
      return { width, height };
    }
  }
  return null;
}

function readSvgNumber(svgTag, attribute) {
  const value = svgTag.match(
    new RegExp(`\\b${attribute}=["']([0-9.]+)(?:px)?["']`, "i"),
  )?.[1];
  const number = Number(value);
  return number > 0 ? number : null;
}

function posterKey(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .toLowerCase()
    .replace(/(?:[-_.]?poster)$/, "");
}

function optionalAvatar(index, avatars, sourceRoot, urlPrefix) {
  const avatar = avatars[index % avatars.length];
  return avatar === undefined
    ? {}
    : { authorIconSrc: toPublicUrl(avatar, sourceRoot, urlPrefix) };
}

function countFields(index) {
  const viewCount = viewCounts[index % viewCounts.length];
  return {
    viewCount,
    likeCount: Math.round(viewCount * 0.037),
    displaySeed: 310_000 + index,
  };
}

async function createPosts(assets, sourceRoot, urlPrefix) {
  const posts = [];
  const warnings = [];
  const usedIds = new Set();
  const postersByKey = new Map(
    assets.posters.map((poster) => [posterKey(poster), poster]),
  );

  for (const imagePath of assets.images) {
    const index = posts.length;
    const dimensions = await readImageDimensions(imagePath);
    if (dimensions === null) {
      warnings.push(`画像サイズを取得できませんでした: ${imagePath}`);
    }
    const name = displayName(imagePath);
    posts.push({
      id: createUniqueId("custom-image", imagePath, index, usedIds),
      authorName: "Custom Collection",
      authorHandle: "@custom_collection",
      ...optionalAvatar(index, assets.avatars, sourceRoot, urlPrefix),
      text: `${name}のカスタム画像投稿です。`,
      mediaType: "image",
      media: [
        {
          type: "image",
          src: toPublicUrl(imagePath, sourceRoot, urlPrefix),
          ...(dimensions ?? {}),
          alt: name,
        },
      ],
      ...countFields(index),
      tags: ["custom", "image"],
    });
  }

  for (const videoPath of assets.videos) {
    const index = posts.length;
    const key = posterKey(videoPath);
    const poster = postersByKey.get(key);
    const dimensions = poster === undefined ? null : await readImageDimensions(poster);
    if (poster === undefined) {
      warnings.push(`対応するポスターがありません: ${videoPath}`);
    } else if (dimensions === null) {
      warnings.push(`ポスターのサイズを取得できませんでした: ${poster}`);
    }
    const name = displayName(videoPath);
    posts.push({
      id: createUniqueId("custom-video", videoPath, index, usedIds),
      authorName: "Custom Collection",
      authorHandle: "@custom_collection",
      ...optionalAvatar(index, assets.avatars, sourceRoot, urlPrefix),
      text: `${name}のカスタム動画投稿です。`,
      mediaType: "video",
      media: [
        {
          type: "video",
          src: toPublicUrl(videoPath, sourceRoot, urlPrefix),
          ...(poster === undefined
            ? {}
            : { thumbnailSrc: toPublicUrl(poster, sourceRoot, urlPrefix) }),
          ...(dimensions ?? {}),
          alt: name,
        },
      ],
      ...countFields(index),
      tags: ["custom", "video"],
    });
  }

  for (const textPath of assets.texts) {
    const text = (await readFile(textPath, "utf8")).trim();
    if (text.length === 0) {
      warnings.push(`空のテキストファイルを除外しました: ${textPath}`);
      continue;
    }
    const index = posts.length;
    posts.push({
      id: createUniqueId("custom-text", textPath, index, usedIds),
      authorName: "Custom Collection",
      authorHandle: "@custom_collection",
      ...optionalAvatar(index, assets.avatars, sourceRoot, urlPrefix),
      text,
      mediaType: "text",
      media: [],
      ...countFields(index),
      tags: ["custom", "text"],
    });
  }

  return { posts, warnings };
}

async function main() {
  const options = readOptions(process.argv.slice(2));
  await Promise.all(
    ["images", "videos", "posters", "avatars", "texts"].map((directory) =>
      mkdir(path.join(options.source, directory), { recursive: true }),
    ),
  );
  const files = await collectFiles(options.source);
  const assets = classifyFiles(files, options.source);
  const { posts, warnings } = await createPosts(
    assets,
    options.source,
    options.urlPrefix,
  );

  if (posts.length === 0 && !options.allowEmpty) {
    throw new Error(
      [
        "対応素材が0件のため、JSONを上書きしませんでした。",
        `検索先: ${options.source}`,
        "images・videos・textsへ素材を配置してから再実行してください。",
        "空配列を意図的に生成する場合は--allow-emptyを指定してください。",
      ].join("\n"),
    );
  }

  await mkdir(path.dirname(options.output), { recursive: true });
  const temporaryOutput = `${options.output}.tmp`;
  await writeFile(temporaryOutput, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
  await rename(temporaryOutput, options.output);

  warnings.forEach((warning) => console.warn(`警告: ${warning}`));
  console.log("Fav Collection custom post generation complete");
  console.log(`画像投稿数: ${posts.filter((post) => post.mediaType === "image").length}`);
  console.log(`動画投稿数: ${posts.filter((post) => post.mediaType === "video").length}`);
  console.log(`テキスト投稿数: ${posts.filter((post) => post.mediaType === "text").length}`);
  console.log(`投稿合計: ${posts.length}`);
  console.log(`参照したアバター数: ${assets.avatars.length}`);
  console.log(`未使用ポスター数: ${Math.max(0, assets.posters.length - assets.videos.length)}`);
  console.log(`出力先: ${path.relative(repositoryRoot, options.output)}`);
}

main().catch((error) => {
  console.error(
    `カスタム投稿JSONの生成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
