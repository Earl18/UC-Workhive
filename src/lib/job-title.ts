export function normalizeJobTitle(title: string) {
  return title.normalize("NFKC").toLowerCase().replace(/[\s_-]+/g, "");
}
