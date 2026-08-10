export function renderLoadingView(container: HTMLElement): void {
  container.innerHTML = `
    <main class="status-shell" aria-labelledby="loading-title">
      <section class="status-card" aria-live="polite">
        <span class="loading-indicator" aria-hidden="true"></span>
        <p class="eyebrow">PREPARING THE COLLECTION</p>
        <h1 class="status-title" id="loading-title">読み込み中</h1>
        <p class="description">コレクションを読み込んでいます。</p>
      </section>
    </main>
  `;
}
