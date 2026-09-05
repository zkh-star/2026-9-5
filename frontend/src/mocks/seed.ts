/** 模拟种子数据 — 日期相对当前日期生成，保证任意时间打开演示状态一致 */
import { fmtDate, today } from '@/utils/format'
import type { Book, BorrowRecord, DamageRecord, Fine, User } from '@/types'

function shift(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return fmtDate(d)
}

function stamp(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const h = 9 + (daysAgo % 9)
  return `${fmtDate(d)} ${String(h).padStart(2, '0')}:12:36`
}

export function buildSeedUsers(): User[] {
  return [
    { userId: 1, username: 'admin', password: 'admin123', phone: '13800000001', email: 'admin@moxiang.com', role: 'admin', status: 'active', createdAt: stamp(280) },
    { userId: 2, username: '王小明', password: '123456', phone: '13912342345', email: 'wangxm@qq.com', role: 'user', status: 'active', createdAt: stamp(233) },
    { userId: 3, username: '李思琪', password: '123456', phone: '13712346789', email: 'lisiqi@163.com', role: 'user', status: 'active', createdAt: stamp(198) },
    { userId: 4, username: '张大山', password: '123456', phone: '13612341111', email: 'zhangds@qq.com', role: 'user', status: 'frozen', createdAt: stamp(184) },
    { userId: 5, username: '陈小雨', password: '123456', phone: '13512342222', email: 'chenxy@gmail.com', role: 'user', status: 'active', createdAt: stamp(140) },
    { userId: 6, username: '赵书虫', password: '123456', phone: '13312343333', email: 'zhaosc@126.com', role: 'user', status: 'active', createdAt: stamp(90) },
  ]
}

export function buildSeedBooks(): Book[] {
  return [
    { bookId: 1, title: '笑傲江湖', author: '金庸', isbn: '9787101001956', category: '武侠', price: 45, dailyRent: 0.5, deposit: 30, status: 'borrowed', location: 'A-01-03', createdAt: stamp(300) },
    { bookId: 2, title: '天龙八部', author: '金庸', isbn: '9787101004926', category: '武侠', price: 68, dailyRent: 0.8, deposit: 40, status: 'available', location: 'A-01-04', createdAt: stamp(300) },
    { bookId: 3, title: '三体', author: '刘慈欣', isbn: '9787536692930', category: '科幻', price: 23, dailyRent: 0.4, deposit: 20, status: 'available', location: 'B-02-01', createdAt: stamp(260) },
    { bookId: 4, title: '球状闪电', author: '刘慈欣', isbn: '9787536698710', category: '科幻', price: 25, dailyRent: 0.4, deposit: 20, status: 'available', location: 'B-02-02', createdAt: stamp(260) },
    { bookId: 5, title: '白夜行', author: '东野圭吾', isbn: '9787544258609', category: '悬疑', price: 39.5, dailyRent: 0.4, deposit: 20, status: 'borrowed', location: 'C-01-05', createdAt: stamp(240) },
    { bookId: 6, title: '嫌疑人X的献身', author: '东野圭吾', isbn: '9787544268608', category: '悬疑', price: 35, dailyRent: 0.4, deposit: 20, status: 'available', location: 'C-01-06', createdAt: stamp(240) },
    { bookId: 7, title: '平凡的世界', author: '路遥', isbn: '9787530216781', category: '历史', price: 108, dailyRent: 1.0, deposit: 50, status: 'borrowed', location: 'D-01-01', createdAt: stamp(220) },
    { bookId: 8, title: '围城', author: '钱钟书', isbn: '9787020024759', category: '历史', price: 19, dailyRent: 0.3, deposit: 15, status: 'repairing', location: 'E-03-02', createdAt: stamp(220) },
    { bookId: 9, title: '云边有个小卖部', author: '张嘉佳', isbn: '9787540485806', category: '言情', price: 42, dailyRent: 0.4, deposit: 20, status: 'available', location: 'F-01-02', createdAt: stamp(180) },
    { bookId: 10, title: '明朝那些事儿', author: '当年明月', isbn: '9787229002387', category: '历史', price: 358, dailyRent: 1.0, deposit: 80, status: 'available', location: 'D-02-01', createdAt: stamp(160) },
    { bookId: 11, title: '琅琊榜', author: '海宴', isbn: '9787540460458', category: '武侠', price: 58, dailyRent: 0.6, deposit: 30, status: 'available', location: 'A-02-03', createdAt: stamp(150) },
    { bookId: 12, title: '消失的十三级台阶', author: '高野和明', isbn: '9787532779212', category: '悬疑', price: 45, dailyRent: 0.5, deposit: 25, status: 'available', location: 'C-02-04', createdAt: stamp(120) },
  ]
}

/** 借阅记录：4 条在借（其中 3 条已逾期）+ 4 条已归还，覆盖各种演示场景 */
export function buildSeedBorrows(): BorrowRecord[] {
  return [
    // 在借未逾期（王小明 借 天龙八部）
    { borrowId: 1, userId: 2, bookId: 2, borrowDate: shift(-10), dueDate: shift(20), actualReturnDate: null, dailyRate: 0.8, deposit: 40, status: 'borrowed', createdAt: stamp(10) },
    // 在借未逾期（李思琪 借 三体）
    { borrowId: 2, userId: 3, bookId: 3, borrowDate: shift(-14), dueDate: shift(16), actualReturnDate: null, dailyRate: 0.4, deposit: 20, status: 'borrowed', createdAt: stamp(14) },
    // 逾期 1 天（王小明 借 笑傲江湖）
    { borrowId: 3, userId: 2, bookId: 1, borrowDate: shift(-31), dueDate: shift(-1), actualReturnDate: null, dailyRate: 0.5, deposit: 30, status: 'overdue', createdAt: stamp(31) },
    // 逾期 7 天（陈小雨 借 平凡的世界）
    { borrowId: 4, userId: 5, bookId: 7, borrowDate: shift(-37), dueDate: shift(-7), actualReturnDate: null, dailyRate: 1.0, deposit: 50, status: 'overdue', createdAt: stamp(37) },
    // 已归还（陈小雨 借 围城，归还时轻微损坏 → 维修中）
    { borrowId: 5, userId: 5, bookId: 8, borrowDate: shift(-25), dueDate: shift(-11), actualReturnDate: shift(-12), dailyRate: 0.3, deposit: 15, status: 'returned', createdAt: stamp(25) },
    // 已归还（张大山 借 白夜行）
    { borrowId: 6, userId: 4, bookId: 5, borrowDate: shift(-40), dueDate: shift(-26), actualReturnDate: shift(-27), dailyRate: 0.4, deposit: 20, status: 'returned', createdAt: stamp(40) },
    // 已归还逾期 1 天（王小明 借 琅琊榜）
    { borrowId: 7, userId: 2, bookId: 11, borrowDate: shift(-35), dueDate: shift(-21), actualReturnDate: shift(-20), dailyRate: 0.6, deposit: 30, status: 'returned', createdAt: stamp(35) },
    // 已归还（李思琪 借 消失的十三级台阶）
    { borrowId: 8, userId: 3, bookId: 12, borrowDate: shift(-28), dueDate: shift(-14), actualReturnDate: shift(-15), dailyRate: 0.5, deposit: 25, status: 'returned', createdAt: stamp(28) },
  ]
}

export function buildSeedFines(): Fine[] {
  return [
    // 借阅单 7：逾期 1 天 × ¥0.6 × 1.5 = 0.9
    { fineId: 1, borrowId: 7, userId: 2, amount: 0.9, type: 'overdue', status: 'paid', createdAt: stamp(20) },
    // 借阅单 5：轻微损坏赔偿 ¥15 × 10% = 1.5
    { fineId: 2, borrowId: 5, userId: 5, amount: 1.5, type: 'damage', status: 'paid', createdAt: stamp(12) },
  ]
}

export function buildSeedDamages(): DamageRecord[] {
  return [
    { recordId: 1, borrowId: 5, bookId: 8, damageLevel: 'minor', compensation: 1.5, description: '书页折角，少量水渍', createdAt: stamp(12) },
  ]
}

export const SEED_META = {
  seededAt: today(),
  version: 1,
}
