/**
 * 模拟数据库 — 基于 reactive + localStorage 持久化
 * 替代真实后端：所有 Pinia store 共享同一份数据源，刷新/重开浏览器数据不丢
 */
import { reactive, watch } from 'vue'
import {
  buildSeedBooks,
  buildSeedBorrows,
  buildSeedDamages,
  buildSeedFines,
  buildSeedUsers,
  SEED_META,
} from './seed'
import type { Book, BorrowRecord, DamageRecord, Fine, User } from '@/types'

const STORAGE_KEY = 'moxiang_db_v1'

interface Database {
  users: User[]
  books: Book[]
  borrows: BorrowRecord[]
  fines: Fine[]
  damages: DamageRecord[]
  seq: { user: number; book: number; borrow: number; fine: number; damage: number }
}

function freshDb(): Database {
  return {
    users: buildSeedUsers(),
    books: buildSeedBooks(),
    borrows: buildSeedBorrows(),
    fines: buildSeedFines(),
    damages: buildSeedDamages(),
    seq: { user: 7, book: 13, borrow: 9, fine: 3, damage: 2 },
  }
}

function load(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Database
  } catch {
    /* 解析失败则重置 */
  }
  return freshDb()
}

export const db = reactive<Database>(load())
export const seedMeta = SEED_META

watch(
  db,
  () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    } catch {
      /* 存储满时忽略 */
    }
  },
  { deep: true },
)

/** 重置演示数据 */
export function resetDb(): void {
  const fresh = freshDb()
  db.users = fresh.users
  db.books = fresh.books
  db.borrows = fresh.borrows
  db.fines = fresh.fines
  db.damages = fresh.damages
  db.seq = fresh.seq
}
