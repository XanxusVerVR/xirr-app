/**
 * amount 的字串形式。用來在「程式設定金額」的路徑上初始化 amountText
 * （空表單、載入範例、套用 YAML），使它與 amount 一致。
 * 使用者親手輸入的路徑不走這裡——那裡要原封不動保留使用者打的字。
 */
export function amountToText(amount: number | null): string {
  return amount === null ? '' : String(amount);
}
