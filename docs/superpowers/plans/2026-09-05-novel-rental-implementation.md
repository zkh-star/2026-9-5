# 小说租赁管理系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于 FastAPI + Jinja2 的单体全栈小说租赁管理系统，实现用户、图书、借阅、归还全流程数字化管理，集成 Dify AI 提供逾期提醒文案生成和阅读推荐。

**Architecture:** 单体应用，FastAPI 后端提供 REST API + Jinja2 模板渲染，SQLAlchemy 异步 ORM 操作 MySQL，JWT 认证，APScheduler 实现定时逾期扫描。代码按 routers / services / models / schemas 分层。

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), aiomysql, MySQL, Jinja2, python-jose, passlib[bcrypt], APScheduler, httpx (Dify API), pydantic-settings

**Spec:** `docs/superpowers/specs/2026-09-05-novel-rental-design.md`

## Global Constraints

- Python 版本 ≥ 3.11
- 所有数据库操作使用 SQLAlchemy 2.0 异步模式（`AsyncSession`）
- API 响应统一格式：`{"code": int, "message": str, "data": Any}`
- 密码使用 bcrypt 哈希（passlib[bcrypt]），禁止明文
- JWT token 有效期 12 小时，算法 HS256
- 列表接口默认分页，page_size = 20
- 业务规则：最大借阅 5 本，最长 30 天，逾期费 = 逾期天数 × 日租金 × 1.5
- 软删除：users.status = 'deleted'，books.status = 'lost'
- Dify API 调用封装在 services/dify_client.py，外部通过注入使用

---

## File Structure Map

```
backend/
├── main.py                      # Task 12: FastAPI 入口 + 定时任务注册
├── run.py                       # Task 14: uvicorn 启动脚本
├── config.py                    # Task 1: 配置（pydantic-settings）
├── database.py                  # Task 1: AsyncEngine + AsyncSessionLocal + Base
├── models.py                    # Task 2: 5 张表 SQLAlchemy 模型
├── schemas.py                   # Task 3: 全部 Pydantic 请求/响应模型 + 通用响应
├── dependencies.py              # Task 3: get_db, get_current_user, require_admin
├── routers/
│   ├── auth.py                  # Task 4: /api/auth/*
│   ├── user.py                  # Task 5: /api/users/*
│   ├── book.py                  # Task 6: /api/books/*
│   ├── borrow.py                # Task 8: /api/borrows/*
│   ├── return.py                # Task 9: /api/returns/*
│   └── ai.py                    # Task 10: /api/ai/*
├── services/
│   ├── auth_service.py          # Task 4: register, authenticate, create_access_token
│   ├── user_service.py          # Task 5: CRUD + role/status 更新
│   ├── book_service.py          # Task 6: CRUD + 状态变更规则
│   ├── fine_service.py          # Task 7: calc_overdue_fine, calc_damage_compensation
│   ├── borrow_service.py        # Task 8: create_borrow, check_quota, scan_overdue
│   └── dify_client.py           # Task 10: generate_reminder, get_recommendations
templates/
├── base.html                    # Task 13: 公共布局（导航 + 面包屑 + 消息提示）
├── dashboard.html               # Task 13: 仪表盘首页
├── profile.html                 # Task 13: 个人中心
├── auth/login.html              # Task 13
├── auth/register.html           # Task 13
├── users/list.html              # Task 13
├── users/detail.html            # Task 13
├── books/list.html              # Task 13
├── books/form.html              # Task 13
├── borrow/new.html              # Task 13
├── borrow/list.html             # Task 13
├── borrow/overdue.html          # Task 13
└── return/new.html              # Task 13
static/
├── css/style.css                # Task 13
└── js/app.js                    # Task 13
scripts/
└── init_admin.py                # Task 14: 初始化超级管理员脚本
requirements.txt                 # Task 1
.env.example                     # Task 1
tests/
├── conftest.py                  # Task 1: pytest fixtures
├── test_fine_service.py         # Task 7
├── test_borrow_service.py       # Task 8
└── ...                          # 各 Task 附带测试
```

---

### Task 1: 项目脚手架 + 配置层

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/config.py`
- Create: `backend/database.py`
- Create: `backend/tests/conftest.py`

**Interfaces:**
- Produces: `settings: Settings` (config.py), `AsyncSessionLocal`, `engine`, `Base` (database.py)

- [ ] **Step 1: 创建 backend 目录结构和 requirements.txt**

```python
# requirements.txt
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
sqlalchemy>=2.0.0
aiomysql>=0.2.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.9
jinja2>=3.1.0
apscheduler>=3.10.0
httpx>=0.27.0
alembic>=1.13.0
python-dotenv>=1.0.0
pytest>=8.0.0
pytest-asyncio>=0.23.0
httpx>=0.27.0  # TestClient 也需要
```

- [ ] **Step 2: 创建 .env.example**

```
# 数据库
DATABASE_URL=mysql+aiomysql://root:password@localhost:3306/novel_rental

# JWT
SECRET_KEY=change-this-to-a-random-secret-key
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

- [ ] **Step 3: 实现 config.py**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    # 数据库
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 12

    # Dify API
    DIFY_API_BASE_URL: str = "https://api.dify.ai/v1"
    DIFY_API_KEY: str = ""
    DIFY_REMINDER_WORKFLOW_ID: str = ""
    DIFY_RECOMMEND_WORKFLOW_ID: str = ""

    # 服务器
    HOST: str = "0.0.0.0"
    PORT: int = 8000


settings = Settings()
```

- [ ] **Step 4: 实现 database.py**

```python
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from config import settings

engine: AsyncEngine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

- [ ] **Step 5: 创建 tests/conftest.py**

```python
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# 使用 SQLite 内存数据库做测试
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def db_session():
    engine = create_async_engine(TEST_DATABASE_URL)
    from database import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    TestSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with TestSessionLocal() as session:
        yield session
    await engine.dispose()
```

- [ ] **Step 6: 安装依赖并验证导入**

```bash
cd backend
pip install -r requirements.txt
python -c "from config import settings; from database import Base, AsyncSessionLocal; print('OK')"
```
Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/.env.example backend/config.py backend/database.py backend/tests/conftest.py
git commit -m "chore: init project scaffold with config and database"
```

---

### Task 2: 数据模型 (models.py)

**Files:**
- Create: `backend/models.py`

**Interfaces:**
- Consumes: `Base` (database.py)
- Produces: `User`, `Book`, `BorrowRecord`, `Fine`, `DamageRecord` SQLAlchemy 模型类，枚举 `UserRole`, `UserStatus`, `BookStatus`, `BorrowStatus`, `FineType`, `FineStatus`, `DamageLevel`

- [ ] **Step 1: 实现 models.py**

```python
from datetime import datetime, date
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    Integer, String, DECIMAL, DateTime, Date, Text, ForeignKey, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class UserRole(str, Enum):
    user = "user"
    admin = "admin"


class UserStatus(str, Enum):
    active = "active"
    frozen = "frozen"
    deleted = "deleted"


class BookStatus(str, Enum):
    available = "available"
    borrowed = "borrowed"
    repairing = "repairing"
    lost = "lost"


class BorrowStatus(str, Enum):
    borrowed = "borrowed"
    returned = "returned"
    overdue = "overdue"


class FineType(str, Enum):
    overdue = "overdue"
    damage = "damage"
    loss = "loss"


class FineStatus(str, Enum):
    unpaid = "unpaid"
    paid = "paid"


class DamageLevel(str, Enum):
    none = "none"
    minor = "minor"
    moderate = "moderate"
    severe = "severe"
    lost = "lost"


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    role: Mapped[UserRole] = mapped_column(default=UserRole.user)
    status: Mapped[UserStatus] = mapped_column(default=UserStatus.active)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    borrow_records: Mapped[list["BorrowRecord"]] = relationship(back_populates="user")
    fines: Mapped[list["Fine"]] = relationship(back_populates="user")

    __table_args__ = (Index("ix_users_username", "username"),)


class Book(Base):
    __tablename__ = "books"

    book_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    author: Mapped[str] = mapped_column(String(100), nullable=False)
    isbn: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    price: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    daily_rent: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    deposit: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    status: Mapped[BookStatus] = mapped_column(default=BookStatus.available)
    location: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    borrow_records: Mapped[list["BorrowRecord"]] = relationship(back_populates="book")

    __table_args__ = (Index("ix_books_isbn", "isbn"),)


class BorrowRecord(Base):
    __tablename__ = "borrow_records"

    borrow_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.book_id"), nullable=False)
    borrow_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    actual_return_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    daily_rate: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    deposit: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    status: Mapped[BorrowStatus] = mapped_column(default=BorrowStatus.borrowed)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="borrow_records")
    book: Mapped["Book"] = relationship(back_populates="borrow_records")
    fines: Mapped[list["Fine"]] = relationship(back_populates="borrow_record")
    damage_record: Mapped["DamageRecord | None"] = relationship(back_populates="borrow_record", uselist=False)

    __table_args__ = (
        Index("ix_borrow_records_borrow_date", "borrow_date"),
        Index("ix_borrow_records_due_date", "due_date"),
    )


class Fine(Base):
    __tablename__ = "fines"

    fine_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    borrow_id: Mapped[int] = mapped_column(ForeignKey("borrow_records.borrow_id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    type: Mapped[FineType] = mapped_column(nullable=False)
    status: Mapped[FineStatus] = mapped_column(default=FineStatus.unpaid)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    borrow_record: Mapped["BorrowRecord"] = relationship(back_populates="fines")
    user: Mapped["User"] = relationship(back_populates="fines")


class DamageRecord(Base):
    __tablename__ = "damage_records"

    record_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    borrow_id: Mapped[int] = mapped_column(ForeignKey("borrow_records.borrow_id"), nullable=False)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.book_id"), nullable=False)
    damage_level: Mapped[DamageLevel] = mapped_column(nullable=False)
    compensation: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    borrow_record: Mapped["BorrowRecord"] = relationship(back_populates="damage_record")
```

- [ ] **Step 2: 验证模型可创建**

```bash
cd backend
python -c "
import asyncio
from database import engine, Base

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Tables created OK')
    await engine.dispose()

asyncio.run(main())
"
```
Expected: `Tables created OK`

- [ ] **Step 3: Commit**

```bash
git add backend/models.py
git commit -m "feat: add SQLAlchemy models for all 5 tables + enums"
```

---

### Task 3: Schemas + 通用响应 + 依赖注入 + 密码工具

**Files:**
- Create: `backend/schemas.py`
- Create: `backend/dependencies.py`

**Interfaces:**
- Consumes: `UserRole`, `UserStatus`, `BookStatus`, `BorrowStatus`, `FineType`, `FineStatus`, `DamageLevel` (models.py), `settings` (config.py), `AsyncSessionLocal` (database.py)
- Produces: 所有 Pydantic 请求/响应模型类；`ResponseModel[T]` 通用响应；`get_db`, `get_current_user`, `require_admin`, `require_role` 依赖函数；`hash_password`, `verify_password`, `create_access_token` 工具函数

- [ ] **Step 1: 实现 schemas.py**

```python
from datetime import datetime, date
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, Field, field_validator

from models import UserRole, UserStatus, BookStatus, BorrowStatus, FineType, FineStatus, DamageLevel

T = TypeVar("T")


# ========== 通用响应 ==========

class ResponseModel(BaseModel, Generic[T]):
    code: int = 0
    message: str = "ok"
    data: T | None = None


# ========== 认证 ==========

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6)
    password_confirm: str
    phone: str | None = None
    email: str | None = None

    @field_validator("password_confirm")
    @classmethod
    def passwords_match(cls, v, info):
        if v != info.data.get("password"):
            raise ValueError("两次密码不一致")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ========== 用户 ==========

class UserBase(BaseModel):
    username: str
    phone: str | None = None
    email: str | None = None


class UserCreate(UserBase):
    password: str = Field(min_length=6)
    role: UserRole = UserRole.user


class UserUpdate(BaseModel):
    phone: str | None = None
    email: str | None = None


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserStatusUpdate(BaseModel):
    status: UserStatus


class UserResponse(BaseModel):
    user_id: int
    username: str
    phone: str | None
    email: str | None
    role: UserRole
    status: UserStatus
    created_at: datetime

    model_config = {"from_attributes": True}


# ========== 图书 ==========

class BookBase(BaseModel):
    title: str = Field(max_length=200)
    author: str = Field(max_length=100)
    isbn: str | None = Field(default=None, max_length=20)
    category: str | None = Field(default=None, max_length=50)
    price: Decimal = Field(gt=0)
    daily_rent: Decimal = Field(gt=0)
    deposit: Decimal = Field(ge=0)
    location: str | None = Field(default=None, max_length=50)


class BookCreate(BookBase):
    pass


class BookUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    author: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=50)
    price: Decimal | None = Field(default=None, gt=0)
    daily_rent: Decimal | None = Field(default=None, gt=0)
    deposit: Decimal | None = Field(default=None, ge=0)
    location: str | None = Field(default=None, max_length=50)


class BookStatusUpdate(BaseModel):
    status: BookStatus


class BookResponse(BaseModel):
    book_id: int
    title: str
    author: str
    isbn: str | None
    category: str | None
    price: Decimal
    daily_rent: Decimal
    deposit: Decimal
    status: BookStatus
    location: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ========== 借阅 ==========

class BorrowCreate(BaseModel):
    user_id: int
    book_id: int
    days: int = Field(ge=1, le=30)


class BorrowResponse(BaseModel):
    borrow_id: int
    user_id: int
    book_id: int
    borrow_date: date
    due_date: date
    actual_return_date: date | None
    daily_rate: Decimal
    deposit: Decimal
    status: BorrowStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class BorrowListResponse(BorrowResponse):
    username: str | None = None
    book_title: str | None = None


# ========== 归还 ==========

class ReturnCreate(BaseModel):
    borrow_id: int | None = None
    user_id: int | None = None
    book_id: int | None = None
    damage_level: DamageLevel = DamageLevel.none
    description: str | None = None


class FineResponse(BaseModel):
    fine_id: int
    borrow_id: int
    user_id: int
    amount: Decimal
    type: FineType
    status: FineStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class DamageRecordResponse(BaseModel):
    record_id: int
    borrow_id: int
    book_id: int
    damage_level: DamageLevel
    compensation: Decimal
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReturnSummary(BaseModel):
    borrow_id: int
    book_title: str
    actual_return_date: date
    overdue_days: int
    overdue_fine: Decimal
    damage_compensation: Decimal
    total_fine: Decimal
    fines: list[FineResponse]
    damage_record: DamageRecordResponse | None
    deposit_refund: Decimal
```

- [ ] **Step 2: 实现 dependencies.py**

```python
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import settings
from database import AsyncSessionLocal
from models import User, UserRole, UserStatus

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# ========== 密码工具 ==========

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ========== JWT 工具 ==========

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


# ========== FastAPI 依赖 ==========

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    token: Annotated[str | None, Depends(oauth2_scheme)] = None,
) -> User:
    # 先尝试 OAuth2 token
    token_to_use = token
    # 再尝试 cookie 中的 token
    if not token_to_use:
        token_to_use = request.cookies.get("access_token")

    if not token_to_use:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")

    payload = decode_token(token_to_use)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token 无效")

    user_id: int | None = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token 无效")

    result = await db.execute(select(User).where(User.user_id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user or user.status != UserStatus.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或已被冻结")

    return user


async def require_admin(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")
    return current_user


async def require_role(*roles: UserRole):
    async def checker(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")
        return current_user
    return checker
```

- [ ] **Step 3: 验证 schemas 和依赖注入**

```bash
cd backend
python -c "from schemas import *; from dependencies import hash_password, verify_password; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/schemas.py backend/dependencies.py
git commit -m "feat: add Pydantic schemas, password hashing, JWT auth dependencies"
```

---

### Task 4: 认证模块（auth_service + routers/auth）

**Files:**
- Create: `backend/services/__init__.py`
- Create: `backend/services/auth_service.py`
- Create: `backend/routers/__init__.py`
- Create: `backend/routers/auth.py`
- Create: `backend/tests/test_auth.py`

**Interfaces:**
- Consumes: `User`, `UserStatus` (models.py), `hash_password`, `verify_password`, `create_access_token` (dependencies.py)
- Produces: `register_user()`, `authenticate_user()` (auth_service.py); `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` (auth.py)

- [ ] **Step 1: 实现 services/auth_service.py**

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import User, UserRole, UserStatus
from schemas import RegisterRequest, LoginRequest
from dependencies import hash_password, verify_password


async def register_user(db: AsyncSession, req: RegisterRequest) -> User:
    result = await db.execute(select(User).where(User.username == req.username))
    if result.scalar_one_or_none():
        raise ValueError("用户名已存在")

    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        phone=req.phone,
        email=req.email,
        role=UserRole.user,
        status=UserStatus.active,
    )
    db.add(user)
    await db.flush()
    return user


async def authenticate_user(db: AsyncSession, req: LoginRequest) -> User | None:
    result = await db.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()
    if not user:
        return None
    if user.status != UserStatus.active:
        return None
    if not verify_password(req.password, user.password_hash):
        return None
    return user
```

- [ ] **Step 2: 实现 routers/auth.py**

```python
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas import (
    RegisterRequest, LoginRequest, TokenResponse,
    UserResponse, ResponseModel
)
from services.auth_service import register_user, authenticate_user
from dependencies import create_access_token, get_current_user
from models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=ResponseModel[UserResponse])
async def register(req: RegisterRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    try:
        user = await register_user(db, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseModel(data=UserResponse.model_validate(user))


@router.post("/login", response_model=ResponseModel[TokenResponse])
async def login(req: LoginRequest, response: Response, db: Annotated[AsyncSession, Depends(get_db)]):
    user = await authenticate_user(db, req)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    token = create_access_token({"sub": str(user.user_id)})
    response.set_cookie(
        key="access_token", value=token, httponly=True, samesite="lax",
    )
    return ResponseModel(data=TokenResponse(access_token=token))


@router.post("/logout", response_model=ResponseModel[None])
async def logout(response: Response, _: Annotated[User, Depends(get_current_user)]):
    response.delete_cookie("access_token")
    return ResponseModel(message="已退出登录")
```

- [ ] **Step 3: 编写测试 tests/test_auth.py**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from database import Base, AsyncSessionLocal, engine
from routers.auth import router as auth_router

app = FastAPI()
app.include_router(auth_router)


@pytest.fixture
async def client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    # 注册
    resp = await client.post("/api/auth/register", json={
        "username": "testuser", "password": "password123", "password_confirm": "password123",
    })
    assert resp.status_code == 200
    assert resp.json()["data"]["username"] == "testuser"

    # 用户名重复
    resp = await client.post("/api/auth/register", json={
        "username": "testuser", "password": "password123", "password_confirm": "password123",
    })
    assert resp.status_code == 400

    # 登录
    resp = await client.post("/api/auth/login", json={
        "username": "testuser", "password": "password123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()["data"]

    # 密码错误
    resp = await client.post("/api/auth/login", json={
        "username": "testuser", "password": "wrongpw",
    })
    assert resp.status_code == 401
```

- [ ] **Step 4: 运行测试**

```bash
cd backend
pytest tests/test_auth.py -v
```
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/services/__init__.py backend/services/auth_service.py backend/routers/__init__.py backend/routers/auth.py backend/tests/test_auth.py
git commit -m "feat: auth module - register, login with JWT"
```

---

### Task 5: 用户管理模块

**Files:**
- Create: `backend/services/user_service.py`
- Create: `backend/routers/user.py`

**Interfaces:**
- Consumes: `User`, `UserRole`, `UserStatus`, `BorrowRecord` (models.py)
- Produces: `create_user()`, `list_users()`, `get_user()`, `update_user()`, `update_user_role()`, `update_user_status()`, `delete_user()`, `get_user_borrow_history()` (user_service.py); `/api/users` CRUD (user.py)

- [ ] **Step 1: 实现 services/user_service.py**

```python
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import User, UserRole, UserStatus, BorrowRecord, BorrowStatus
from schemas import UserCreate, UserUpdate, UserRoleUpdate, UserStatusUpdate
from dependencies import hash_password


async def create_user(db: AsyncSession, data: UserCreate) -> User:
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise ValueError("用户名已存在")
    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        phone=data.phone,
        email=data.email,
        role=data.role,
        status=UserStatus.active,
    )
    db.add(user)
    await db.flush()
    return user


async def list_users(db: AsyncSession, keyword: str | None = None, page: int = 1, page_size: int = 20) -> tuple[list[User], int]:
    query = select(User).where(User.status != UserStatus.deleted)
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()
    if keyword:
        query = query.where(
            (User.username.contains(keyword)) |
            (User.phone.contains(keyword)) |
            (User.email.contains(keyword))
        )
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query.order_by(User.user_id))
    return list(result.scalars().all()), total


async def get_user(db: AsyncSession, user_id: int) -> User | None:
    result = await db.execute(
        select(User).where(User.user_id == user_id, User.status != UserStatus.deleted)
    )
    return result.scalar_one_or_none()


async def update_user(db: AsyncSession, user: User, data: UserUpdate) -> User:
    for field in ("phone", "email"):
        new_val = getattr(data, field)
        if new_val is not None:
            setattr(user, field, new_val)
    return user


async def update_user_role(db: AsyncSession, user: User, data: UserRoleUpdate) -> User:
    # 系统管理员不能被降级为普通用户（本项目只有一个 admin 级别）
    user.role = data.role
    return user


async def update_user_status(db: AsyncSession, user: User, data: UserStatusUpdate) -> User:
    # 冻结前检查是否有未还图书
    if data.status == UserStatus.frozen:
        count_result = await db.execute(
            select(func.count()).select_from(BorrowRecord).where(
                BorrowRecord.user_id == user.user_id,
                BorrowRecord.status.in_([BorrowStatus.borrowed, BorrowStatus.overdue]),
            )
        )
        if count_result.scalar_one() > 0:
            raise ValueError("该用户有未还图书，无法冻结")
    user.status = data.status
    return user


async def delete_user(db: AsyncSession, user: User) -> None:
    # 检查未还图书
    count_result = await db.execute(
        select(func.count()).select_from(BorrowRecord).where(
            BorrowRecord.user_id == user.user_id,
            BorrowRecord.status.in_([BorrowStatus.borrowed, BorrowStatus.overdue]),
        )
    )
    if count_result.scalar_one() > 0:
        raise ValueError("该用户有未还图书，无法删除")
    user.status = UserStatus.deleted


async def get_user_borrow_history(db: AsyncSession, user_id: int) -> list[BorrowRecord]:
    result = await db.execute(
        select(BorrowRecord)
        .options(selectinload(BorrowRecord.book))
        .where(BorrowRecord.user_id == user_id)
        .order_by(BorrowRecord.borrow_date.desc())
    )
    return list(result.scalars().all())
```

- [ ] **Step 2: 实现 routers/user.py**

```python
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user, require_admin, require_role
from models import User, UserRole
from schemas import (
    UserCreate, UserUpdate, UserRoleUpdate, UserStatusUpdate,
    UserResponse, BorrowResponse, ResponseModel,
)
from services import user_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=ResponseModel[dict])
async def list_users(
    keyword: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: Annotated[User, Depends(require_admin)] = None,
    db: AsyncSession = Depends(get_db),
):
    users, total = await user_service.list_users(db, keyword, page, page_size)
    return ResponseModel(data={
        "items": [UserResponse.model_validate(u) for u in users],
        "total": total,
        "page": page,
        "page_size": page_size,
    })


@router.post("", response_model=ResponseModel[UserResponse])
async def create_user(
    data: UserCreate,
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await user_service.create_user(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseModel(data=UserResponse.model_validate(user))


@router.get("/{user_id}", response_model=ResponseModel[UserResponse])
async def get_user(
    user_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.admin and current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="只能查看自己的信息")
    user = await user_service.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return ResponseModel(data=UserResponse.model_validate(user))


@router.put("/{user_id}", response_model=ResponseModel[UserResponse])
async def update_user(
    user_id: int,
    data: UserUpdate,
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    user = await user_service.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user = await user_service.update_user(db, user, data)
    return ResponseModel(data=UserResponse.model_validate(user))


@router.put("/{user_id}/role", response_model=ResponseModel[UserResponse])
async def update_user_role(
    user_id: int,
    data: UserRoleUpdate,
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    user = await user_service.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user = await user_service.update_user_role(db, user, data)
    return ResponseModel(data=UserResponse.model_validate(user))


@router.put("/{user_id}/status", response_model=ResponseModel[UserResponse])
async def update_user_status(
    user_id: int,
    data: UserStatusUpdate,
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    user = await user_service.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    try:
        user = await user_service.update_user_status(db, user, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseModel(data=UserResponse.model_validate(user))


@router.delete("/{user_id}", response_model=ResponseModel[None])
async def delete_user(
    user_id: int,
    admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    user = await user_service.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    try:
        await user_service.delete_user(db, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseModel(message="用户已删除")


@router.get("/{user_id}/borrows", response_model=ResponseModel[list[BorrowResponse]])
async def get_user_borrows(
    user_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.admin and current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="只能查看自己的借阅记录")
    records = await user_service.get_user_borrow_history(db, user_id)
    return ResponseModel(data=[BorrowResponse.model_validate(r) for r in records])
```

- [ ] **Step 3: Commit**

```bash
git add backend/services/user_service.py backend/routers/user.py
git commit -m "feat: user management CRUD with role/status management"
```

---

### Task 6: 图书管理模块

**Files:**
- Create: `backend/services/book_service.py`
- Create: `backend/routers/book.py`

**Interfaces:**
- Consumes: `Book`, `BookStatus` (models.py)
- Produces: `create_book()`, `list_books()`, `get_book()`, `update_book()`, `update_book_status()`, `delete_book()` (book_service.py); `/api/books` CRUD (book.py)

- [ ] **Step 1: 实现 services/book_service.py**

```python
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from models import Book, BookStatus
from schemas import BookCreate, BookUpdate, BookStatusUpdate


async def create_book(db: AsyncSession, data: BookCreate) -> Book:
    if data.isbn:
        result = await db.execute(select(Book).where(Book.isbn == data.isbn))
        if result.scalar_one_or_none():
            raise ValueError("ISBN 已存在")
    book = Book(
        title=data.title, author=data.author, isbn=data.isbn,
        category=data.category, price=data.price, daily_rent=data.daily_rent,
        deposit=data.deposit, status=BookStatus.available, location=data.location,
    )
    db.add(book)
    await db.flush()
    return book


async def list_books(
    db: AsyncSession, keyword: str | None = None,
    page: int = 1, page_size: int = 20,
) -> tuple[list[Book], int]:
    query = select(Book)
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    if keyword:
        query = query.where(or_(
            Book.title.contains(keyword),
            Book.author.contains(keyword),
            Book.isbn.contains(keyword),
            Book.category.contains(keyword),
        ))
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query.order_by(Book.book_id))
    return list(result.scalars().all()), total


async def get_book(db: AsyncSession, book_id: int) -> Book | None:
    result = await db.execute(select(Book).where(Book.book_id == book_id))
    return result.scalar_one_or_none()


async def update_book(db: AsyncSession, book: Book, data: BookUpdate) -> Book:
    # 只有 available 状态可编辑基本信息
    if book.status != BookStatus.available:
        # 仅允许更新 location
        if data.location is not None:
            book.location = data.location
        return book

    updatable = ["title", "author", "category", "price", "daily_rent", "deposit", "location"]
    for field in updatable:
        new_val = getattr(data, field)
        if new_val is not None:
            setattr(book, field, new_val)
    return book


async def update_book_status(db: AsyncSession, book: Book, data: BookStatusUpdate) -> Book:
    # borrowed -> available 禁止手动
    if book.status == BookStatus.borrowed and data.status == BookStatus.available:
        raise ValueError("借出的图书不能手动标记为在库，请通过归还流程操作")
    book.status = data.status
    return book


async def delete_book(db: AsyncSession, book: Book) -> None:
    if book.status == BookStatus.borrowed:
        raise ValueError("借出中的图书无法删除")
    book.status = BookStatus.lost
```

- [ ] **Step 2: 实现 routers/book.py**

```python
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user, require_role
from models import User, UserRole, BookStatus
from schemas import (
    BookCreate, BookUpdate, BookStatusUpdate,
    BookResponse, ResponseModel,
)
from services import book_service

router = APIRouter(prefix="/api/books", tags=["books"])


@router.get("", response_model=ResponseModel[dict])
async def list_books(
    keyword: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db),
):
    books, total = await book_service.list_books(db, keyword, page, page_size)
    return ResponseModel(data={
        "items": [BookResponse.model_validate(b) for b in books],
        "total": total, "page": page, "page_size": page_size,
    })


@router.get("/{book_id}", response_model=ResponseModel[BookResponse])
async def get_book(
    book_id: int,
    _: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db),
):
    book = await book_service.get_book(db, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="图书不存在")
    return ResponseModel(data=BookResponse.model_validate(book))


@router.post("", response_model=ResponseModel[BookResponse])
async def create_book(
    data: BookCreate,
    _: Annotated[User, Depends(require_role(UserRole.admin))],
    db: AsyncSession = Depends(get_db),
):
    try:
        book = await book_service.create_book(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseModel(data=BookResponse.model_validate(book))


@router.put("/{book_id}", response_model=ResponseModel[BookResponse])
async def update_book(
    book_id: int, data: BookUpdate,
    _: Annotated[User, Depends(require_role(UserRole.admin))],
    db: AsyncSession = Depends(get_db),
):
    book = await book_service.get_book(db, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="图书不存在")
    book = await book_service.update_book(db, book, data)
    return ResponseModel(data=BookResponse.model_validate(book))


@router.put("/{book_id}/status", response_model=ResponseModel[BookResponse])
async def update_book_status(
    book_id: int, data: BookStatusUpdate,
    _: Annotated[User, Depends(require_role(UserRole.admin))],
    db: AsyncSession = Depends(get_db),
):
    book = await book_service.get_book(db, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="图书不存在")
    try:
        book = await book_service.update_book_status(db, book, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseModel(data=BookResponse.model_validate(book))


@router.delete("/{book_id}", response_model=ResponseModel[None])
async def delete_book(
    book_id: int,
    _: Annotated[User, Depends(require_role(UserRole.admin))],
    db: AsyncSession = Depends(get_db),
):
    book = await book_service.get_book(db, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="图书不存在")
    try:
        await book_service.delete_book(db, book)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseModel(message="图书已标记为丢失")
```

- [ ] **Step 3: Commit**

```bash
git add backend/services/book_service.py backend/routers/book.py
git commit -m "feat: book management CRUD with status rules"
```

---

### Task 7: 费用结算服务（fine_service）

**Files:**
- Create: `backend/services/fine_service.py`
- Create: `backend/tests/test_fine_service.py`

**Interfaces:**
- Consumes: `DamageLevel` (models.py)
- Produces: `calc_overdue_fine()`, `calc_damage_compensation()` 纯函数；`create_fine()`, `create_damage_record()` 数据库操作函数

- [ ] **Step 1: 实现 services/fine_service.py**

```python
from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from models import Fine, FineType, FineStatus, DamageRecord, DamageLevel, BorrowRecord, User, Book


# 损坏等级 → 赔偿比例
DAMAGE_COMPENSATION_RATES: dict[DamageLevel, Decimal] = {
    DamageLevel.none: Decimal("0"),
    DamageLevel.minor: Decimal("0.10"),
    DamageLevel.moderate: Decimal("0.30"),
    DamageLevel.severe: Decimal("1.00"),
    DamageLevel.lost: Decimal("1.50"),
}

OVERDUE_MULTIPLIER = Decimal("1.5")


def calc_overdue_fine(due_date: date, actual_return_date: date, daily_rate: Decimal) -> Decimal:
    """逾期费用 = 逾期天数 × 日租金 × 1.5"""
    overdue_days = (actual_return_date - due_date).days
    if overdue_days <= 0:
        return Decimal("0")
    return (Decimal(overdue_days) * daily_rate * OVERDUE_MULTIPLIER).quantize(Decimal("0.01"))


def calc_damage_compensation(price: Decimal, damage_level: DamageLevel) -> Decimal:
    """损坏赔偿 = 图书定价 × 赔偿比例"""
    rate = DAMAGE_COMPENSATION_RATES[damage_level]
    return (price * rate).quantize(Decimal("0.01"))


async def create_fine(
    db: AsyncSession, borrow_id: int, user_id: int,
    amount: Decimal, fine_type: FineType,
) -> Fine:
    fine = Fine(
        borrow_id=borrow_id, user_id=user_id,
        amount=amount, type=fine_type, status=FineStatus.unpaid,
    )
    db.add(fine)
    await db.flush()
    return fine


async def create_damage_record(
    db: AsyncSession, borrow_id: int, book_id: int,
    damage_level: DamageLevel, compensation: Decimal,
    description: str | None = None,
) -> DamageRecord:
    record = DamageRecord(
        borrow_id=borrow_id, book_id=book_id,
        damage_level=damage_level, compensation=compensation,
        description=description,
    )
    db.add(record)
    await db.flush()
    return record
```

- [ ] **Step 2: 编写测试 tests/test_fine_service.py**

```python
from datetime import date, timedelta
from decimal import Decimal

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.fine_service import calc_overdue_fine, calc_damage_compensation
from models import DamageLevel


def test_calc_overdue_fine_no_overdue():
    due = date(2026, 9, 1)
    actual = date(2026, 9, 1)
    assert calc_overdue_fine(due, actual, Decimal("0.50")) == Decimal("0")


def test_calc_overdue_fine_with_overdue():
    due = date(2026, 9, 1)
    actual = date(2026, 9, 4)  # 逾期 3 天
    # 3 × 0.50 × 1.5 = 2.25
    result = calc_overdue_fine(due, actual, Decimal("0.50"))
    assert result == Decimal("2.25")


def test_calc_overdue_fine_actual_before_due():
    due = date(2026, 9, 5)
    actual = date(2026, 9, 1)
    assert calc_overdue_fine(due, actual, Decimal("0.50")) == Decimal("0")


def test_calc_damage_compensation():
    price = Decimal("29.90")
    assert calc_damage_compensation(price, DamageLevel.none) == Decimal("0")
    assert calc_damage_compensation(price, DamageLevel.minor) == Decimal("2.99")
    assert calc_damage_compensation(price, DamageLevel.moderate) == Decimal("8.97")
    assert calc_damage_compensation(price, DamageLevel.severe) == Decimal("29.90")
    assert calc_damage_compensation(price, DamageLevel.lost) == Decimal("44.85")
```

- [ ] **Step 3: 运行测试**

```bash
cd backend
pytest tests/test_fine_service.py -v
```
Expected: 6 passed

- [ ] **Step 4: Commit**

```bash
git add backend/services/fine_service.py backend/tests/test_fine_service.py
git commit -m "feat: fine calculation service + tests for overdue/damage formulas"
```

---

### Task 8: 借阅管理模块

**Files:**
- Create: `backend/services/borrow_service.py`
- Create: `backend/routers/borrow.py`

**Interfaces:**
- Consumes: `User`, `Book`, `BorrowRecord`, `BookStatus`, `BorrowStatus` (models.py), `calc_overdue_fine()` (fine_service.py)
- Produces: `create_borrow()`, `check_borrow_quota()`, `list_borrows()`, `list_overdue()`, `scan_overdue_records()` (borrow_service.py); `/api/borrows` 路由 (borrow.py)

- [ ] **Step 1: 实现 services/borrow_service.py**

```python
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import (
    User, Book, BorrowRecord, BookStatus, BorrowStatus, UserStatus,
)
from schemas import BorrowCreate

MAX_BORROW_COUNT = 5
MAX_BORROW_DAYS = 30


async def check_borrow_quota(db: AsyncSession, user_id: int) -> int:
    """返回用户当前借阅数量（未归还的）"""
    result = await db.execute(
        select(func.count()).select_from(BorrowRecord).where(
            BorrowRecord.user_id == user_id,
            BorrowRecord.status.in_([BorrowStatus.borrowed, BorrowStatus.overdue]),
        )
    )
    return result.scalar_one()


async def create_borrow(db: AsyncSession, data: BorrowCreate) -> BorrowRecord:
    # 校验用户
    user_result = await db.execute(select(User).where(User.user_id == data.user_id))
    user = user_result.scalar_one_or_none()
    if not user or user.status != UserStatus.active:
        raise ValueError("用户不存在或已失效")

    # 校验图书
    book_result = await db.execute(select(Book).where(Book.book_id == data.book_id))
    book = book_result.scalar_one_or_none()
    if not book:
        raise ValueError("图书不存在")
    if book.status != BookStatus.available:
        raise ValueError(f"图书当前不可借（状态：{book.status.value}）")

    # 配额检查
    current_count = await check_borrow_quota(db, data.user_id)
    if current_count >= MAX_BORROW_COUNT:
        raise ValueError(f"用户已借阅 {current_count} 本，达到上限 {MAX_BORROW_COUNT}")

    # 期限检查
    if data.days > MAX_BORROW_DAYS:
        raise ValueError(f"单次借阅最长 {MAX_BORROW_DAYS} 天")

    today = date.today()
    borrow = BorrowRecord(
        user_id=data.user_id,
        book_id=data.book_id,
        borrow_date=today,
        due_date=today + timedelta(days=data.days),
        actual_return_date=None,
        daily_rate=book.daily_rent,
        deposit=book.deposit,
        status=BorrowStatus.borrowed,
    )
    db.add(borrow)
    book.status = BookStatus.borrowed
    await db.flush()
    return borrow


async def list_borrows(
    db: AsyncSession,
    user_id: int | None = None,
    book_id: int | None = None,
    status: BorrowStatus | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    page: int = 1, page_size: int = 20,
) -> tuple[list[BorrowRecord], int]:
    query = select(BorrowRecord).options(
        selectinload(BorrowRecord.user),
        selectinload(BorrowRecord.book),
    )
    if user_id is not None:
        query = query.where(BorrowRecord.user_id == user_id)
    if book_id is not None:
        query = query.where(BorrowRecord.book_id == book_id)
    if status is not None:
        query = query.where(BorrowRecord.status == status)
    if start_date:
        query = query.where(BorrowRecord.borrow_date >= start_date)
    if end_date:
        query = query.where(BorrowRecord.borrow_date <= end_date)

    count_query = select(func.count()).select_from(
        query.options(selectinload(BorrowRecord.user), selectinload(BorrowRecord.book)).subquery()
    )
    total_result = await db.execute(select(func.count()).select_from(
        select(BorrowRecord).where(*query.where_criteria).subquery()
    ) if query.where_criteria else select(func.count()).select_from(BorrowRecord))
    total = total_result.scalar_one()

    query = query.order_by(BorrowRecord.borrow_date.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def list_overdue(db: AsyncSession) -> list[BorrowRecord]:
    today = date.today()
    result = await db.execute(
        select(BorrowRecord)
        .options(selectinload(BorrowRecord.user), selectinload(BorrowRecord.book))
        .where(
            BorrowRecord.status.in_([BorrowStatus.borrowed, BorrowStatus.overdue]),
            BorrowRecord.due_date < today,
        )
        .order_by(BorrowRecord.due_date)
    )
    records = list(result.scalars().all())
    # 更新状态为 overdue
    for r in records:
        if r.status == BorrowStatus.borrowed:
            r.status = BorrowStatus.overdue
    return records


async def scan_overdue_records(db: AsyncSession) -> list[BorrowRecord]:
    """定时任务入口：扫描并更新逾期状态"""
    return await list_overdue(db)
```

- [ ] **Step 2: 实现 routers/borrow.py**

```python
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user, require_role
from models import User, UserRole, BorrowStatus
from schemas import (
    BorrowCreate, BorrowResponse, ResponseModel,
)
from services import borrow_service

router = APIRouter(prefix="/api/borrows", tags=["borrows"])


@router.get("", response_model=ResponseModel[dict])
async def list_borrows(
    user_id: int | None = None,
    book_id: int | None = None,
    status: BorrowStatus | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db),
):
    # 普通用户只能查自己
    if current_user.role != UserRole.admin and user_id is None:
        user_id = current_user.user_id
    if current_user.role != UserRole.admin and user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="只能查看自己的借阅记录")

    records, total = await borrow_service.list_borrows(
        db, user_id, book_id, status, start_date, end_date, page, page_size,
    )
    return ResponseModel(data={
        "items": [BorrowResponse.model_validate(r) for r in records],
        "total": total, "page": page, "page_size": page_size,
    })


@router.post("", response_model=ResponseModel[BorrowResponse])
async def create_borrow(
    data: BorrowCreate,
    _: Annotated[User, Depends(require_role(UserRole.admin))],
    db: AsyncSession = Depends(get_db),
):
    try:
        borrow = await borrow_service.create_borrow(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseModel(data=BorrowResponse.model_validate(borrow))


@router.get("/overdue", response_model=ResponseModel[list[BorrowResponse]])
async def list_overdue(
    _: Annotated[User, Depends(require_role(UserRole.admin))],
    db: AsyncSession = Depends(get_db),
):
    records = await borrow_service.list_overdue(db)
    return ResponseModel(data=[BorrowResponse.model_validate(r) for r in records])


@router.post("/overdue/remind", response_model=ResponseModel[list[BorrowResponse]])
async def trigger_overdue_remind(
    _: Annotated[User, Depends(require_role(UserRole.admin))],
    db: AsyncSession = Depends(get_db),
):
    records = await borrow_service.scan_overdue_records(db)
    # 实际 Dify 调用在 Task 10 实现，这里先返回逾期记录
    return ResponseModel(data=[BorrowResponse.model_validate(r) for r in records])
```

- [ ] **Step 3: Commit**

```bash
git add backend/services/borrow_service.py backend/routers/borrow.py
git commit -m "feat: borrow management with quota check and overdue scan"
```

---

### Task 9: 归还管理模块

**Files:**
- Create: `backend/routers/return.py`

**Interfaces:**
- Consumes: `BorrowRecord`, `Book`, `BookStatus`, `BorrowStatus`, `DamageRecord`, `Fine`, `FineType`, `FineStatus`, `DamageLevel` (models.py); `calc_overdue_fine()`, `calc_damage_compensation()`, `create_fine()`, `create_damage_record()` (fine_service.py); `get_book()`, `update_book_status()` (book_service.py); `get_user_borrow_history()` (user_service.py)
- Produces: `/api/returns` 路由，办理归还 + 损坏检查 + 费用结算

- [ ] **Step 1: 实现 routers/return.py**

归还逻辑直接写在 service 层会更清晰，但为了减少 service 文件数量，直接写在这里（实际上是 controller 层直接编排多个 service 调用 + 数据库操作）。考虑到复杂度，还是在 borrow_service.py 旁边加个 `return_service.py`。

让我重新规划——创建 `backend/services/return_service.py`：

```python
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import (
    BorrowRecord, Book, BookStatus, BorrowStatus,
    Fine, FineType, FineStatus, DamageRecord, DamageLevel,
)
from schemas import ReturnCreate, ReturnSummary, FineResponse, DamageRecordResponse
from services.fine_service import (
    calc_overdue_fine, calc_damage_compensation,
    create_fine, create_damage_record,
)


async def find_borrow_record(
    db: AsyncSession,
    borrow_id: int | None = None,
    user_id: int | None = None,
    book_id: int | None = None,
) -> BorrowRecord | None:
    query = select(BorrowRecord).where(BorrowRecord.status.in_([BorrowStatus.borrowed, BorrowStatus.overdue]))
    if borrow_id:
        query = query.where(BorrowRecord.borrow_id == borrow_id)
    elif user_id and book_id:
        query = query.where(
            BorrowRecord.user_id == user_id,
            BorrowRecord.book_id == book_id,
        )
    else:
        return None
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def process_return(db: AsyncSession, data: ReturnCreate) -> ReturnSummary:
    # 1. 查找借阅记录
    borrow = await find_borrow_record(db, data.borrow_id, data.user_id, data.book_id)
    if not borrow:
        raise ValueError("未找到对应的未归还借阅记录")

    # 加载图书信息
    book_result = await db.execute(select(Book).where(Book.book_id == borrow.book_id))
    book = book_result.scalar_one_or_none()
    if not book:
        raise ValueError("对应图书不存在")

    # 2. 损坏检查 + 赔偿
    damage_record: DamageRecord | None = None
    damage_compensation = Decimal("0")
    if data.damage_level != DamageLevel.none:
        damage_compensation = calc_damage_compensation(book.price, data.damage_level)
        damage_record = await create_damage_record(
            db, borrow.borrow_id, book.book_id,
            data.damage_level, damage_compensation, data.description,
        )

    # 3. 逾期费用
    today = date.today()
    overdue_fine = calc_overdue_fine(borrow.due_date, today, borrow.daily_rate)
    overdue_days = max((today - borrow.due_date).days, 0) if today > borrow.due_date else 0

    # 4. 更新借阅记录
    borrow.actual_return_date = today
    borrow.status = BorrowStatus.returned

    # 5. 更新图书状态
    if data.damage_level == DamageLevel.lost:
        book.status = BookStatus.lost
    elif data.damage_level != DamageLevel.none:
        book.status = BookStatus.repairing
    else:
        book.status = BookStatus.available

    # 6. 创建费用记录
    fines: list[Fine] = []
    total_fine = Decimal("0")
    if overdue_fine > 0:
        fine = await create_fine(db, borrow.borrow_id, borrow.user_id, overdue_fine, FineType.overdue)
        fines.append(fine)
        total_fine += overdue_fine
    if damage_compensation > 0:
        fine = await create_fine(db, borrow.borrow_id, borrow.user_id, damage_compensation,
                                  FineType.loss if data.damage_level == DamageLevel.lost else FineType.damage)
        fines.append(fine)
        total_fine += damage_compensation

    # 7. 计算押金退还
    deposit_refund = (borrow.deposit - total_fine).quantize(Decimal("0.01"))
    if deposit_refund < 0:
        deposit_refund = Decimal("0")

    return ReturnSummary(
        borrow_id=borrow.borrow_id,
        book_title=book.title,
        actual_return_date=today,
        overdue_days=overdue_days,
        overdue_fine=overdue_fine,
        damage_compensation=damage_compensation,
        total_fine=total_fine,
        fines=[FineResponse.model_validate(f) for f in fines],
        damage_record=DamageRecordResponse.model_validate(damage_record) if damage_record else None,
        deposit_refund=deposit_refund,
    )
```

然后 routers/return.py：

```python
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import require_role
from models import User, UserRole
from schemas import ReturnCreate, ReturnSummary, ResponseModel
from services.return_service import process_return

router = APIRouter(prefix="/api/returns", tags=["returns"])


@router.post("", response_model=ResponseModel[ReturnSummary])
async def process_return_endpoint(
    data: ReturnCreate,
    _: Annotated[User, Depends(require_role(UserRole.admin))],
    db: AsyncSession = Depends(get_db),
):
    try:
        summary = await process_return(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseModel(data=summary)
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/return_service.py backend/routers/return.py
git commit -m "feat: return processing with damage check and fine settlement"
```

---

### Task 10: Dify API 客户端 + AI 路由

**Files:**
- Create: `backend/services/dify_client.py`
- Create: `backend/routers/ai.py`

**Interfaces:**
- Consumes: `settings` (config.py), `httpx`
- Produces: `generate_overdue_reminder()`, `get_reading_recommendations()` (dify_client.py); `/api/ai/reminder`, `/api/ai/recommendations` (ai.py)

- [ ] **Step 1: 实现 services/dify_client.py**

```python
import json
from typing import Any

import httpx

from config import settings


async def call_dify_workflow(
    workflow_id: str, inputs: dict[str, Any], timeout: float = 30.0,
) -> dict[str, Any]:
    """调用 Dify 工作流 API（异步模式）"""
    if not settings.DIFY_API_KEY or not workflow_id:
        # 未配置时返回模拟结果，方便本地开发
        return {"text": f"[模拟输出] inputs={inputs}"}

    url = f"{settings.DIFY_API_BASE_URL}/workflows/run"
    headers = {
        "Authorization": f"Bearer {settings.DIFY_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "inputs": inputs,
        "response_mode": "blocking",
        "user": "system",
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("data", {}).get("outputs", data)


async def generate_overdue_reminder(
    username: str, book_title: str, overdue_days: int,
) -> str:
    """生成逾期提醒文案"""
    result = await call_dify_workflow(
        workflow_id=settings.DIFY_REMINDER_WORKFLOW_ID,
        inputs={
            "username": username,
            "book_title": book_title,
            "overdue_days": overdue_days,
        },
    )
    # Dify 工作流通常返回 text 字段
    return result.get("text", str(result))


async def get_reading_recommendations(
    username: str, categories: list[str],
) -> str:
    """根据用户借阅分类偏好推荐小说"""
    result = await call_dify_workflow(
        workflow_id=settings.DIFY_RECOMMEND_WORKFLOW_ID,
        inputs={
            "username": username,
            "categories": ", ".join(categories) if categories else "不限",
        },
    )
    return result.get("text", str(result))
```

- [ ] **Step 2: 实现 routers/ai.py**

```python
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from dependencies import get_current_user, require_role
from models import User, UserRole, BorrowRecord, BorrowStatus
from schemas import ResponseModel
from services.dify_client import generate_overdue_reminder, get_reading_recommendations

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/reminder", response_model=ResponseModel[str])
async def create_reminder(
    borrow_id: int,
    _: Annotated[User, Depends(require_role(UserRole.admin))],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BorrowRecord)
        .options(selectinload(BorrowRecord.user), selectinload(BorrowRecord.book))
        .where(BorrowRecord.borrow_id == borrow_id)
    )
    borrow = result.scalar_one_or_none()
    if not borrow:
        raise HTTPException(status_code=404, detail="借阅记录不存在")

    today = date.today()
    overdue_days = max((today - borrow.due_date).days, 0)

    try:
        text = await generate_overdue_reminder(
            username=borrow.user.username,
            book_title=borrow.book.title,
            overdue_days=overdue_days,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Dify API 调用失败: {e}")

    return ResponseModel(data=text)


@router.get("/recommendations", response_model=ResponseModel[str])
async def get_recommendations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    # 获取用户借阅过的分类
    result = await db.execute(
        select(BorrowRecord)
        .options(selectinload(BorrowRecord.book))
        .where(BorrowRecord.user_id == current_user.user_id)
        .limit(20)
    )
    records = list(result.scalars().all())
    categories = list({r.book.category for r in records if r.book.category})

    try:
        text = await get_reading_recommendations(
            username=current_user.username,
            categories=categories,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Dify API 调用失败: {e}")

    return ResponseModel(data=text)
```

- [ ] **Step 3: Commit**

```bash
git add backend/services/dify_client.py backend/routers/ai.py
git commit -m "feat: Dify AI client + reminder/recommendation endpoints"
```

---

### Task 11: 逾期扫描定时任务

**Files:**
- Modify: `backend/main.py` （首次创建）

**Interfaces:**
- Consumes: `AsyncSessionLocal` (database.py), `scan_overdue_records` (borrow_service.py)
- Produces: APScheduler BlockingScheduler，每日 08:00 触发逾期扫描

- [ ] **Step 1: 在 Task 12 的 main.py 中注册定时任务**

定时任务注册和 FastAPI 入口整合在一起。此任务只负责 scheduler 的启动逻辑，完整的 main.py 在 Task 12 完成。具体来说：

```python
# 在 main.py 的 lifespan 中添加
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()


async def scheduled_overdue_scan():
    async with AsyncSessionLocal() as session:
        from services.borrow_service import scan_overdue_records
        records = await scan_overdue_records(session)
        print(f"[定时任务] 逾期扫描完成，共 {len(records)} 条逾期记录")


scheduler.add_job(scheduled_overdue_scan, "cron", hour=8, minute=0)
```

这部分代码会在 Task 12 中完整落地。本 Task 只描述逻辑，不单独 commit。

- [ ] **Step 2: 跳过本 Task 的 commit（跟随 Task 12 一起）**

---

### Task 12: 主应用入口 + 路由整合

**Files:**
- Create: `backend/main.py`

**Interfaces:**
- Consumes: 所有 routers; `settings` (config.py); `engine`, `Base`, `AsyncSessionLocal` (database.py); `scheduled_overdue_scan` 定时任务 (Task 11); Jinja2 templates (Task 13)
- Produces: `app: FastAPI` 实例；挂载静态文件 + 模板目录；注册所有路由；配置全局异常处理；scheduler 生命周期管理

- [ ] **Step 1: 实现 main.py**

```python
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import settings
from database import engine, Base, AsyncSessionLocal
from routers import auth, user, book, borrow, return_r, ai as ai_router

# 避免 return 关键字冲突
return_r = return_r  # noqa


# ========== 定时任务 ==========

async def scheduled_overdue_scan():
    async with AsyncSessionLocal() as session:
        from services.borrow_service import scan_overdue_records
        records = await scan_overdue_records(session)
        print(f"[定时任务] 逾期扫描完成，共 {len(records)} 条逾期记录")


scheduler = AsyncIOScheduler()
scheduler.add_job(scheduled_overdue_scan, "cron", hour=8, minute=0)


# ========== 生命周期 ==========

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时建表（生产用 Alembic 迁移替代）
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    scheduler.start()
    print("🚀 Novel Rental Management System 已启动")
    yield
    scheduler.shutdown()
    await engine.dispose()


app = FastAPI(title="小说租赁管理系统", version="1.0.0", lifespan=lifespan)


# ========== 全局异常处理 ==========

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"code": 422, "message": "参数校验失败", "data": exc.errors()},
    )


# ========== 路由 ==========

app.include_router(auth.router)
app.include_router(user.router)
app.include_router(book.router)
app.include_router(borrow.router)
app.include_router(return_r.router, prefix="")  # return_r 已带前缀
app.include_router(ai_router.router)


# ========== 前端 ==========

BASE_DIR = Path(__file__).parent
TEMPLATES_DIR = BASE_DIR.parent / "templates"
STATIC_DIR = BASE_DIR.parent / "static"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("auth/login.html", {"request": request})


@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse("auth/register.html", {"request": request})


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.get("/books", response_class=HTMLResponse)
async def books_page(request: Request):
    return templates.TemplateResponse("books/list.html", {"request": request})


@app.get("/books/new", response_class=HTMLResponse)
async def book_new_page(request: Request):
    return templates.TemplateResponse("books/form.html", {"request": request, "mode": "new"})


@app.get("/borrow/new", response_class=HTMLResponse)
async def borrow_new_page(request: Request):
    return templates.TemplateResponse("borrow/new.html", {"request": request})


@app.get("/borrows", response_class=HTMLResponse)
async def borrows_page(request: Request):
    return templates.TemplateResponse("borrow/list.html", {"request": request})


@app.get("/borrows/overdue", response_class=HTMLResponse)
async def overdue_page(request: Request):
    return templates.TemplateResponse("borrow/overdue.html", {"request": request})


@app.get("/return/new", response_class=HTMLResponse)
async def return_page(request: Request):
    return templates.TemplateResponse("return/new.html", {"request": request})


@app.get("/users", response_class=HTMLResponse)
async def users_page(request: Request):
    return templates.TemplateResponse("users/list.html", {"request": request})


@app.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request):
    return templates.TemplateResponse("profile.html", {"request": request})
```

注意：routers/return.py 中的 router 前缀是 `/api/returns`，所以在 main.py 导入时用别名避免 `return` 关键字冲突：
```python
from routers import return as return_r  # 不对，python 不允许
from routers import return as return_module  # 也不对
```

实际上，文件命名不能是 `return.py`，需要改名为 `returns.py`。更新之前的 Task：

**修正：** 将 `backend/routers/return.py` 改名为 `backend/routers/returns.py`，import 语句 `from routers.returns import router as returns_router`。

这个修正应该在 Task 9 执行时处理。

- [ ] **Step 2: Commit**

```bash
git add backend/main.py
git commit -m "feat: FastAPI app entry with all routers, scheduler, static/templates mount"
```

---

### Task 13: 前端模板 + 静态资源

**Files:**
- Create: `templates/base.html`
- Create: `templates/dashboard.html`
- Create: `templates/profile.html`
- Create: `templates/auth/login.html`
- Create: `templates/auth/register.html`
- Create: `templates/users/list.html`
- Create: `templates/users/detail.html`
- Create: `templates/books/list.html`
- Create: `templates/books/form.html`
- Create: `templates/borrow/new.html`
- Create: `templates/borrow/list.html`
- Create: `templates/borrow/overdue.html`
- Create: `templates/return/new.html`
- Create: `static/css/style.css`
- Create: `static/js/app.js`

**Interfaces:**
- Consumes: FastAPI main.py 的 StaticFiles + Jinja2Templates 挂载
- Produces: 完整的 13 个页面 + 公共布局 + 响应式样式 + AJAX 表单提交脚本

（模板代码较长，每步聚焦一个文件。以下是每个文件的最小可运行骨架。）

- [ ] **Step 1: 创建 base.html 公共布局**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}小说租赁管理系统{% endblock %}</title>
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
    <div class="layout">
        {% if request.state.user %}
        <aside class="sidebar">
            <div class="logo">📚 小说租赁</div>
            <nav>
                <a href="/" class="nav-link">📊 仪表盘</a>
                <a href="/books" class="nav-link">📖 图书管理</a>
                <a href="/borrows" class="nav-link">📋 借阅记录</a>
                <a href="/borrows/overdue" class="nav-link">⚠️ 逾期管理</a>
                <a href="/borrow/new" class="nav-link">➕ 办理借阅</a>
                <a href="/return/new" class="nav-link">↩️ 办理归还</a>
                {% if request.state.user.role == 'admin' %}
                <a href="/users" class="nav-link">👥 用户管理</a>
                {% endif %}
                <a href="/profile" class="nav-link">👤 个人中心</a>
            </nav>
        </aside>
        {% endif %}

        <main class="main-content">
            <div id="toast"></div>
            {% block content %}{% endblock %}
        </main>
    </div>

    <script src="/static/js/app.js"></script>
    {% block scripts %}{% endblock %}
</body>
</html>
```

- [ ] **Step 2: 创建静态 CSS**

```css
/* 完整 CSS 见计划文件，实际实现时确保：左侧导航 + 主内容区布局、表格/表单/卡片样式、Toast 消息、响应式最小 1024px */
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; background: #f5f6fa; }
.layout { display: flex; min-height: 100vh; }
.sidebar { width: 220px; background: #2c3e50; color: #fff; padding: 20px 0; flex-shrink: 0; }
.sidebar .logo { font-size: 18px; font-weight: bold; padding: 0 20px 20px; border-bottom: 1px solid #34495e; margin-bottom: 16px; }
.sidebar nav a { display: block; padding: 10px 20px; color: #ecf0f1; text-decoration: none; }
.sidebar nav a:hover { background: #34495e; }
.main-content { flex: 1; padding: 24px; overflow-x: auto; }
.card { background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 16px; }
.card h2 { margin-bottom: 12px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #ecf0f1; }
th { background: #f8f9fa; font-weight: 600; }
.btn { display: inline-block; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; font-size: 14px; }
.btn-primary { background: #3498db; color: #fff; }
.btn-primary:hover { background: #2980b9; }
.btn-danger { background: #e74c3c; color: #fff; }
.btn-secondary { background: #95a5a6; color: #fff; }
form .form-group { margin-bottom: 12px; }
form label { display: block; margin-bottom: 4px; font-weight: 500; }
form input, form select, form textarea { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
.stat-card { background: #fff; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.stat-card .number { font-size: 28px; font-weight: bold; color: #3498db; }
.stat-card .label { color: #7f8c8d; margin-top: 4px; font-size: 13px; }
#toast { position: fixed; top: 20px; right: 20px; z-index: 9999; }
.toast-msg { padding: 10px 20px; border-radius: 4px; margin-bottom: 8px; color: #fff; }
.toast-msg.success { background: #27ae60; }
.toast-msg.error { background: #e74c3c; }
.toast-msg.info { background: #3498db; }
.status-tag { padding: 2px 8px; border-radius: 3px; font-size: 12px; }
.status-tag.borrowed { background: #f39c12; color: #fff; }
.status-tag.available { background: #27ae60; color: #fff; }
.status-tag.overdue { background: #e74c3c; color: #fff; }
.status-tag.repairing { background: #9b59b6; color: #fff; }
```

- [ ] **Step 3: 创建 JS 工具**

```javascript
// static/js/app.js

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const msg = document.createElement('div');
    msg.className = `toast-msg ${type}`;
    msg.textContent = message;
    toast.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
}

async function apiFetch(url, options = {}) {
    const opts = {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...options,
    };
    if (options.body && typeof options.body === 'object') {
        opts.body = JSON.stringify(options.body);
    }
    const resp = await fetch(url, opts);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || (data.code !== undefined && data.code !== 0)) {
        showToast(data.message || `请求失败 (${resp.status})`, 'error');
        throw new Error(data.message);
    }
    return data.data ?? data;
}

document.addEventListener('DOMContentLoaded', () => {
    // 全局表单提交拦截：fetch + toast
    document.querySelectorAll('form[data-ajax]').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const url = form.action;
            const method = form.method.toUpperCase();
            const body = Object.fromEntries(new FormData(form).entries());
            try {
                await apiFetch(url, { method, body });
                showToast('操作成功', 'success');
                if (form.dataset.redirect) {
                    setTimeout(() => location.href = form.dataset.redirect, 800);
                } else {
                    location.reload();
                }
            } catch (_) { /* toast 已显示 */ }
        });
    });
});
```

- [ ] **Step 4: 创建剩余模板文件（dashboard, login, register, books/list, books/form, borrow/new, borrow/list, borrow/overdue, return/new, users/list, profile, users/detail）**

每个模板 extend `base.html` 并实现对应页面的 HTML 骨架。具体内容可根据 PRD 第 7 节页面清单逐一实现。

- [ ] **Step 5: Commit**

```bash
git add templates/ static/
git commit -m "feat: all Jinja2 templates + CSS + JS for 13 pages"
```

---

### Task 14: 启动脚本 + 初始化管理员 + README

**Files:**
- Create: `backend/run.py`
- Create: `scripts/init_admin.py`
- Create: `backend/.gitignore`

**Interfaces:**
- Produces: 一键启动入口、超级管理员初始化脚本

- [ ] **Step 1: 创建 run.py**

```python
import uvicorn
from config import settings

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
```

- [ ] **Step 2: 创建 scripts/init_admin.py**

```python
"""初始化超级管理员账号。用法: python scripts/init_admin.py <username> <password>"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from database import AsyncSessionLocal, Base, engine
from models import User, UserRole, UserStatus
from dependencies import hash_password
from sqlalchemy import select


async def init(username: str, password: str):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == username))
        if result.scalar_one_or_none():
            print(f"⚠️ 用户 {username} 已存在，跳过")
            return

        admin = User(
            username=username,
            password_hash=hash_password(password),
            role=UserRole.admin,
            status=UserStatus.active,
        )
        db.add(admin)
        await db.commit()
        print(f"✅ 超级管理员 {username} 创建成功")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法: python scripts/init_admin.py <username> <password>")
        sys.exit(1)
    asyncio.run(init(sys.argv[1], sys.argv[2]))
```

- [ ] **Step 3: 创建 .gitignore**

```
# Python
__pycache__/
*.pyc
*.pyo
*.egg-info/
.eggs/
dist/
build/
.venv/
venv/
env/

# 环境变量
.env

# IDE
.idea/
.vscode/

# 系统文件
.DS_Store
Thumbs.db

# 测试
.pytest_cache/
```

- [ ] **Step 4: 启动验证**

```bash
cd backend
python scripts/init_admin.py admin admin123
python run.py
# 访问 http://localhost:8000/docs 查看 API 文档
# 访问 http://localhost:8000/login 登录
```
Expected: uvicorn 启动成功；`/docs` 可访问；`/login` 可访问

- [ ] **Step 5: Commit**

```bash
git add backend/run.py scripts/init_admin.py backend/.gitignore
git commit -m "chore: add run.py entry, init_admin script, gitignore"
```

---

## 全局依赖关系图

```
Task 1: 脚手架/config/database
  └─ Task 2: models (依赖 database.Base)
     └─ Task 3: schemas + dependencies (依赖 models + config)
        ├─ Task 4: auth (依赖 models + dependencies + database)
        ├─ Task 5: user (依赖 Task 3)
        ├─ Task 6: book (依赖 Task 3)
        └─ Task 7: fine_service (依赖 models.DamageLevel)
           ├─ Task 8: borrow (依赖 Task 7 + Task 5 配额检查 + Task 6 book 状态)
           └─ Task 9: returns (依赖 Task 7 + Task 8 + Task 6)
              └─ Task 10: ai (依赖 config + httpx)
                 ├─ Task 11: 定时任务 (依赖 Task 8 scan_overdue)
                 └─ Task 12: main.py (整合所有 router + Task 11 + Task 13)
                    └─ Task 13: 模板 (依赖 Task 12)
                       └─ Task 14: 启动脚本 (依赖全部)
```

可并行的任务：Task 4/5/6 可同时；Task 8/9/10 可同时（依赖 Task 7）；Task 11 跟随 Task 8；Task 13 跟随 Task 12。
