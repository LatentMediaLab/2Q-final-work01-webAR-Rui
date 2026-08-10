import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const outputRoot = path.join(
  repositoryRoot,
  "public/assets/posts/placeholders",
);
const avatarRoot = path.join(outputRoot, "avatars");
const manifestPath = path.join(outputRoot, "generated-manifest.json");
const reportPath = path.join(outputRoot, "generation-report.json");
const postsOutputPath = path.join(
  repositoryRoot,
  "public/data/posts.placeholder.json",
);

const imageGroups = [
  {
    slug: "square",
    ratio: "1:1",
    width: 1200,
    height: 1200,
    count: 4,
    label: "正方形画像",
  },
  {
    slug: "landscape-16x9",
    ratio: "16:9",
    width: 1600,
    height: 900,
    count: 4,
    label: "横長画像",
  },
  {
    slug: "landscape-3x2",
    ratio: "3:2",
    width: 1500,
    height: 1000,
    count: 3,
    label: "横長画像",
  },
  {
    slug: "portrait-4x5",
    ratio: "4:5",
    width: 1000,
    height: 1250,
    count: 4,
    label: "縦長画像",
  },
  {
    slug: "portrait-9x16",
    ratio: "9:16",
    width: 900,
    height: 1600,
    count: 3,
    label: "縦長画像",
  },
  {
    slug: "extreme-wide-4x1",
    ratio: "4:1",
    width: 1800,
    height: 450,
    count: 1,
    label: "極端に横長",
  },
  {
    slug: "extreme-tall-1x4",
    ratio: "1:4",
    width: 450,
    height: 1800,
    count: 1,
    label: "極端に縦長",
  },
];

const videoSpecs = [
  {
    slug: "landscape-16x9-01",
    ratio: "16:9",
    width: 640,
    height: 360,
    label: "横動画",
  },
  {
    slug: "landscape-16x9-02",
    ratio: "16:9",
    width: 640,
    height: 360,
    label: "横動画",
  },
  {
    slug: "portrait-9x16-01",
    ratio: "9:16",
    width: 360,
    height: 640,
    label: "縦動画",
  },
  {
    slug: "portrait-9x16-02",
    ratio: "9:16",
    width: 360,
    height: 640,
    label: "縦動画",
  },
  {
    slug: "square-01",
    ratio: "1:1",
    width: 480,
    height: 480,
    label: "正方形動画",
  },
];

const palettes = [
  ["#211b2f", "#d77b55", "#f1c875", "#8eb9ad"],
  ["#142b2a", "#65a89b", "#e4b363", "#f2e8cf"],
  ["#2b1f18", "#bd744b", "#d4bd83", "#577a79"],
  ["#17243b", "#6f8fba", "#d9a15b", "#efe5d0"],
  ["#30202e", "#b9657a", "#e3bd70", "#7fa5a0"],
  ["#1e2c21", "#86a96a", "#d4875a", "#e8d9b4"],
  ["#272527", "#b18a59", "#718c91", "#eee5d2"],
  ["#1b2630", "#4f879a", "#d17b5f", "#e9c97e"],
];

const avatarInitials = ["A1", "B2", "C3", "D4", "E5", "F6", "G7", "H8"];
const generatedFiles = [];

function pad(value) {
  return String(value).padStart(2, "0");
}

function publicPath(relativePath) {
  return `/assets/posts/placeholders/${relativePath.split(path.sep).join("/")}`;
}

function commandExists(command) {
  const result = spawnSync(command, ["-version"], {
    encoding: "utf8",
    stdio: "pipe",
  });
  return result.status === 0;
}

function isSafeGeneratedPath(relativePath) {
  if (typeof relativePath !== "string" || path.isAbsolute(relativePath)) {
    return false;
  }

  const normalized = path.normalize(relativePath);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`);
}

async function removePreviouslyGeneratedFiles() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    return;
  }

  if (!Array.isArray(manifest.files)) {
    return;
  }

  await Promise.all(
    manifest.files
      .filter(isSafeGeneratedPath)
      .map((relativePath) => rm(path.join(outputRoot, relativePath), { force: true })),
  );
}

async function writeGeneratedFile(relativePath, contents) {
  const targetPath = path.join(outputRoot, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, contents);
  generatedFiles.push(relativePath);
  return targetPath;
}

function makePattern(index, accentColor) {
  const variant = index % 4;
  if (variant === 0) {
    return `<pattern id="pattern" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M0 72 72 0M-18 18 18-18M54 90 90 54" stroke="${accentColor}" stroke-width="5" opacity=".2"/></pattern>`;
  }
  if (variant === 1) {
    return `<pattern id="pattern" width="84" height="84" patternUnits="userSpaceOnUse"><circle cx="14" cy="14" r="7" fill="${accentColor}" opacity=".22"/><circle cx="56" cy="56" r="3" fill="${accentColor}" opacity=".32"/></pattern>`;
  }
  if (variant === 2) {
    return `<pattern id="pattern" width="96" height="96" patternUnits="userSpaceOnUse"><path d="M0 0H96V96H0Z M24 0V96M72 0V96M0 24H96M0 72H96" fill="none" stroke="${accentColor}" stroke-width="3" opacity=".16"/></pattern>`;
  }
  return `<pattern id="pattern" width="90" height="90" patternUnits="userSpaceOnUse"><path d="m45 6 34 39-34 39L11 45Z" fill="none" stroke="${accentColor}" stroke-width="4" opacity=".18"/></pattern>`;
}

function makeImageSvg(spec, imageNumber) {
  const [background, accent, secondary, textColor] =
    palettes[(imageNumber - 1) % palettes.length];
  const shortestSide = Math.min(spec.width, spec.height);
  const margin = Math.max(32, Math.round(shortestSide * 0.065));
  const titleSize = Math.max(32, Math.round(shortestSide * 0.075));
  const metaSize = Math.max(20, Math.round(titleSize * 0.48));
  const alignRight = imageNumber % 2 === 0;
  const textX = alignRight ? spec.width - margin : margin;
  const textAnchor = alignRight ? "end" : "start";
  const circleRadius = Math.round(shortestSide * (0.16 + (imageNumber % 3) * 0.025));
  const circleX = Math.round(spec.width * (0.28 + (imageNumber % 4) * 0.12));
  const circleY = Math.round(spec.height * (0.34 + (imageNumber % 3) * 0.13));
  const rectangleWidth = Math.round(spec.width * 0.3);
  const rectangleHeight = Math.round(spec.height * 0.24);
  const rectangleX = Math.round(spec.width * (0.58 - (imageNumber % 2) * 0.2));
  const rectangleY = Math.round(spec.height * (0.52 - (imageNumber % 3) * 0.08));
  const gradientAngle = imageNumber % 2 === 0 ? "0%" : "100%";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}" role="img" aria-labelledby="title desc">
  <title id="title">IMAGE ${pad(imageNumber)} ${spec.ratio}</title>
  <desc id="desc">${spec.label}のテスト用幾何学プレースホルダー</desc>
  <defs>
    <linearGradient id="background" x1="0%" y1="0%" x2="${gradientAngle}" y2="100%">
      <stop offset="0%" stop-color="${background}"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
    ${makePattern(imageNumber, textColor)}
  </defs>
  <rect width="${spec.width}" height="${spec.height}" fill="url(#background)"/>
  <rect width="${spec.width}" height="${spec.height}" fill="url(#pattern)"/>
  <rect x="${margin}" y="${margin}" width="${spec.width - margin * 2}" height="${spec.height - margin * 2}" fill="none" stroke="${textColor}" stroke-width="${Math.max(3, Math.round(shortestSide * 0.006))}"/>
  <circle cx="${circleX}" cy="${circleY}" r="${circleRadius}" fill="none" stroke="${secondary}" stroke-width="${Math.max(10, Math.round(shortestSide * 0.025))}"/>
  <rect x="${rectangleX}" y="${rectangleY}" width="${rectangleWidth}" height="${rectangleHeight}" fill="${secondary}" opacity=".78" transform="rotate(${(imageNumber % 5) * 6 - 12} ${rectangleX + rectangleWidth / 2} ${rectangleY + rectangleHeight / 2})"/>
  <path d="M${margin} ${Math.round(spec.height * 0.72)} Q${Math.round(spec.width * 0.5)} ${Math.round(spec.height * (0.56 + (imageNumber % 3) * 0.08))} ${spec.width - margin} ${Math.round(spec.height * 0.72)}" fill="none" stroke="${textColor}" stroke-width="${Math.max(5, Math.round(shortestSide * 0.012))}" stroke-dasharray="${Math.max(14, Math.round(shortestSide * 0.035))} ${Math.max(10, Math.round(shortestSide * 0.022))}" opacity=".8"/>
  <g fill="${textColor}" font-family="Arial, 'Hiragino Sans', 'Yu Gothic', sans-serif" text-anchor="${textAnchor}">
    <text x="${textX}" y="${margin + titleSize}" font-size="${titleSize}" font-weight="700" letter-spacing="${Math.max(2, Math.round(titleSize * 0.08))}">IMAGE ${pad(imageNumber)}</text>
    <text x="${textX}" y="${margin + titleSize + metaSize * 1.5}" font-size="${metaSize}">${spec.ratio} / ${spec.width} × ${spec.height}</text>
    <text x="${textX}" y="${spec.height - margin - metaSize * 0.25}" font-size="${metaSize}">${spec.label}・余白確認用</text>
  </g>
</svg>
`;
}

function makeAvatarSvg(index) {
  const [background, accent, secondary, textColor] = palettes[index % palettes.length];
  const rotation = index * 17;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-labelledby="title desc">
  <title id="title">Avatar ${pad(index + 1)}</title>
  <desc id="desc">イニシャルと幾何学形で構成した架空作者アイコン</desc>
  <rect width="256" height="256" rx="40" fill="${background}"/>
  <circle cx="128" cy="128" r="92" fill="none" stroke="${accent}" stroke-width="14" stroke-dasharray="${32 + index * 3} ${14 + index}" transform="rotate(${rotation} 128 128)"/>
  <path d="M128 28 222 190 34 190Z" fill="${secondary}" opacity=".42" transform="rotate(${rotation / 2} 128 128)"/>
  <text x="128" y="151" fill="${textColor}" font-family="Arial, sans-serif" font-size="64" font-weight="700" text-anchor="middle">${avatarInitials[index]}</text>
</svg>
`;
}

function makeVideoPosterSvg(spec, videoNumber) {
  const [background, accent, secondary, textColor] =
    palettes[(videoNumber + 2) % palettes.length];
  const shortestSide = Math.min(spec.width, spec.height);
  const titleSize = Math.max(28, Math.round(shortestSide * 0.1));
  const metaSize = Math.max(18, Math.round(titleSize * 0.52));
  const border = Math.max(20, Math.round(shortestSide * 0.07));
  const playRadius = Math.max(38, Math.round(shortestSide * 0.16));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}" role="img" aria-labelledby="title desc">
  <title id="title">VIDEO ${pad(videoNumber)} poster</title>
  <desc id="desc">${spec.label}の動画サムネイル</desc>
  <defs>
    <linearGradient id="video-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${background}"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
    ${makePattern(videoNumber + 10, textColor)}
  </defs>
  <rect width="${spec.width}" height="${spec.height}" fill="url(#video-bg)"/>
  <rect width="${spec.width}" height="${spec.height}" fill="url(#pattern)"/>
  <rect x="${border}" y="${border}" width="${spec.width - border * 2}" height="${spec.height - border * 2}" fill="none" stroke="${textColor}" stroke-width="4"/>
  <circle cx="${spec.width / 2}" cy="${spec.height / 2}" r="${playRadius}" fill="${secondary}" opacity=".92"/>
  <path d="M${spec.width / 2 - playRadius * 0.25} ${spec.height / 2 - playRadius * 0.45} L${spec.width / 2 + playRadius * 0.5} ${spec.height / 2} L${spec.width / 2 - playRadius * 0.25} ${spec.height / 2 + playRadius * 0.45}Z" fill="${background}"/>
  <g fill="${textColor}" font-family="Arial, 'Hiragino Sans', 'Yu Gothic', sans-serif" text-anchor="middle">
    <text x="${spec.width / 2}" y="${border + titleSize}" font-size="${titleSize}" font-weight="700">VIDEO ${pad(videoNumber)}</text>
    <text x="${spec.width / 2}" y="${spec.height - border - metaSize * 1.2}" font-size="${metaSize}">${spec.ratio} / ${spec.width} × ${spec.height}</text>
    <text x="${spec.width / 2}" y="${spec.height - border}" font-size="${metaSize * 0.72}">${spec.label}・無音ループ確認用</text>
  </g>
</svg>
`;
}

async function convertSvgToPng(svgPath, pngPath, ffmpegAvailable) {
  if (!ffmpegAvailable) {
    return false;
  }

  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      svgPath,
      "-frames:v",
      "1",
      pngPath,
    ],
    { encoding: "utf8", stdio: "pipe" },
  );

  if (result.status !== 0) {
    await rm(pngPath, { force: true });
    return false;
  }

  generatedFiles.push(path.relative(outputRoot, pngPath));
  return true;
}

async function generateVideo(spec, videoNumber, ffmpegAvailable) {
  if (!ffmpegAvailable) {
    return {
      generated: false,
      relativePath: `video-${spec.slug}.mp4`,
      format: null,
      reason: "ffmpegが見つからないため動画生成をスキップしました。",
    };
  }

  const duration = 4;
  const boxSize = Math.max(54, Math.round(Math.min(spec.width, spec.height) * 0.2));
  const travel = spec.width + boxSize;
  const speed = travel / duration;
  const titleSize = Math.max(24, Math.round(Math.min(spec.width, spec.height) * 0.085));
  const filter = [
    `drawgrid=width=${Math.max(40, Math.round(spec.width / 8))}:height=${Math.max(40, Math.round(spec.height / 8))}:color=white@0.12:thickness=1`,
    `drawbox=x='-${boxSize}+mod(t*${speed.toFixed(3)}\\,${travel})':y=${Math.round((spec.height - boxSize) / 2)}:w=${boxSize}:h=${boxSize}:color=0xe3b96f:t=fill`,
    `drawtext=text='VIDEO ${pad(videoNumber)}':fontcolor=white:fontsize=${titleSize}:x=(w-text_w)/2:y=${Math.max(20, Math.round(spec.height * 0.1))}`,
    `drawtext=text='${spec.ratio}  ${spec.width}x${spec.height}':fontcolor=white:fontsize=${Math.max(16, Math.round(titleSize * 0.48))}:x=(w-text_w)/2:y=h-${Math.max(34, Math.round(spec.height * 0.11))}`,
  ].join(",");
  const compatibilityFilter = [
    `drawgrid=width=${Math.max(40, Math.round(spec.width / 8))}:height=${Math.max(40, Math.round(spec.height / 8))}:color=white@0.12:thickness=1`,
    `drawbox=x='-${boxSize}+mod(t*${speed.toFixed(3)}\\,${travel})':y=${Math.round((spec.height - boxSize) / 2)}:w=${boxSize}:h=${boxSize}:color=0xe3b96f:t=fill`,
  ].join(",");
  const input = `color=c=0x1a2428:s=${spec.width}x${spec.height}:r=24:d=${duration}`;

  const attempts = [
    {
      extension: "mp4",
      format: "MP4/H.264",
      codecArgs: [
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "30",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
      ],
    },
    {
      extension: "mp4",
      format: "MP4/OpenH264互換",
      filter: compatibilityFilter,
      codecArgs: [
        "-c:v",
        "libopenh264",
        "-b:v",
        "350k",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
      ],
    },
    {
      extension: "webm",
      format: "WebM/VP9",
      codecArgs: [
        "-c:v",
        "libvpx-vp9",
        "-crf",
        "38",
        "-b:v",
        "0",
        "-pix_fmt",
        "yuv420p",
      ],
    },
  ];
  const errors = [];

  for (const attempt of attempts) {
    const relativePath = `video-${spec.slug}.${attempt.extension}`;
    const targetPath = path.join(outputRoot, relativePath);
    const result = spawnSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        input,
        "-vf",
        attempt.filter ?? filter,
        "-t",
        String(duration),
        "-an",
        ...attempt.codecArgs,
        targetPath,
      ],
      { encoding: "utf8", stdio: "pipe" },
    );

    if (result.status === 0) {
      generatedFiles.push(relativePath);
      return {
        generated: true,
        relativePath,
        format: attempt.format,
        reason: null,
      };
    }

    await rm(targetPath, { force: true });
    errors.push(`${attempt.format}: ${result.stderr.trim() || "生成に失敗"}`);
  }

  return {
    generated: false,
    relativePath: `video-${spec.slug}.mp4`,
    format: null,
    reason: errors.join(" / "),
  };
}

function addOptionalPostFields(post, index, avatarPaths, viewCounts) {
  if (index % 7 !== 4) {
    post.viewCount = viewCounts[index % viewCounts.length];
  }
  if (index % 6 !== 2) {
    post.likeCount = Math.round((post.viewCount ?? 2500) * 0.037);
  }
  if (index % 8 !== 3) {
    post.authorIconSrc = avatarPaths[index % avatarPaths.length];
  }
  if (index % 5 !== 1) {
    post.postUrl = `/placeholder/posts/${post.id}`;
  }
  post.repostCount = Math.round((post.viewCount ?? 900) * 0.004);
  post.displaySeed = 202600 + index;
  return post;
}

function createPosts(imageAssets, videoAssets, avatarPaths) {
  const viewCounts = [
    10,
    100,
    1000,
    10000,
    100000,
    1000000,
    10000000,
    10000,
    0,
    100,
  ];

  // 50件表示時も生成ファイル自体は増やさず、複数投稿から同じ軽量素材を
  // 参照する。アプリ側のテクスチャ共有も同時に検証できるデータ構成にする。
  const imagePostAssets = [...imageAssets, ...imageAssets.slice(0, 12)];
  const imagePosts = imagePostAssets.map((asset, index) => {
    const sourceNumber = (index % imageAssets.length) + 1;
    return addOptionalPostFields(
      {
        id: `placeholder-image-${pad(index + 1)}`,
        authorName: `架空収集家 ${pad((index % 8) + 1)}`,
        authorHandle: `@placeholder_${pad((index % 8) + 1)}`,
        text: `${asset.label} ${asset.ratio} の額縁・余白・アスペクト比確認用投稿です。展示密度の確認番号は${pad(index + 1)}です。`,
        mediaType: "image",
        media: [
          {
            type: "image",
            src: asset.src,
            width: asset.width,
            height: asset.height,
            alt: `IMAGE ${pad(sourceNumber)} ${asset.ratio} ${asset.label}`,
          },
        ],
        postedAt: `2026-01-${pad((index % 20) + 1)}T10:00:00+09:00`,
        likedAt: `2026-02-${pad((index % 20) + 1)}T12:00:00+09:00`,
        tags: ["placeholder", "image", asset.ratio],
      },
      index,
      avatarPaths,
      viewCounts,
    );
  });

  const textSamples = [
    "短文テスト：小さな記憶を一つ保存。〈01〉",
    "Medium text / 中程度の文章です。日本語と English words を混在させ、文字幅と折り返しの違いを確認します。",
    "これは長文日本語の表示確認用に作成した架空文章です。展示空間の中で文字がどの程度の長さまで読み取れるか、改行を含む場合にテクスチャやレイアウトへどのような影響が出るかを確認します。\n二段落目では、収集・分類・再配置という架空の行為について説明し、実在する投稿内容には依存しません。",
    "絵文字と記号の確認 🪐📚✨ ／ ☆ → ※ 【仮】 #placeholder & symbols!",
    "非常に長い一行テキストの確認用です。この文章は途中に改行を入れず、同じ速度で壁面を移動する際の横幅、CanvasTextureの必要寸法、読みやすさ、ループ開始位置、英数字TEST-2026と日本語が連続した場合のフォントフォールバックを検証するためだけに作られた完全な架空文章であり、実在する人物やサービス上の投稿を参照していません。",
    "余白と密度の確認：小さな展示片が、隣の収集物の輪郭を邪魔せずに流れるかを観察します。",
    "Line one for a fictional archive.\n二行目は日本語の表示確認です。\nThird line: 123 / ABC / △○□",
    "記号列テスト｜01→02→03｜『架空の断片』｜…！？ #50posts 🧭",
  ];

  const textPosts = textSamples.map((text, index) =>
    addOptionalPostFields(
      {
        id: `placeholder-text-${pad(index + 1)}`,
        authorName: `架空テキスト作者 ${pad(index + 1)}`,
        authorHandle: `@placeholder_text_${pad(index + 1)}`,
        text,
        mediaType: "text",
        media: [],
        tags: ["placeholder", "text"],
      },
      imagePosts.length + index,
      avatarPaths,
      viewCounts,
    ),
  );

  const videoPostAssets = [...videoAssets, ...videoAssets.slice(0, 3)];
  const videoPosts = videoPostAssets.map((asset, index) => {
    const sourceNumber = (index % videoAssets.length) + 1;
    return addOptionalPostFields(
      {
        id: `placeholder-video-${pad(index + 1)}`,
        authorName: `架空映像作者 ${pad(index + 1)}`,
        authorHandle: `@placeholder_video_${pad(index + 1)}`,
        text: `VIDEO ${pad(sourceNumber)} ${asset.ratio} の無音ループとサムネイル確認用です。展示密度の確認番号は${pad(index + 1)}です。`,
        mediaType: "video",
        media: [
          {
            type: "video",
            src: asset.src,
            thumbnailSrc: asset.thumbnailSrc,
            width: asset.width,
            height: asset.height,
            alt: `VIDEO ${pad(sourceNumber)} ${asset.ratio} ${asset.label}`,
          },
        ],
        tags: ["placeholder", "video", asset.ratio],
      },
      imagePosts.length + textPosts.length + index,
      avatarPaths,
      viewCounts,
    );
  });

  const errorPosts = [
    {
      id: "placeholder-error-image-01",
      authorName: "架空エラー確認",
      authorHandle: "@placeholder_error",
      authorIconSrc: avatarPaths[0],
      text: "存在しない画像を参照し、画像フォールバックを確認する投稿です。",
      mediaType: "image",
      media: [
        {
          type: "image",
          src: "/assets/posts/placeholders/missing/image-does-not-exist.png",
          width: 1200,
          height: 800,
          alt: "意図的に存在しない画像",
        },
      ],
      viewCount: 10000,
      likeCount: 100,
      tags: ["placeholder", "intentional-error", "missing-image"],
      displaySeed: 202631,
    },
    {
      id: "placeholder-error-video-01",
      authorName: "架空エラー確認",
      authorHandle: "@placeholder_error",
      text: "存在しない動画とサムネイルを参照し、動画フォールバックを確認する投稿です。",
      mediaType: "video",
      media: [
        {
          type: "video",
          src: "/assets/posts/placeholders/missing/video-does-not-exist.mp4",
          thumbnailSrc:
            "/assets/posts/placeholders/missing/video-poster-does-not-exist.png",
          width: 640,
          height: 360,
          alt: "意図的に存在しない動画とサムネイル",
        },
      ],
      viewCount: 10000,
      tags: ["placeholder", "intentional-error", "missing-video"],
      displaySeed: 202632,
    },
  ];

  return [...imagePosts, ...textPosts, ...videoPosts, ...errorPosts];
}

async function main() {
  await mkdir(avatarRoot, { recursive: true });
  await removePreviouslyGeneratedFiles();

  const ffmpegAvailable = commandExists("ffmpeg");
  const imageAssets = [];
  const avatarPaths = [];
  const videoAssets = [];
  let imageNumber = 1;
  let generatedPngCount = 0;

  for (const group of imageGroups) {
    for (let itemIndex = 1; itemIndex <= group.count; itemIndex += 1) {
      const baseName = `image-${group.slug}-${pad(itemIndex)}`;
      const svgRelativePath = `${baseName}.svg`;
      const svgPath = await writeGeneratedFile(
        svgRelativePath,
        makeImageSvg(group, imageNumber),
      );
      const pngRelativePath = `${baseName}.png`;
      const pngPath = path.join(outputRoot, pngRelativePath);
      const pngGenerated = await convertSvgToPng(
        svgPath,
        pngPath,
        ffmpegAvailable,
      );

      if (pngGenerated) {
        generatedPngCount += 1;
      }

      imageAssets.push({
        ...group,
        src: publicPath(pngGenerated ? pngRelativePath : svgRelativePath),
      });
      imageNumber += 1;
    }
  }

  for (let index = 0; index < avatarInitials.length; index += 1) {
    const relativePath = `avatars/avatar-${pad(index + 1)}.svg`;
    await writeGeneratedFile(relativePath, makeAvatarSvg(index));
    avatarPaths.push(publicPath(relativePath));
  }

  const videoResults = [];
  let generatedPosterPngCount = 0;

  for (let index = 0; index < videoSpecs.length; index += 1) {
    const spec = videoSpecs[index];
    const baseName = `video-${spec.slug}-poster`;
    const posterSvgRelativePath = `${baseName}.svg`;
    const posterSvgPath = await writeGeneratedFile(
      posterSvgRelativePath,
      makeVideoPosterSvg(spec, index + 1),
    );
    const posterPngRelativePath = `${baseName}.png`;
    const posterPngPath = path.join(outputRoot, posterPngRelativePath);
    const posterPngGenerated = await convertSvgToPng(
      posterSvgPath,
      posterPngPath,
      ffmpegAvailable,
    );

    if (posterPngGenerated) {
      generatedPosterPngCount += 1;
    }

    const videoResult = await generateVideo(spec, index + 1, ffmpegAvailable);
    videoResults.push(videoResult);
    videoAssets.push({
      ...spec,
      src: publicPath(videoResult.relativePath),
      thumbnailSrc: publicPath(
        posterPngGenerated ? posterPngRelativePath : posterSvgRelativePath,
      ),
    });
  }

  const posts = createPosts(imageAssets, videoAssets, avatarPaths);
  await writeFile(postsOutputPath, `${JSON.stringify(posts, null, 2)}\n`);

  const generatedVideoCount = videoResults.filter((result) => result.generated).length;
  const skippedReasons = videoResults
    .filter((result) => !result.generated)
    .map((result) => result.reason)
    .filter((reason, index, reasons) => reason !== null && reasons.indexOf(reason) === index);
  const report = {
    generatedAt: new Date().toISOString(),
    ffmpegAvailable,
    images: {
      logicalCount: imageAssets.length,
      svgCount: imageAssets.length,
      pngCount: generatedPngCount,
    },
    videos: {
      requestedCount: videoSpecs.length,
      generatedCount: generatedVideoCount,
      formats: videoResults
        .map((result) => result.format)
        .filter((format) => format !== null),
      skipped: generatedVideoCount < videoSpecs.length,
      skippedReasons,
    },
    thumbnails: {
      logicalCount: videoSpecs.length,
      svgCount: videoSpecs.length,
      pngCount: generatedPosterPngCount,
    },
    avatars: avatarPaths.length,
    posts: posts.length,
    outputRoot: path.relative(repositoryRoot, outputRoot),
    postsOutput: path.relative(repositoryRoot, postsOutputPath),
  };

  await writeGeneratedFile(
    path.basename(reportPath),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await writeFile(
    manifestPath,
    `${JSON.stringify({ version: 1, files: generatedFiles.sort() }, null, 2)}\n`,
  );

  console.log("Fav Collection placeholder generation complete");
  console.log(`生成した画像数: ${imageAssets.length} (SVG ${imageAssets.length}, PNG ${generatedPngCount})`);
  console.log(`生成した動画数: ${generatedVideoCount} / ${videoSpecs.length}`);
  console.log(`生成したサムネイル数: ${videoSpecs.length} (SVG ${videoSpecs.length}, PNG ${generatedPosterPngCount})`);
  console.log(`生成したアイコン数: ${avatarPaths.length}`);
  console.log(`生成した投稿数: ${posts.length}`);
  console.log(`動画生成をスキップしたか: ${generatedVideoCount < videoSpecs.length ? "はい" : "いいえ"}`);
  if (skippedReasons.length > 0) {
    console.log(`スキップ理由: ${skippedReasons.join(" / ")}`);
  }
  console.log(`素材出力先: ${path.relative(repositoryRoot, outputRoot)}`);
  console.log(`投稿JSON: ${path.relative(repositoryRoot, postsOutputPath)}`);
}

await main();
