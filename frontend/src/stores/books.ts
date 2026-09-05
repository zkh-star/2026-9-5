/** 图书 store — 列表搜索 / 录入 / 编辑 / 状态管理（PRD 3.3） */
import { defineStore } from 'pinia'
import { db } from '@/mocks/db'
import type { ApiResult, Book, BookStatus } from '@/types'

export interface BookQuery {
  keyword?: string
  category?: string
  status?: string
}

export const useBooksStore = defineStore('books', () => {
  function list(query: BookQuery = {}): Book[] {
    const kw = (query.keyword ?? '').trim().toLowerCase()
    return db.books.filter((b) => {
      if (b.status === 'lost') return false // 丢失图书默认不在列表展示
      if (kw) {
        const hit =
          b.title.toLowerCase().includes(kw) ||
          b.author.toLowerCase().includes(kw) ||
          b.isbn.toLowerCase().includes(kw) ||
          b.category.toLowerCase().includes(kw)
        if (!hit) return false
      }
      if (query.category && b.category !== query.category) return false
      if (query.status && b.status !== query.status) return false
      return true
    })
  }

  function getById(bookId: number): Book | undefined {
    return db.books.find((b) => b.bookId === bookId)
  }

  function create(payload: Omit<Book, 'bookId' | 'status' | 'createdAt'>): ApiResult<Book> {
    if (db.books.some((b) => b.isbn === payload.isbn && b.status !== 'lost')) {
      return { code: 4011, message: `ISBN ${payload.isbn} 已存在`, data: null }
    }
    const book: Book = {
      ...payload,
      bookId: db.seq.book++,
      status: 'available',
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    }
    db.books.push(book)
    return { code: 0, message: 'ok', data: book }
  }

  function update(bookId: number, payload: Partial<Book>): ApiResult<Book> {
    const book = getById(bookId)
    if (!book) return { code: 4104, message: '图书不存在', data: null }
    if (book.status === 'borrowed' && (payload.price !== undefined || payload.dailyRent !== undefined || payload.deposit !== undefined)) {
      return { code: 4012, message: '借出中的图书仅可更新书架位置', data: null }
    }
    Object.assign(book, payload)
    return { code: 0, message: 'ok', data: book }
  }

  /** 手动调整状态：仅 available ↔ repairing（PRD 3.3.4） */
  function changeStatus(bookId: number, status: BookStatus): ApiResult<Book> {
    const book = getById(bookId)
    if (!book) return { code: 4104, message: '图书不存在', data: null }
    const allowed: BookStatus[] = ['available', 'repairing']
    if (!allowed.includes(status) || !allowed.includes(book.status)) {
      return { code: 4013, message: '仅支持「在库 ↔ 维修中」手动调整，借出状态需通过归还流程变更', data: null }
    }
    book.status = status
    return { code: 0, message: 'ok', data: book }
  }

  /** 删除损坏图书：仅非借出状态可删（PRD 3.3.5），标记为 lost（软删除） */
  function remove(bookId: number, reason: string): ApiResult<null> {
    const book = getById(bookId)
    if (!book) return { code: 4104, message: '图书不存在', data: null }
    if (book.status === 'borrowed') {
      return { code: 4014, message: '图书借出中，无法删除', data: null }
    }
    book.status = 'lost'
    if (reason) book.location = `已删除：${reason}`
    return { code: 0, message: 'ok', data: null }
  }

  const categories = [...new Set(db.books.filter((b) => b.status !== 'lost').map((b) => b.category))]

  return { list, getById, create, update, changeStatus, remove, categories }
})
