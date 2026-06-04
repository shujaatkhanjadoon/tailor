export async function mapConcurrent<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency = 10,
): Promise<string[]> {
  const errors: string[] = []
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency))
  }
  for (const chunk of chunks) {
    const results = await Promise.allSettled(chunk.map(fn))
    for (const r of results) {
      if (r.status === 'rejected') {
        errors.push(String(r.reason))
      }
    }
  }
  return errors
}
