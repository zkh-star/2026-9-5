# 小说租赁管理系统 — 产品需求文档 (PRD)

> 日期：2026-09-05
> 版本：v1.0
> 状态：待审核

---

## 1. 产品概述

### 1.1 项目背景

随着数字阅读和实体书籍租赁业务的快速发展，传统人工管理方式已无法满足日益增长的租赁业务需求。小说作为最受欢迎的图书品类之一，具有借阅频繁、周转率高的特点。本系统旨在构建一套专业化的小说租赁管理系统，实现用户、图书、借阅、归还全流程数字化管理。

### 1.2 项目目标

| 目标 | 描述 |
|------|------|
| 用户管理 | 用户信息增删改查、权限分级管理、借阅记录追踪 |
| 图书管理 | 小说信息录入、状态更新、损坏下架、详细查询 |
| 借阅管理 | 借阅手续办理、期限设置、逾期提醒、借阅历史查询 |
| 归还管理 | 归还手续办理、损坏检查、库存更新、逾期费用结算 |
| 智能化辅助 | 集成 Dify API 实现逾期提醒文案生成、阅读推荐 |

### 1.3 用户角色

| 角色 | 描述 | 主要权限 |
|------|------|----------|
| 普通用户 | 小说租赁消费者 | 查询图书、查看个人借阅记录 |
| 图书管理员 | 日常业务操作人员 | 用户管理、图书管理、借阅办理、归还办理 |
| 系统管理员 | 系统维护与配置 | 所有权限 + 系统配置 + 权限分配 |

---

## 2. 技术架构

### 2.1 技术栈

| 分类 | 技术选型 | 说明 |
|------|----------|------|
| 后端框架 | FastAPI | 高性能异步 Python Web 框架，自动生成 API 文档 |
| 智能分析 | Dify API | 集成 LLM 能力，生成逾期提醒文案和阅读推荐 |
| 数据库 | MySQL | 关系型数据库，存储业务数据 |
| ORM 框架 | SQLAlchemy | Python ORM，支持异步操作 |
| 后端语言 | Python 3.11+ | 主要开发语言 |
| 前端渲染 | Jinja2 | FastAPI 模板引擎 |
| 前端技术 | HTML5 + CSS3 + 原生 JS | 响应式布局，无构建步骤 |
| 认证 | JWT (python-jose) | 用户令牌认证 |
| 密码加密 | passlib[bcrypt] | 安全密码哈希 |
| 环境配置 | pydantic-settings | `.env` 管理 |

### 2.2 架构方案

**方案：单体全栈应用（前后端一体）**

```
novel-rental/
├── backend/                      # FastAPI 后端
│   ├── main.py                   # 应用入口，注册路由
│   ├── config.py                 # 配置管理
│   ├── database.py               # 数据库连接
│   ├── models.py                 # SQLAlchemy 数据模型
│   ├── schemas.py                # Pydantic 请求/响应模型
│   ├── dependencies.py           # 公共依赖（认证、数据库会话）
│   ├── routers/                  # 路由层
│   │   ├── auth.py               # 认证接口
│   │   ├── user.py               # 用户管理接口
│   │   ├── book.py               # 图书管理接口
│   │   ├── borrow.py             # 借阅管理接口
│   │   ├── return.py             # 归还管理接口
│   │   └── ai.py                 # Dify API 接口
│   ├── services/                 # 业务逻辑层
│   │   ├── auth_service.py       # 认证逻辑
│   │   ├── user_service.py       # 用户管理逻辑
│   │   ├── book_service.py       # 图书管理逻辑
│   │   ├── borrow_service.py     # 借阅逻辑（含配额检查、期限计算）
│   │   ├── fine_service.py       # 费用结算（逾期费、损坏赔偿）
│   │   └── dify_client.py        # Dify API 客户端
│   └── static/                   # 前端静态资源
│       ├── css/
│       ├── js/
│       └── images/
├── templates/                    # Jinja2 HTML 模板
│   ├── base.html                 # 公共布局
│   ├── auth/                     # 登录、注册
│   ├── users/                    # 用户管理页面
│   ├── books/                    # 图书管理页面
│   ├── borrow/                   # 借阅管理页面
│   ├── return/                   # 归还管理页面
│   └── dashboard.html            # 首页仪表盘
├── requirements.txt
├── .env.example
└── run.py                        # 启动入口
```

### 2.3 架构决策记录

| 决策 | 选项 | 选定 | 理由 |
|------|------|------|------|
| 前端形态 | Jinja2 模板 vs SPA vs React | Jinja2 模板 | 需求文档指定原生前端，Jinja2 与 FastAPI 天然集成，开发效率最高 |
| ORM | SQLAlchemy vs Tortoise vs 原生 SQL | SQLAlchemy | Python 生态最成熟，FastAPI 官方推荐，支持异步 |
| 认证方式 | JWT vs Session vs OAuth2 | JWT | 无状态、FastAPI 原生支持，适合单体应用 |
| 数据库 | MySQL vs PostgreSQL vs SQLite | MySQL | 需求文档指定；SQLite 可作开发测试用 |

---

## 3. 功能规格

### 3.1 认证模块

#### 3.1.1 用户登录

- **触发**：用户访问 `/login` 页面提交表单
- **输入**：用户名、密码
- **流程**：
  1. 校验用户名是否存在且状态为 active
  2. 使用 bcrypt 验证密码
  3. 生成 JWT access_token（有效期 12 小时）
  4. 将用户信息写入 session 或 cookie
- **输出**：重定向到仪表盘；返回错误提示
- **权限**：公开访问

#### 3.1.2 用户注册

- **触发**：用户访问 `/register` 页面提交表单
- **输入**：用户名、密码、确认密码、联系电话、邮箱
- **流程**：
  1. 校验用户名唯一性
  2. 校验两次密码一致
  3. bcrypt 加密密码后存入数据库
  4. 自动分配 `user` 角色
- **输出**：注册成功并跳转登录；返回错误提示
- **权限**：公开访问

#### 3.1.3 登出

- **触发**：点击「退出登录」
- **流程**：清除 session/cookie
- **输出**：重定向到登录页

---

### 3.2 用户管理模块

#### 3.2.1 用户列表（管理员）

- **触发**：管理员访问 `/users`
- **输入**：搜索关键词（可选）
- **输出**：用户列表（ID、用户名、联系方式、角色、状态、注册时间）
- **权限**：图书管理员、系统管理员

#### 3.2.2 修改用户权限（管理员）

- **触发**：管理员编辑用户角色
- **输入**：用户 ID、新角色（`user` / `admin`）
- **流程**：
  1. 检查目标用户是否为系统管理员且当前操作为降级
  2. 更新 role 字段
- **权限**：系统管理员

#### 3.2.3 冻结/解冻用户

- **触发**：管理员操作用户状态
- **输入**：用户 ID、新状态（`active` / `frozen`）
- **流程**：
  1. 检查用户是否有未还图书（有则禁止冻结）
  2. 更新 status 字段
- **权限**：图书管理员、系统管理员

#### 3.2.4 删除用户

- **触发**：管理员删除用户账号
- **输入**：用户 ID
- **流程**：
  1. 检查是否有未还图书（有则禁止删除）
  2. 检查是否有未缴费用（有则提示先结清）
  3. 将 status 置为 `deleted`（软删除）
- **输出**：成功/失败提示
- **权限**：系统管理员

#### 3.2.5 查询用户借阅记录

- **触发**：管理员查看用户详情；用户查看自己的借阅记录
- **输入**：用户 ID
- **输出**：借阅记录列表（当前借阅 + 历史借阅）
- **权限**：管理员可查所有用户；普通用户只能查自己

---

### 3.3 图书管理模块

#### 3.3.1 图书列表（搜索）

- **触发**：访问 `/books` 或首页搜索框
- **输入**：搜索关键词（书名/作者/ISBN/分类）、分页参数
- **输出**：图书列表（封面占位、书名、作者、分类、状态、日租金）
- **权限**：所有已登录用户

#### 3.3.2 录入新图书

- **触发**：管理员访问 `/books/new` 提交表单
- **输入**：书名、作者、ISBN、定价、日租金、押金、分类、书架位置
- **流程**：
  1. ISBN 唯一性校验
  2. 创建图书记录，状态默认为 `available`
- **输出**：图书 ID、录入成功提示
- **权限**：图书管理员、系统管理员

#### 3.3.3 更新图书信息

- **触发**：管理员编辑图书详情
- **输入**：图书 ID、可编辑字段（书名、作者、分类、定价、日租金、押金、位置）
- **流程**：
  1. 只有 `available` 状态的图书可编辑基本信息
  2. `borrowed` 状态的图书仅可更新位置
- **权限**：图书管理员、系统管理员

#### 3.3.4 更新图书状态

- **触发**：管理员手动调整图书状态
- **输入**：图书 ID、新状态（`available` / `borrowed` / `repairing`）
- **流程**：
  1. `borrowed` → `available` 需通过归还流程自动完成，手动禁止
  2. `available` → `repairing` 可手动触发
- **权限**：图书管理员、系统管理员

#### 3.3.5 删除损坏图书

- **触发**：管理员确认图书损坏严重无法修复
- **输入**：图书 ID、损坏原因
- **流程**：
  1. 检查图书状态必须为 `repairing` 或 `available`（非借出）
  2. 物理删除或标记为 `lost`
- **输出**：删除成功提示
- **权限**：图书管理员、系统管理员

---

### 3.4 借阅管理模块

#### 3.4.1 办理借阅手续

- **触发**：管理员访问 `/borrow/new` 提交表单
- **输入**：用户 ID、图书 ID、借阅天数
- **流程**：
  1. 校验用户存在且状态为 active
  2. 校验图书存在且状态为 `available`
  3. 配额检查：用户当前借阅数量 < 5
  4. 期限检查：借阅天数 ≤ 30
  5. 创建借阅记录，计算应还日期
  6. 更新图书状态为 `borrowed`
- **输出**：借阅单号、应还日期、押金金额
- **权限**：图书管理员、系统管理员

#### 3.4.2 设置借阅期限

- **规则**：
  - 最长借阅天数：30 天
  - 应还日期 = 当前日期 + 借阅天数
  - 超过 30 天的请求应在接口层拒绝并提示

#### 3.4.3 提醒逾期未还

- **触发**：
  - **自动触发**：系统定时任务每日 08:00 扫描逾期记录
  - **手动触发**：管理员指定逾期天数范围触发
- **输入**：逾期天数范围（如 1-3 天、4-7 天、7 天以上）
- **流程**：
  1. 查询 status 为 `borrowed` 且 due_date < 今日的记录
  2. 调用 Dify API 生成个性化提醒文案
  3. 记录已发送提醒（避免重复提醒）
- **输出**：提醒记录/发送状态
- **权限**：图书管理员、系统管理员

#### 3.4.4 查询借阅历史

- **触发**：管理员访问 `/borrows`；用户查看个人借阅记录
- **输入**：时间范围（可选）、用户 ID（可选）、图书 ID（可选）、状态筛选
- **输出**：借阅记录列表（借阅单号、用户、图书、借出日期、应还日期、归还日期、状态）
- **权限**：管理员可查所有；普通用户只能查自己

---

### 3.5 归还管理模块

#### 3.5.1 办理归还手续

- **触发**：管理员访问 `/return/new` 提交表单
- **输入**：借阅单号（或用户 ID + 图书 ID）
- **流程**：
  1. 查询对应的未归还借阅记录
  2. 校验图书状态为 `borrowed`
  3. 进入损坏检查流程（见 3.5.2）
  4. 计算逾期费用（见 3.5.3）
  5. 更新借阅记录状态为 `returned`，写入 actual_return_date
  6. 更新图书状态为 `available`（若损坏则转为 `repairing`）
- **输出**：归还确认、费用结算清单
- **权限**：图书管理员、系统管理员

#### 3.5.2 损坏检查与赔偿

- **触发**：归还流程中
- **输入**：图书 ID、损坏等级（`none` / `minor` / `moderate` / `severe` / `lost`）、损坏描述（可选）
- **规则**：

| 损坏等级 | 描述 | 赔偿比例（按定价） |
|----------|------|---------------------|
| none | 完好无损 | 0% |
| minor | 书页折角、轻微污渍 | 10% |
| moderate | 书页撕裂、水渍明显 | 30% |
| severe | 缺页、封面破损 | 100% |
| lost | 图书无法归还 | 150%（含管理费） |

- **流程**：
  1. 计算赔偿金额 = 图书定价 × 赔偿比例
  2. 创建损坏记录（damage_records 表）
  3. 若等级为 `none`，图书状态转为 `available`
  4. 若等级 ≥ `minor`，图书状态转为 `repairing`
  5. 若等级为 `lost`，标记图书为丢失

#### 3.5.3 逾期费用结算

- **规则**：`逾期费用 = 逾期天数 × 日租金 × 1.5`
- **逾期天数** = 实际归还日期 - 应还日期（仅计算正数）
- **流程**：
  1. 若 actual_return_date > due_date 且 status ≠ `returned`
  2. 按公式计算费用
  3. 若同时有损坏赔偿，与逾期费分开记录在 fines 表
- **输出**：逾期费用金额；无逾期时为 0

#### 3.5.4 费用结算汇总

归还时可能产生的费用（独立记录在 fines 表，user_id 冗余存储便于直接查询）：

| 费用类型 | 说明 |
|----------|------|
| overdue | 逾期费用 |
| damage | 损坏赔偿 |
| loss | 丢失赔偿 |

总应收 = 各类型费用之和。押金退还 = 押金总额 - 费用总额（若押金不足需补收）。

---

### 3.6 智能化辅助模块

#### 3.6.1 Dify API 集成

- **用途**：
  1. 逾期提醒文案生成：根据逾期天数、用户历史行为生成个性化提醒
  2. 阅读推荐：根据用户借阅历史和偏好推荐同类小说

#### 3.6.2 逾期提醒文案生成

- **触发**：逾期提醒流程中（见 3.4.3）
- **输入**：用户信息、借阅的书名、逾期天数
- **Dify 工作流**：输入上述参数 → 返回提醒文案
- **输出**：AI 生成的提醒文案（中文）

#### 3.6.3 阅读推荐

- **触发**：用户访问个人中心时展示推荐
- **输入**：用户 ID、借阅历史中的图书分类
- **Dify 工作流**：根据用户偏好分类推荐 3-5 本图书
- **输出**：推荐图书列表（书名 + 推荐理由）

---

## 4. 业务规则汇总

| 规则项 | 限制说明 |
|--------|----------|
| 最大借阅数量 | 每人最多同时借阅 5 本 |
| 最长借阅天数 | 单次借阅最长 30 天 |
| 日租金 | 统一按图书标明日租金计算，无折扣 |
| 逾期费用公式 | `逾期天数 × 日租金 × 1.5` |
| 损坏赔偿 | 按损坏等级对应比例（见 3.5.2） |
| 丢失赔偿 | 图书定价的 150%（含管理费） |
| 冻结检查 | 冻结用户前需确认无未还图书 |
| 删除检查 | 删除用户前需确认无未还图书、无未缴费用 |
| 软删除 | 用户和图书均采用软删除（status 字段标记） |

---

## 5. 数据模型

### 5.1 users 用户表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| user_id | INT | PRIMARY KEY, AUTO_INCREMENT | 用户 ID |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户名 |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt 加密密码 |
| phone | VARCHAR(20) | | 联系电话 |
| email | VARCHAR(100) | | 电子邮箱 |
| role | ENUM('user','admin') | DEFAULT 'user' | 角色 |
| status | ENUM('active','frozen','deleted') | DEFAULT 'active' | 账号状态 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 注册时间 |

### 5.2 books 图书表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| book_id | INT | PRIMARY KEY, AUTO_INCREMENT | 图书 ID |
| title | VARCHAR(200) | NOT NULL | 书名 |
| author | VARCHAR(100) | NOT NULL | 作者 |
| isbn | VARCHAR(20) | UNIQUE | ISBN 编号 |
| category | VARCHAR(50) | | 分类（武侠/言情/科幻/悬疑等） |
| price | DECIMAL(10,2) | NOT NULL | 定价 |
| daily_rent | DECIMAL(10,2) | NOT NULL | 日租金 |
| deposit | DECIMAL(10,2) | NOT NULL | 押金 |
| status | ENUM('available','borrowed','repairing','lost') | DEFAULT 'available' | 状态 |
| location | VARCHAR(50) | | 书架位置 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 录入时间 |

### 5.3 borrow_records 借阅记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| borrow_id | INT | PRIMARY KEY, AUTO_INCREMENT | 借阅单号 |
| user_id | INT | FOREIGN KEY → users.user_id | 用户 ID |
| book_id | INT | FOREIGN KEY → books.book_id | 图书 ID |
| borrow_date | DATE | NOT NULL | 借出日期 |
| due_date | DATE | NOT NULL | 应还日期 |
| actual_return_date | DATE | NULL | 实际归还日期（NULL = 未还） |
| daily_rate | DECIMAL(10,2) | NOT NULL | 实际日租金 |
| deposit | DECIMAL(10,2) | NOT NULL | 收取的押金 |
| status | ENUM('borrowed','returned','overdue') | DEFAULT 'borrowed' | 状态 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### 5.4 fines 费用记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| fine_id | INT | PRIMARY KEY, AUTO_INCREMENT | 费用 ID |
| borrow_id | INT | FOREIGN KEY → borrow_records.borrow_id | 借阅单号 |
| user_id | INT | FOREIGN KEY → users.user_id | 用户 ID（冗余，便于查询） |
| amount | DECIMAL(10,2) | NOT NULL | 金额 |
| type | ENUM('overdue','damage','loss') | NOT NULL | 费用类型 |
| status | ENUM('unpaid','paid') | DEFAULT 'unpaid' | 支付状态 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### 5.5 damage_records 损坏记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| record_id | INT | PRIMARY KEY, AUTO_INCREMENT | 记录 ID |
| borrow_id | INT | FOREIGN KEY → borrow_records.borrow_id | 借阅单号 |
| book_id | INT | FOREIGN KEY → books.book_id | 图书 ID |
| damage_level | ENUM('none','minor','moderate','severe','lost') | NOT NULL | 损坏等级 |
| compensation | DECIMAL(10,2) | NOT NULL | 赔偿金额 |
| description | TEXT | | 损坏描述 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### 5.6 表关系

```
users 1──N borrow_records
books 1──N borrow_records
borrow_records 1──N fines
borrow_records 1──1 damage_records
users 1──N fines
```

---

## 6. API 设计

### 6.1 认证接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/auth/register` | 用户注册 | 公开 |
| POST | `/api/auth/login` | 用户登录（返回 JWT） | 公开 |
| POST | `/api/auth/logout` | 用户登出 | 已认证 |

### 6.2 用户管理接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/users` | 用户列表（支持搜索） | 管理员 |
| GET | `/api/users/{id}` | 用户详情（含借阅记录） | 管理员 / 本人 |
| POST | `/api/users` | 创建用户 | 管理员 |
| PUT | `/api/users/{id}` | 更新用户信息 | 管理员 |
| PUT | `/api/users/{id}/role` | 修改用户角色 | 系统管理员 |
| PUT | `/api/users/{id}/status` | 冻结/解冻用户 | 管理员 |
| DELETE | `/api/users/{id}` | 软删除用户 | 系统管理员 |

### 6.3 图书管理接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/books` | 图书列表（支持搜索/分页） | 已认证 |
| GET | `/api/books/{id}` | 图书详情 | 已认证 |
| POST | `/api/books` | 录入新图书 | 管理员 |
| PUT | `/api/books/{id}` | 更新图书信息 | 管理员 |
| PUT | `/api/books/{id}/status` | 手动调整状态 | 管理员 |
| DELETE | `/api/books/{id}` | 删除损坏图书 | 管理员 |

### 6.4 借阅管理接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/borrows` | 借阅记录列表（支持筛选） | 管理员 / 本人 |
| POST | `/api/borrows` | 办理借阅手续 | 管理员 |
| GET | `/api/borrows/overdue` | 逾期记录列表 | 管理员 |
| POST | `/api/borrows/overdue/remind` | 手动触发逾期提醒 | 管理员 |

### 6.5 归还管理接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/returns` | 办理归还（含损坏检查、费用结算） | 管理员 |

### 6.6 AI 接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/ai/reminder` | 生成逾期提醒文案 | 管理员 |
| GET | `/api/ai/recommendations` | 获取阅读推荐 | 已认证（仅本人） |

### 6.7 API 响应格式

```json
// 成功响应
{
  "code": 0,
  "message": "ok",
  "data": { ... }
}

// 失败响应
{
  "code": 4001,
  "message": "用户已借阅 5 本，达到上限",
  "data": null
}
```

### 6.8 错误码

| 范围 | 分类 | 示例 |
|------|------|------|
| 0 | 成功 | — |
| 4000-4999 | 客户端错误 | 4001=借阅超限、4002=图书不可借、4010=未登录、4011=权限不足 |
| 5000-5999 | 服务端错误 | 5001=数据库错误、5002=Dify API 调用失败 |

---

## 7. 前端页面设计

### 7.1 页面清单

| 页面 | 路径 | 模板 | 说明 | 权限 |
|------|------|------|------|------|
| 登录 | `/login` | auth/login.html | 用户名+密码登录 | 公开 |
| 注册 | `/register` | auth/register.html | 新用户注册 | 公开 |
| 仪表盘 | `/` | dashboard.html | 首页，含统计卡片+阅读推荐 | 已认证 |
| 用户列表 | `/users` | users/list.html | 用户表格+搜索 | 管理员 |
| 用户详情 | `/users/{id}` | users/detail.html | 用户信息+借阅记录 | 管理员/本人 |
| 图书列表 | `/books` | books/list.html | 图书表格+搜索+分页 | 已认证 |
| 图书录入 | `/books/new` | books/form.html | 录入新图书表单 | 管理员 |
| 图书编辑 | `/books/{id}/edit` | books/form.html | 编辑图书信息 | 管理员 |
| 借阅办理 | `/borrow/new` | borrow/new.html | 办理借阅表单 | 管理员 |
| 借阅记录 | `/borrows` | borrow/list.html | 借阅历史（含筛选） | 管理员/本人 |
| 逾期列表 | `/borrows/overdue` | borrow/overdue.html | 逾期记录+提醒按钮 | 管理员 |
| 归还办理 | `/return/new` | return/new.html | 归还+损坏检查+费用结算 | 管理员 |
| 个人中心 | `/profile` | profile.html | 个人信息+借阅记录+推荐 | 已认证 |

### 7.2 仪表盘首页

展示内容：
- 今日借阅数 / 归还数 / 逾期数（统计卡片）
- 热门图书 Top 5（按借阅次数）
- 即将到期图书（7 天内）
- AI 阅读推荐（AI 生成，仅普通用户可见）

### 7.3 通用 UI 规范

- 布局：左侧固定导航栏 + 顶部面包屑 + 主内容区
- 响应式：最小宽度 1024px，在平板上自动折叠导航
- 表格：支持排序、分页（每页 20 条）、搜索筛选
- 表单：字段校验（前端 + 后端双重校验），提交前确认
- 消息提示：操作成功/失败在页面顶部 Toast 显示

---

## 8. 定时任务

| 任务 | 执行时间 | 说明 |
|------|----------|------|
| 逾期扫描 + 提醒 | 每日 08:00 | 扫描所有逾期记录，调用 Dify 生成提醒文案并记录 |

实现方案：使用 APScheduler 库，在 FastAPI 应用启动时注册定时任务。

---

## 9. 初始化流程

### 9.1 阶段一：系统初始化

1. 安装依赖 `pip install -r requirements.txt`
2. 复制 `.env.example` 为 `.env` 并配置
3. 执行数据库迁移（Alembic 或直接执行建表 SQL）
4. 创建超级管理员账号（脚本初始化）
5. 启动服务 `python run.py`

### 9.2 阶段二：基础数据导入

- 通过管理界面录入图书信息
- 注册普通用户账号

### 9.3 阶段三：业务流转

- 用户借阅 → 借阅中管理 → 用户归还 → 费用结算

### 9.4 阶段四：日常运维

- 逾期提醒（定时自动 + 手动触发）
- 损坏图书处理（维修 / 下架 / 删除）
- 统计报表（借阅统计、图书周转率、用户活跃度）

---

## 10. 非功能性需求

### 10.1 安全

- 密码使用 bcrypt 加密存储，禁止明文
- JWT token 设置合理过期时间（12 小时）
- 敏感操作（删除用户、修改角色）需要二次确认
- Dify API Key 存储在 `.env` 中，不提交到版本控制

### 10.2 性能

- 数据库查询建立必要索引（username, isbn, borrow_date, due_date）
- 列表接口默认分页，禁止一次性返回全量数据
- 图书搜索支持模糊匹配（LIKE），数据量大后可引入全文索引

### 10.3 可维护性

- 遵循 FastAPI 项目结构：routers / services / models 分层清晰
- Pydantic schemas 统一请求/响应格式
- 关键业务逻辑编写单元测试
- 使用 Alembic 管理数据库迁移

### 10.4 扩展性预留

- books.category 使用 VARCHAR 而非 ENUM，方便动态添加分类
- 费用类型（fines.type）预留 'overdue'/'damage'/'loss'，后续可扩展其他费用
- Dify API 调用封装在 `dify_client.py`，便于切换 AI 服务或增加新功能

---

## 11. 依赖清单（requirements.txt）

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
sqlalchemy>=2.0.0
aiomysql>=0.2.0            # 或 asyncpg（若改用 PostgreSQL）
pydantic>=2.0.0
pydantic-settings>=2.0.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.9    # 表单数据解析
jinja2>=3.1.0
apscheduler>=3.10.0        # 定时任务
httpx>=0.27.0              # Dify API 客户端
alembic>=1.13.0            # 数据库迁移
python-dotenv>=1.0.0
```

---

## 12. 环境变量（.env）

```
# 数据库
DATABASE_URL=mysql+aiomysql://user:password@localhost:3306/novel_rental

# JWT
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=12

# Dify API
DIFY_API_BASE_URL=https://api.dify.ai/v1
DIFY_API_KEY=your-dify-api-key
DIFY_REMINDER_WORKFLOW_ID=
DIFY_RECOMMEND_WORKFLOW_ID=

# 服务器
HOST=0.0.0.0
PORT=8000
```
