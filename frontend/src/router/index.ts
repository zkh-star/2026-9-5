import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { title: '登录', public: true } },
  { path: '/register', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { title: '注册', public: true } },
  {
    path: '/',
    component: () => import('@/layout/MainLayout.vue'),
    children: [
      { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '仪表盘', icon: 'Odometer' } },
      { path: 'books', name: 'books', component: () => import('@/views/BookListView.vue'), meta: { title: '图书管理', icon: 'Reading' } },
      { path: 'books/new', name: 'book-new', component: () => import('@/views/BookFormView.vue'), meta: { title: '录入新图书', icon: 'Reading', roles: ['admin'] } },
      { path: 'books/:id/edit', name: 'book-edit', component: () => import('@/views/BookFormView.vue'), meta: { title: '编辑图书', icon: 'Reading', roles: ['admin'] } },
      { path: 'borrow/new', name: 'borrow-new', component: () => import('@/views/BorrowNewView.vue'), meta: { title: '办理借阅', icon: 'CirclePlus', roles: ['admin'] } },
      { path: 'borrows', name: 'borrows', component: () => import('@/views/BorrowListView.vue'), meta: { title: '借阅记录', icon: 'Notebook' } },
      { path: 'borrows/overdue', name: 'overdue', component: () => import('@/views/OverdueView.vue'), meta: { title: '逾期管理', icon: 'Warning', roles: ['admin'] } },
      { path: 'return/new', name: 'return-new', component: () => import('@/views/ReturnNewView.vue'), meta: { title: '办理归还', icon: 'RefreshLeft', roles: ['admin'] } },
      { path: 'users', name: 'users', component: () => import('@/views/UserListView.vue'), meta: { title: '用户管理', icon: 'User', roles: ['admin'] } },
      { path: 'users/:id', name: 'user-detail', component: () => import('@/views/UserDetailView.vue'), meta: { title: '用户详情', icon: 'User' } },
      { path: 'profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { title: '个人中心', icon: 'UserFilled' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const PAGE_TITLES: Record<string, string> = {
  books: '图书列表',
  'book-new': '录入新图书',
  'book-edit': '编辑图书',
  'borrow-new': '办理借阅',
  borrows: '借阅记录',
  overdue: '逾期管理',
  'return-new': '办理归还',
  users: '用户管理',
  'user-detail': '用户详情',
}

router.beforeEach((to) => {
  const auth = useAuthStore()
  document.title = `${PAGE_TITLES[String(to.name)] ?? to.meta.title ?? ''} · 墨香斋小说租赁`.replace(/^ · /, '')
  if (to.meta.public) {
    // 已登录访问登录/注册页 → 直接进仪表盘
    if (auth.isLoggedIn && (to.name === 'login' || to.name === 'register')) return { name: 'dashboard' }
    return true
  }
  if (!auth.isLoggedIn) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }
  const roles = to.meta.roles as string[] | undefined
  if (roles && !roles.includes(auth.user!.role)) {
    return { name: 'dashboard' }
  }
  return true
})

export default router
