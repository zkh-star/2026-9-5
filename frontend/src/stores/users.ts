/** 用户管理 store — 列表 / 新增 / 冻结 / 删除 / 详情（PRD 3.2） */
import { defineStore } from 'pinia'
import { db } from '@/mocks/db'
import type { ApiResult, User, UserRole } from '@/types'

export interface UserQuery {
  keyword?: string
  role?: string
  status?: string
}

export const useUsersStore = defineStore('users', () => {
  function list(query: UserQuery = {}): User[] {
    const kw = (query.keyword ?? '').trim().toLowerCase()
    return db.users.filter((u) => {
      if (u.status === 'deleted') return false
      if (kw) {
        const hit = u.username.toLowerCase().includes(kw) || u.phone.includes(kw) || u.email.toLowerCase().includes(kw)
        if (!hit) return false
      }
      if (query.role && u.role !== query.role) return false
      if (query.status && u.status !== query.status) return false
      return true
    })
  }

  function getById(userId: number): User | undefined {
    return db.users.find((u) => u.userId === userId)
  }

  /** 当前在借数量 */
  function activeBorrowCount(userId: number): number {
    return db.borrows.filter((r) => r.userId === userId && r.actualReturnDate === null).length
  }

  /** 未缴费用总额 */
  function unpaidFineAmount(userId: number): number {
    return db.fines.filter((f) => f.userId === userId && f.status === 'unpaid').reduce((s, f) => s + f.amount, 0)
  }

  function create(payload: { username: string; password: string; phone?: string; email?: string; role?: UserRole }): ApiResult<User> {
    if (db.users.some((u) => u.username === payload.username && u.status !== 'deleted')) {
      return { code: 4006, message: '用户名已存在', data: null }
    }
    const user: User = {
      userId: db.seq.user++,
      username: payload.username,
      password: payload.password,
      phone: payload.phone ?? '',
      email: payload.email ?? '',
      role: payload.role ?? 'user',
      status: 'active',
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    }
    db.users.push(user)
    return { code: 0, message: 'ok', data: user }
  }

  /** 冻结/解冻：冻结前需确认无未还图书（PRD 3.2.3） */
  function changeStatus(userId: number, status: 'active' | 'frozen'): ApiResult<null> {
    const user = getById(userId)
    if (!user) return { code: 4104, message: '用户不存在', data: null }
    if (status === 'frozen' && activeBorrowCount(userId) > 0) {
      return { code: 4015, message: `该用户还有 ${activeBorrowCount(userId)} 本图书未归还，冻结前需先归还`, data: null }
    }
    user.status = status
    return { code: 0, message: 'ok', data: null }
  }

  /** 软删除：需无未还图书且无未缴费用（PRD 3.2.4） */
  function remove(userId: number): ApiResult<null> {
    const user = getById(userId)
    if (!user) return { code: 4104, message: '用户不存在', data: null }
    const borrowing = activeBorrowCount(userId)
    if (borrowing > 0) {
      return { code: 4016, message: `该用户还有 ${borrowing} 本图书未归还，无法删除`, data: null }
    }
    const unpaid = unpaidFineAmount(userId)
    if (unpaid > 0) {
      return { code: 4017, message: `该用户有未缴费用 ¥${unpaid.toFixed(2)}，需先结清`, data: null }
    }
    user.status = 'deleted'
    return { code: 0, message: 'ok', data: null }
  }

  /** 修改角色：仅系统管理员（PRD 3.2.2），页面层控制入口 */
  function changeRole(userId: number, role: UserRole): ApiResult<null> {
    const user = getById(userId)
    if (!user) return { code: 4104, message: '用户不存在', data: null }
    user.role = role
    return { code: 0, message: 'ok', data: null }
  }

  /** 个人中心：修改联系方式 */
  function updateProfile(userId: number, payload: { phone?: string; email?: string }): ApiResult<null> {
    const user = getById(userId)
    if (!user) return { code: 4104, message: '用户不存在', data: null }
    if (payload.phone !== undefined) user.phone = payload.phone
    if (payload.email !== undefined) user.email = payload.email
    return { code: 0, message: 'ok', data: null }
  }

  /** 个人中心：修改密码（需验证原密码） */
  function changePassword(userId: number, oldPwd: string, newPwd: string): ApiResult<null> {
    const user = getById(userId)
    if (!user) return { code: 4104, message: '用户不存在', data: null }
    if (user.password !== oldPwd) return { code: 4007, message: '原密码不正确', data: null }
    user.password = newPwd
    return { code: 0, message: 'ok', data: null }
  }

  return { list, getById, activeBorrowCount, unpaidFineAmount, create, changeStatus, remove, changeRole, updateProfile, changePassword }
})
