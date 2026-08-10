import type { RequestedMode } from "../app/AppState";
import type { WebXRSupportStatus } from "../ar/WebXRSupport";

interface IntroViewOptions {
  requestedMode: RequestedMode;
  notice: string | null;
  arSupportStatus: WebXRSupportStatus;
  onStartAr: () => void;
  onStartPreview: () => void;
}

export function renderIntroView(
  container: HTMLElement,
  options: IntroViewOptions,
): void {
  const previewRequestMessage =
    options.requestedMode === "preview"
      ? '<p class="mode-note">URLから通常プレビューが指定されています。</p>'
      : "";
  const arStatus = getArStatus(options.arSupportStatus);
  container.innerHTML = `
    <main class="intro-shell">
      <section class="intro-card" aria-labelledby="app-title">
        <p class="eyebrow">A PERSONAL WUNDERKAMMER</p>
        <h1 id="app-title">驚異の部屋-私のSNS コレクション- : SNS 投稿の展示空間上への再配置による鑑賞体験の考察</h1>
        <p class="description">
          -
        </p>
        <p class="safety-notice">周囲を確認し、歩きながら画面だけを見続けないでください。</p>
        ${previewRequestMessage}
        <div class="actions" aria-label="起動方法">
          <button class="button button-primary" type="button" data-action="start-ar" ${arStatus.disabled ? "disabled" : ""}>
            ${arStatus.label}
          </button>
          <button class="button button-secondary" type="button" data-action="start-preview">
            通常プレビュー
          </button>
        </div>
        <p class="notice" role="status" aria-live="polite">${arStatus.message}</p>
      </section>
    </main>
  `;

  const arButton = container.querySelector<HTMLButtonElement>(
    '[data-action="start-ar"]',
  );
  const previewButton = container.querySelector<HTMLButtonElement>(
    '[data-action="start-preview"]',
  );
  const notice = container.querySelector<HTMLElement>(".notice");

  if (arButton === null || previewButton === null || notice === null) {
    throw new Error("Intro screen controls could not be created.");
  }

  if (options.notice !== null) {
    notice.textContent = options.notice;
  }
  arButton.addEventListener("click", options.onStartAr);
  previewButton.addEventListener("click", options.onStartPreview);
}

function getArStatus(status: WebXRSupportStatus): {
  readonly disabled: boolean;
  readonly label: string;
  readonly message: string;
} {
  switch (status) {
    case "checking":
      return {
        disabled: true,
        label: "AR対応を確認中",
        message: "この端末でWebXR ARを利用できるか確認しています。",
      };
    case "supported":
      return { disabled: false, label: "ARを開始", message: "" };
    case "unsupported":
      return {
        disabled: false,
        label: "簡易ARを開始",
        message: "WebXR非対応のため、カメラ上で壁面位置を手動設定する簡易ARを利用します。",
      };
    case "error":
      return {
        disabled: false,
        label: "簡易ARを開始",
        message: "WebXR対応を確認できないため、カメラを使う簡易ARを利用します。",
      };
  }
}
