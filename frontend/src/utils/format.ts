/** 通用格式化与日期工具 */

export function pad(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

/** Date → 'YYYY-MM-DD' */
export function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Date → 'YYYY-MM-DD HH:mm:ss' */
export function fmtDateTime(d: Date): string {
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 'YYYY-MM-DD' 字符串解析为本地 Date（避免 UTC 偏移） */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 两个 YYYY-MM-DD 之间的自然日差（a - b） */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86400000)
}

/** 今天 → 'YYYY-MM-DD' */
export function today(): string {
  return fmtDate(new Date())
}

/** 金额显示：保留两位小数 */
export function money(n: number): string {
  return '¥' + n.toFixed(2)
}

/** 逾期费用 = 逾期天数 × 日租金 × 1.5（PRD 3.5.3） */
export function overdueFee(overdueDays: number, dailyRent: number): number {
  if (overdueDays <= 0) return 0
  return Math.round(overdueDays * dailyRent * 1.5 * 100) / 100
}

/** 损坏赔偿 = 定价 × 赔偿比例（PRD 3.5.2） */
export function damageCompensation(price: number, ratio: number): number {
  return Math.round(price * ratio * 100) / 100
}

/** 生成业务单号：#B-YYYYMMDD-序号 */
export function borrowNo(borrowId: number, borrowDate: string): string {
  return `#B-${borrowDate.replace(/-/g, '')}-${String(borrowId).padStart(3, '0')}`
}
