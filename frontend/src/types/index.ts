/** 领域类型定义 — 与 PRD 第 5 章数据模型一一对应 */

export type UserRole = 'user' | 'admin'
export type UserStatus = 'active' | 'frozen' | 'deleted'
export type BookStatus = 'available' | 'borrowed' | 'repairing' | 'lost'
export type BorrowStatus = 'borrowed' | 'returned' | 'overdue'
export type FineType = 'overdue' | 'damage' | 'loss'
export type FineStatus = 'unpaid' | 'paid'
export type DamageLevel = 'none' | 'minor' | 'moderate' | 'severe' | 'lost'

/** users 用户表（5.1） */
export interface User {
  userId: number
  username: string
  password: string // 模拟环境明文存储，真实系统应使用 bcrypt
  phone: string
  email: string
  role: UserRole
  status: UserStatus
  createdAt: string // YYYY-MM-DD HH:mm:ss
}

/** books 图书表（5.2） */
export interface Book {
  bookId: number
  title: string
  author: string
  isbn: string
  category: string // 武侠/言情/科幻/悬疑/历史
  price: number // 定价
  dailyRent: number // 日租金
  deposit: number // 押金
  status: BookStatus
  location: string // 书架位置
  createdAt: string
}

/** borrow_records 借阅记录表（5.3） */
export interface BorrowRecord {
  borrowId: number
  userId: number
  bookId: number
  borrowDate: string // YYYY-MM-DD
  dueDate: string // YYYY-MM-DD
  actualReturnDate: string | null
  dailyRate: number
  deposit: number
  status: BorrowStatus
  createdAt: string
}

/** fines 费用记录表（5.4） */
export interface Fine {
  fineId: number
  borrowId: number
  userId: number
  amount: number
  type: FineType
  status: FineStatus
  createdAt: string
}

/** damage_records 损坏记录表（5.5） */
export interface DamageRecord {
  recordId: number
  borrowId: number
  bookId: number
  damageLevel: DamageLevel
  compensation: number
  description: string
  createdAt: string
}

/** 损坏等级配置（PRD 3.5.2） */
export const DAMAGE_LEVELS: Record<DamageLevel, { label: string; ratio: number; desc: string }> = {
  none: { label: '完好', ratio: 0, desc: '完好无损' },
  minor: { label: '轻微', ratio: 0.1, desc: '书页折角、轻微污渍' },
  moderate: { label: '中度', ratio: 0.3, desc: '书页撕裂、水渍明显' },
  severe: { label: '严重', ratio: 1, desc: '缺页、封面破损' },
  lost: { label: '丢失', ratio: 1.5, desc: '图书无法归还（含管理费）' },
}

/** 业务规则常量（PRD 第 4 章） */
export const RULES = {
  MAX_BORROW_COUNT: 5, // 每人最多同时借阅 5 本
  MAX_BORROW_DAYS: 30, // 单次借阅最长 30 天
  OVERDUE_MULTIPLIER: 1.5, // 逾期费用 = 逾期天数 × 日租金 × 1.5
}

/** 统一响应包装（PRD 6.7） */
export interface ApiResult<T> {
  code: number // 0 成功；4000-4999 客户端错误
  message: string
  data: T | null
}
