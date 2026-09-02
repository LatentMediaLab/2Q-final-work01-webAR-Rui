import type { RequestedMode } from "../app/AppState";
import type { WebXRSupportStatus } from "../ar/WebXRSupport";

interface IntroViewOptions {
  requestedMode: RequestedMode;
  notice: string | null;
  arSupportStatus: WebXRSupportStatus;
  onStartAr: () => void;
  onStartPreview: () => void;
}

// タイトルカードの主要文言は、ここだけで差し替えられます。
export const FEED_COPY = {
  profileName: "驚異の部屋</br>-私のSNS コレクション-",
  profileHandle: "@fav_collection",
  profileBio: "SNS 投稿の展示空間上への再配置による鑑賞体験の考察",
  viewLikes: "いいねした投稿を見る",
  viewLikesHint: "保存した投稿を空間に並べて眺める",
  startPreview: "プレビュー表示",
} as const;

export function renderIntroView(
  container: HTMLElement,
  options: IntroViewOptions,
): void {
  const arStatus = getArStatus(options.arSupportStatus);
  const previewRequestMessage =
    options.requestedMode === "preview"
      ? '<p class="title-mode-note">URLから空間表示が指定されています。</p>'
      : "";

  container.innerHTML = `
    <main class="title-shell" data-title-shell>
      <section class="title-profile" aria-labelledby="title-profile-name">
        <div class="title-profile-cover" aria-hidden="true"></div>
        <div class="title-profile-body">
          <span class="title-profile-avatar" aria-hidden="true"></span>
          <h1 id="title-profile-name">${FEED_COPY.profileName}</h1>
          <p class="title-profile-handle">${FEED_COPY.profileHandle}</p>
          <p class="title-profile-bio">${FEED_COPY.profileBio}</p>
          <div class="title-view-tabs" role="tablist" aria-label="投稿表示の切り替えイメージ">
            <span class="title-view-tab" role="tab" aria-selected="false" aria-disabled="true">
              ${postIcon()}<span>投稿</span>
            </span>
            <span class="title-view-tab" role="tab" aria-selected="false" aria-disabled="true">
              ${replyIcon()}<span>返信</span>
            </span>
            <span class="title-view-tab" role="tab" aria-selected="false" aria-disabled="true">
              ${mediaIcon()}<span>メディア</span>
            </span>
            <span class="title-view-tab title-view-tab-active" role="tab" aria-selected="true" aria-disabled="true">
              ${heartIcon()}<span>いいね</span>
            </span>
          </div>
          ${previewRequestMessage}
          <div class="title-actions">
            <button class="title-likes-button" type="button" data-action="view-likes" ${arStatus.disabled ? "disabled" : ""}>
              <span>${FEED_COPY.viewLikes}</span>
              <small>${FEED_COPY.viewLikesHint}</small>
            </button>
            <button class="title-preview-button" type="button" data-action="start-preview">
              ${FEED_COPY.startPreview}
            </button>
          </div>
          <p class="title-ar-status" role="status" aria-live="polite">${options.notice ?? arStatus.message}</p>
        </div>
      </section>
    </main>
  `;

  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  const titleShell = requireElement<HTMLElement>(container, "[data-title-shell]");
  const likesButton = requireElement<HTMLButtonElement>(container, '[data-action="view-likes"]');
  const previewButton = requireElement<HTMLButtonElement>(container, '[data-action="start-preview"]');

  let transitionStarted = false;
  likesButton.addEventListener("click", () => {
    if (transitionStarted) {
      return;
    }
    transitionStarted = true;
    likesButton.disabled = true;
    previewButton.disabled = true;
    titleShell.classList.add("title-shell-leaving");
    // WebXRのユーザー操作判定を保つため、AR開始はクリックイベント内で直接呼び出します。
    options.onStartAr();
  });
  previewButton.addEventListener("click", () => {
    if (transitionStarted) {
      return;
    }
    transitionStarted = true;
    likesButton.disabled = true;
    previewButton.disabled = true;
    titleShell.classList.add("title-shell-leaving");
    window.setTimeout(options.onStartPreview, 180);
  });
}

function getArStatus(status: WebXRSupportStatus): {
  readonly disabled: boolean;
  readonly message: string;
} {
  switch (status) {
    case "checking":
      return {
        disabled: true,
        message: "この端末のAR対応を確認しています。",
      };
    case "supported":
      return { disabled: false, message: "" };
    case "unsupported":
      return {
        disabled: false,
        message: "この端末では簡易ARを利用します。",
      };
    case "error":
      return {
        disabled: false,
        message: "AR対応を確認できないため簡易ARを利用します。",
      };
  }
}

function icon(path: string, filled = false): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" ${filled ? 'fill="currentColor"' : 'fill="none"'} stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

function postIcon(): string {
  return icon('<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9h16M9 9v11"/>');
}

function replyIcon(): string {
  return icon('<path d="M9 17 4 12l5-5"/><path d="M4 12h9a7 7 0 0 1 7 7"/>');
}

function mediaIcon(): string {
  return icon('<rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="8.5" cy="10" r="1.5"/><path d="m4 17 5-4 3 2 3-3 5 5"/>');
}

function heartIcon(): string {
  return icon('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z"/>', true);
}

function requireElement<T extends Element>(
  container: HTMLElement,
  selector: string,
): T {
  const element = container.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Title screen element was not found: ${selector}`);
  }
  return element;
}
