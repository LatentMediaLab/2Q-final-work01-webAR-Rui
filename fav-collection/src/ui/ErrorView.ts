import type { RecoveryOption } from "../app/ErrorRecovery";

interface ErrorViewOptions {
  title: string;
  message: string;
  recoveryOptions: readonly RecoveryOption[];
  onRecover: (option: RecoveryOption) => void;
}

export function renderErrorView(
  container: HTMLElement,
  options: ErrorViewOptions,
): void {
  container.innerHTML = `
    <main class="status-shell" aria-labelledby="error-title">
      <section class="status-card">
        <p class="eyebrow">COLLECTION UNAVAILABLE</p>
        <h1 class="status-title" id="error-title"></h1>
        <p class="description" data-error-message></p>
        <div class="actions" data-recovery-actions></div>
      </section>
    </main>
  `;

  const title = container.querySelector<HTMLElement>("#error-title");
  const message = container.querySelector<HTMLElement>("[data-error-message]");
  const actions = container.querySelector<HTMLElement>(
    "[data-recovery-actions]",
  );

  if (
    title === null ||
    message === null ||
    actions === null
  ) {
    throw new Error("Error screen controls could not be created.");
  }

  title.textContent = options.title;
  message.textContent = options.message;
  options.recoveryOptions.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = `button ${index === 0 ? "button-primary" : "button-secondary"}`;
    button.type = "button";
    button.textContent = option.label;
    button.addEventListener("click", () => options.onRecover(option));
    actions.append(button);
  });
  actions.querySelector<HTMLButtonElement>("button")?.focus();
}
