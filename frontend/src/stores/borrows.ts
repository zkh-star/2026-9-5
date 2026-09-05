/** 借阅/归还 store — 核心业务规则（PRD 3.4 / 3.5 / 3.6） */
import { defineStore } from 'pinia'
import { db } from '@/mocks/db'
import { DAMAGE_LEVELS, RULES } from '@/types'
import { damageCompensation, diffDays, overdueFee, today } from '@/utils/format'
import type { ApiResult, BorrowRecord, DamageLevel } from '@/types'

export interface BorrowQuery {
  keyword?: string
  status?: string
  from?: string
  to?: string
}

export interface ReturnSettlement {
  borrowId: number
  overdueDays: number
  overdueAmount: number
  damageLevel: DamageLevel
  damageAmount: number
  totalAmount: number
  deposit: number
  refund: number
}

export const useBorrowsStore = defineStore('borrows', () => {
  function list(query: BorrowQuery = {}): BorrowRecord[] {
    const kw = (query.keyword ?? '').trim().toLowerCase()
    return db.borrows
      .filter((r) => {
        if (kw) {
          const user = db.users.find((u) => u.userId === r.userId)
          const book = db.books.find((b) => b.bookId === r.bookId)
          const no = `b-${r.borrowDate.replace(/-/g, '')}-${String(r.borrowId).padStart(3, '0')}`
          const hit = [no, user?.username ?? '', book?.title ?? ''].some((s) => s.toLowerCase().includes(kw))
          if (!hit) return false
        }
        if (query.status && r.status !== query.status) return false
        if (query.from && r.borrowDate < query.from) return false
        if (query.to && r.borrowDate > query.to) return false
        return true
      })
      .sort((a, b) => b.borrowId - a.borrowId)
  }

  function getById(borrowId: number): BorrowRecord | undefined {
    return db.borrows.find((r) => r.borrowId === borrowId)
  }

  function userLabel(userId: number): string {
    return db.users.find((u) => u.userId === userId)?.username ?? `用户${userId}`
  }

  function bookTitle(bookId: number): string {
    return db.books.find((b) => b.bookId === bookId)?.title ?? `图书${bookId}`
  }

  /** 办理借阅（PRD 3.4.1）：active 用户 + available 图书 + 配额 <5 + 天数 ≤30 */
  function createBorrow(userId: number, bookId: number, days: number): ApiResult<BorrowRecord> {
    const user = db.users.find((u) => u.userId === userId)
    if (!user || user.status !== 'active') return { code: 4018, message: '用户不存在或已被冻结', data: null }
    const book = db.books.find((b) => b.bookId === bookId)
    if (!book || book.status !== 'available') return { code: 4002, message: '图书当前不可借（需为在库状态）', data: null }
    const activeCount = db.borrows.filter((r) => r.userId === userId && r.actualReturnDate === null).length
    if (activeCount >= RULES.MAX_BORROW_COUNT) {
      return { code: 4001, message: `${user.username} 当前已借 ${activeCount} 本，已达借阅上限`, data: null }
    }
    if (!Number.isFinite(days) || days < 1 || days > RULES.MAX_BORROW_DAYS) {
      return { code: 4019, message: `借阅天数需在 1-${RULES.MAX_BORROW_DAYS} 天之间`, data: null }
    }
    const borrowDate = today()
    const due = new Date()
    due.setDate(due.getDate() + days)
    const record: BorrowRecord = {
      borrowId: db.seq.borrow++,
      userId,
      bookId,
      borrowDate,
      dueDate: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`,
      actualReturnDate: null,
      dailyRate: book.dailyRent,
      deposit: book.deposit,
      status: 'borrowed',
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    }
    db.borrows.push(record)
    book.status = 'borrowed'
    return { code: 0, message: 'ok', data: record }
  }

  /** 归还结算预览（不落库） */
  function previewReturn(borrowId: number, damageLevel: DamageLevel): ReturnSettlement | null {
    const record = getById(borrowId)
    const book = record && db.books.find((b) => b.bookId === record.bookId)
    if (!record || !book) return null
    const returnDate = today()
    const overdueDays = Math.max(0, diffDays(returnDate, record.dueDate))
    const overdueAmount = overdueFee(overdueDays, record.dailyRate)
    const damageAmount = damageCompensation(book.price, DAMAGE_LEVELS[damageLevel].ratio)
    const total = Math.round((overdueAmount + damageAmount) * 100) / 100
    return {
      borrowId,
      overdueDays,
      overdueAmount,
      damageLevel,
      damageAmount,
      totalAmount: total,
      deposit: record.deposit,
      refund: Math.round((record.deposit - total) * 100) / 100,
    }
  }

  /** 办理归还（PRD 3.5.1）：写归还日期 + 费用 + 损坏记录 + 更新图书/借阅状态 */
  function confirmReturn(borrowId: number, damageLevel: DamageLevel, description: string): ApiResult<ReturnSettlement> {
    const record = getById(borrowId)
    if (!record) return { code: 4104, message: '借阅单不存在', data: null }
    if (record.actualReturnDate) return { code: 4020, message: '该借阅单已归还，请勿重复操作', data: null }
    const book = db.books.find((b) => b.bookId === record.bookId)
    if (!book) return { code: 4104, message: '图书不存在', data: null }

    const settlement = previewReturn(borrowId, damageLevel)!
    const returnDate = today()

    record.actualReturnDate = returnDate
    record.status = 'returned'

    if (settlement.overdueAmount > 0) {
      db.fines.push({
        fineId: db.seq.fine++,
        borrowId,
        userId: record.userId,
        amount: settlement.overdueAmount,
        type: 'overdue',
        status: 'unpaid',
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      })
    }
    if (damageLevel !== 'none') {
      db.damages.push({
        recordId: db.seq.damage++,
        borrowId,
        bookId: book.bookId,
        damageLevel,
        compensation: settlement.damageAmount,
        description,
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      })
      const fineType = damageLevel === 'lost' ? 'loss' : 'damage'
      db.fines.push({
        fineId: db.seq.fine++,
        borrowId,
        userId: record.userId,
        amount: settlement.damageAmount,
        type: fineType,
        status: 'unpaid',
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      })
    }

    // 图书状态流转（PRD 3.5.2）
    if (damageLevel === 'lost') book.status = 'lost'
    else if (damageLevel === 'none') book.status = 'available'
    else book.status = 'repairing'

    return { code: 0, message: 'ok', data: settlement }
  }

  /** 逾期记录：未还且已过期；将 borrowing 记录同步为 overdue 状态 */
  function overdueList(): BorrowRecord[] {
    const t = today()
    return db.borrows
      .filter((r) => !r.actualReturnDate && r.dueDate < t)
      .map((r) => {
        if (r.status !== 'overdue') r.status = 'overdue'
        return r
      })
      .sort((a, b) => diffDays(t, a.dueDate) - diffDays(t, b.dueDate))
  }

  function overdueDays(record: BorrowRecord): number {
    return Math.max(0, diffDays(today(), record.dueDate))
  }

  /** 缴费结清 */
  function payFine(fineId: number): void {
    const fine = db.fines.find((f) => f.fineId === fineId)
    if (fine) fine.status = 'paid'
  }

  /** 某用户的全部费用记录（新→旧） */
  function finesOf(userId: number) {
    return db.fines.filter((f) => f.userId === userId).sort((a, b) => b.fineId - a.fineId)
  }

  /**
   * AI 逾期提醒文案（PRD 3.6.2）
   * 演示环境本地模拟 Dify 工作流输出；接入真实服务时替换为 HTTP 调用
   */
  function aiRemindText(record: BorrowRecord): string {
    const days = overdueDays(record)
    const name = userLabel(record.userId)
    const title = bookTitle(record.bookId)
    const fee = overdueFee(days, record.dailyRate)
    const tone =
      days <= 3 ? '亲爱的' : days <= 7 ? '尊敬的' : days <= 14 ? '急切地提醒' : '郑重告知'
    return `${tone} ${name}：您借阅的《${title}》已逾期 ${days} 天，按日租金 ¥${record.dailyRate.toFixed(2)} 的 1.5 倍计算，当前预计逾期费用 ¥${fee.toFixed(2)}。书香犹在，盼书早归——请尽快到店办理归还手续。`
  }

  /** 仪表盘统计 */
  function dashboardStats() {
    const t = today()
    return {
      todayBorrowed: db.borrows.filter((r) => r.borrowDate === t).length,
      todayReturned: db.borrows.filter((r) => r.actualReturnDate === t).length,
      overdue: overdueList().length,
      totalBooks: db.books.filter((b) => b.status !== 'lost').length,
      availableBooks: db.books.filter((b) => b.status === 'available').length,
      borrowedCount: db.books.filter((b) => b.status === 'borrowed').length,
      activeUsers: db.users.filter((u) => u.status === 'active').length,
      monthRevenue: db.fines.filter((f) => f.status === 'paid').reduce((s, f) => s + f.amount, 0),
      dueSoon: db.borrows
        .filter((r) => !r.actualReturnDate && r.dueDate >= t && diffDays(r.dueDate, t) <= 7)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    }
  }

  return {
    list,
    getById,
    userLabel,
    bookTitle,
    createBorrow,
    previewReturn,
    confirmReturn,
    overdueList,
    overdueDays,
    payFine,
    finesOf,
    aiRemindText,
    dashboardStats,
  }
})
