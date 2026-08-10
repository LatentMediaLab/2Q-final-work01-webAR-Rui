export async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  const workerCount = Math.min(
    items.length,
    Math.max(1, Math.floor(concurrency)),
  );
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item !== undefined) {
        await task(item, index);
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
}
