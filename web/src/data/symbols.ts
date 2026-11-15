// BIST 30 ve BIST 100 listeleri. Yahoo'da endeks bileşen listesi yok;
// listeler Aşama 4'te bu dosyaya elle girilecek (hisse kodları, .IS eki olmadan).
export type ListKey = "BIST30" | "BIST100";

export const SYMBOL_LISTS: Record<ListKey, string[]> = {
  BIST30: [],
  BIST100: [],
};
