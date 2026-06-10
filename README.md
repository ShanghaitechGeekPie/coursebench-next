# CourseBench

上海科技大学课程评教平台。前后端统一部署在 Vercel 上，使用 Next.js App Router + Drizzle ORM。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Next.js 16, React 19, MUI v7, SWR, Tailwind CSS |
| 后端 | Next.js Route Handlers (`src/app/v1/`) |
| 数据库 | Neon Postgres (Serverless) + Drizzle ORM |
| 缓存/会话 | Upstash Redis (via Vercel Marketplace) |
| 文件存储 | Vercel Blob (头像) |
| 人机验证 | Cloudflare Turnstile |
| 邮件 | Nodemailer (SMTP) |
| 认证 | iron-session + bcryptjs + Casdoor OAuth |
| 部署 | Vercel |

## 快速开始

### 前置条件

- Node.js 20+
- pnpm
- Vercel CLI (`npm i -g vercel`)
- 已在 Vercel 上创建项目并关联 Neon + Upstash Redis

### 本地开发

```bash
# 1. 安装依赖
pnpm install

# 2. 关联 Vercel 项目并拉取环境变量
vercel link
vercel env pull

# 3. 补充本地开发环境变量 (追加到 .env.local)
echo 'SESSION_SECRET="your-dev-secret-at-least-32-characters-long"' >> .env.local
echo 'NEXT_PUBLIC_TURNSTILE_SITE_KEY="1x00000000000000000000AA"' >> .env.local   # Cloudflare 测试密钥
echo 'TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"' >> .env.local  # Cloudflare 测试密钥
echo 'DISABLE_MAIL=true' >> .env.local   # 本地跳过邮件发送

# 4. 启动开发服务器
pnpm dev
```

访问 http://localhost:3000

---

## 环境变量

### 必需 (Required)

这些变量必须设置，否则核心功能无法工作。

| 变量 | 说明 | 来源 |
|------|------|------|
| `DATABASE_URL` | Neon Postgres 连接串 (含连接池) | Vercel Marketplace 自动注入 |
| `KV_REST_API_URL` | Upstash Redis REST URL | Vercel Marketplace 自动注入 |
| `KV_REST_API_TOKEN` | Upstash Redis REST Token | Vercel Marketplace 自动注入 |
| `SESSION_SECRET` | iron-session 加密密钥，**至少 32 字符** | 手动设置 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile Site Key (前端公开) | [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile Secret Key (服务端) | [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile) |

### 邮件 (注册/密码重置需要)

不配置时设置 `DISABLE_MAIL=true` 可跳过邮件发送。

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SMTP_HOST` | SMTP 服务器地址 | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP 端口 | `465` |
| `SMTP_USERNAME` | SMTP 用户名 | - |
| `SMTP_PASSWORD` | SMTP 密码 | - |
| `SMTP_FROM` | 发件人邮箱地址 | - |
| `SMTP_FROM_NAME` | 发件人显示名称 | `CourseBench` |

### Casdoor SSO (GeekPie 登录需要)

不配置时 Casdoor 登录按钮会返回错误，但不影响邮箱密码登录。

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CASDOOR_ENDPOINT` | Casdoor 服务地址 | - |
| `CASDOOR_CLIENT_ID` | OAuth Client ID | - |
| `CASDOOR_CLIENT_SECRET` | OAuth Client Secret | - |
| `CASDOOR_REDIRECT_URI` | OAuth 回调 URL | 自动拼接 `{SERVER_URL}/v1/user/casdoor/callback` |
| `CASDOOR_FRONTEND_URL` | OAuth 完成后的前端跳转地址 | - |

### 可选 (Optional)

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NEXT_PUBLIC_SERVER_URL` | 服务 URL (用于邮件中的链接) | `http://localhost:3000` |
| `MAIL_SUFFIX` | 允许注册的邮箱后缀 | `@shanghaitech.edu.cn` |
| `SERVICE_NAME` | 服务名称 (中文, 邮件模板) | `GeekPie_ CourseBench 评教平台` |
| `SERVICE_NAME_EN` | 服务名称 (英文, 邮件模板) | `GeekPie_ CourseBench` |
| `AVATAR_SIZE_LIMIT` | 头像文件大小上限 (字节) | `1048576` (1MB) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 读写 Token | Vercel 自动注入 |
| `MINIO_ENDPOINT` | 旧 MinIO CDN 域名 (兼容旧头像 URL) | - |
| `MINIO_BUCKET` | 旧 MinIO Bucket 名称 | - |

### 开发调试

| 变量 | 说明 |
|------|------|
| `DISABLE_MAIL=true` | 跳过邮件发送，注册激活/密码重置直接通过 |
| `DISABLE_CAPTCHA=true` | 跳过 Turnstile 验证 |

### Turnstile 测试密钥

本地开发时可使用 [Cloudflare 提供的测试密钥](https://developers.cloudflare.com/turnstile/troubleshooting/testing/):

| 密钥 | 值 |
|------|-----|
| Site Key (始终通过) | `1x00000000000000000000AA` |
| Secret Key (始终通过) | `1x0000000000000000000000000000000AA` |
| Site Key (始终阻止) | `2x00000000000000000000AB` |
| Secret Key (始终失败) | `2x0000000000000000000000000000000AA` |

---

## 部署

### 首次部署

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录并关联项目
vercel login
vercel link

# 3. 通过 Vercel Marketplace 安装 Neon 和 Upstash Redis
#    (在 Vercel Dashboard 中操作, 环境变量会自动注入)

# 4. 添加必要的环境变量
vercel env add SESSION_SECRET              # 输入至少 32 字符的随机字符串
vercel env add NEXT_PUBLIC_TURNSTILE_SITE_KEY   # Cloudflare Turnstile Site Key
vercel env add TURNSTILE_SECRET_KEY        # Cloudflare Turnstile Secret Key

# 5. (如需邮件功能) 添加 SMTP 变量
vercel env add SMTP_HOST
vercel env add SMTP_PORT
vercel env add SMTP_USERNAME
vercel env add SMTP_PASSWORD
vercel env add SMTP_FROM

# 6. (如需 Casdoor SSO) 添加 Casdoor 变量
vercel env add CASDOOR_ENDPOINT
vercel env add CASDOOR_CLIENT_ID
vercel env add CASDOOR_CLIENT_SECRET
vercel env add CASDOOR_REDIRECT_URI
vercel env add CASDOOR_FRONTEND_URL

# 7. 部署
vercel deploy          # Preview
vercel --prod          # Production
```

### 日常部署

推送到 Git 仓库的 `main` 分支即可自动部署到 Production。

```bash
git push origin main
```

---

## 数据库迁移

### 从旧 Docker PostgreSQL 迁移到 Neon

```bash
# 1. 从旧数据库导出 (在旧服务器上执行)
pg_dump -h 127.0.0.1 -U coursebench -d coursebench \
  --no-owner --no-privileges --no-acl \
  -F plain -f coursebench_dump.sql

# 2. 导入到 Neon
#    从 Vercel Dashboard 或 .env.local 获取 DATABASE_URL_UNPOOLED (非连接池 URL)
psql "postgresql://neondb_owner:xxx@ep-xxx.neon.tech/neondb?sslmode=require" \
  < coursebench_dump.sql

# 3. 验证数据
node scripts/test-db.mjs
node scripts/test-drizzle.mjs
```

注意事项:
- 使用 `--no-owner --no-privileges --no-acl` 避免导入旧数据库的角色和权限
- 导入使用 **unpooled** 连接 (`DATABASE_URL_UNPOOLED`)，因为 `pg_dump` 需要直连
- Neon 是标准 PostgreSQL 16，`pg_dump` 产出可直接导入

### 头像迁移 (MinIO -> Vercel Blob)

如暂不迁移，设置 `MINIO_ENDPOINT` 和 `MINIO_BUCKET` 环境变量，旧头像 URL 会自动兼容拼接。

如需迁移:

```bash
# 一次性迁移脚本 (需自行编写, 逻辑如下):
# 1. 查询所有 users 表中 avatar 非空的记录
# 2. 对每个旧 UUID: 下载 https://{MINIO_ENDPOINT}/{MINIO_BUCKET}/avatar/{uuid}
# 3. 上传到 Vercel Blob
# 4. 更新 users.avatar 为新 Blob URL
```

### Drizzle 迁移管理

现有数据库由 GORM AutoMigrate 创建，Drizzle schema 仅用于查询，不做 schema 迁移。
如果将来需要修改表结构:

```bash
# 生成迁移文件
pnpm drizzle-kit generate

# 执行迁移
pnpm drizzle-kit migrate

# 查看当前 schema 与数据库的差异
pnpm drizzle-kit push --dry-run
```

---

## CLI 管理工具

内置命令行工具，用于数据导入和管理员操作。自动从 `.env.local` 读取 `DATABASE_URL`。

```bash
# 通过 pnpm 运行
pnpm cli <command> [args...]

# 或直接运行
node cli/index.mjs <command> [args...]
```

### 命令一览

| 命令 | 说明 |
|------|------|
| `stats` | 显示数据库统计（用户数、课程数、评论数等） |
| `set_admin <user_id>` | 设置用户为管理员 |
| `unset_admin <user_id>` | 取消管理员 |
| `set_community_admin <user_id>` | 设置用户为社区管理员 |
| `unset_community_admin <user_id>` | 取消社区管理员 |
| `import_elrc <semester> [--dry-run] [--update-existing]` | 从 ELRC API 导入课程；可更新已有课程基础信息 |
| `import_teacher <csv_path>` | 从 CSV 更新教师信息 |
| `import_course <csv_dir>` | 从 CSV 目录导入课程 |
| `update_teacher_institute [--dry-run]` | 从 ELRC 搜索 API 更新教师所属学院 |
| `import_teacher_uniid <json_path>` | 从 JSON 更新教师工号 |
| `rm_duplicate_group` | 合并重复授课组 |
| `remove_student_teacher [--dry-run]` | 将十位 20xxxxxxxx 工号教师合并为课程助教，并软删除对应教师页 |
| `test_mail <to> [options]` | 发送测试邮件（验证 SMTP 配置） |
| `clear_userdata Yes_Confirm` | 删除所有用户数据（危险！） |

### ELRC 课程导入

每学期从上海科技大学 ELRC 系统同步课程、教师和授课组。

```bash
# Dry run：仅预览，不写入数据库
pnpm cli import_elrc 2024-2025-2 --dry-run

# 实际导入
pnpm cli import_elrc 2024-2025-2

# 同步已有课程的名称、学分、开课单位
pnpm cli import_elrc 2024-2025-2 --update-existing
```

学期参数格式为 `<起始年>-<结束年>-<学期号>`，学期号：1=秋季，2=春季，3=夏季。

Dry run 模式会：
1. 从 ELRC API 拉取所有课程数据
2. 查询 API 获取学分和开课单位等详情
3. 与数据库对比，输出预览报告：
   - 按学院分组的新课程列表（课程号、名称、学分、教师）
   - 新教师列表
   - 已存在课程统计
   - 需要同步授课组的课程数
   - 使用 `--update-existing` 时，额外预览已有课程的名称、学分、开课单位变更

### 教师数据导入

```bash
# 从 CSV 更新教师资料（照片、职称、邮箱等）
# CSV 格式: name, photo, job, email, institute, introduction
pnpm cli import_teacher teachers.csv

# 从 JSON 更新教师工号
# JSON 格式: { "课程号": { "工号": "教师姓名" } }
pnpm cli import_teacher_uniid teachers.json
```

### 更新教师所属学院

通过 ELRC 搜索 API 按姓名查询教师，根据返回的 `userCode` (工号) 匹配数据库中的教师，用 `college` 字段更新 `institute`。

```bash
# Dry run：仅预览变更，不写入
pnpm cli update_teacher_institute --dry-run

# 实际执行
pnpm cli update_teacher_institute
```

匹配逻辑：
- 优先按 `userCode == uni_id` 精确匹配
- 如果搜索结果只有一条，直接使用
- 多条结果且无法按工号匹配时标记为 "Ambiguous"，需人工核实
- 同时补充缺失的 `uni_id`

### 课程 CSV 导入

```bash
# 从目录中的 CSV 文件批量导入课程
# CSV 列: [2]name, [3]code, [4]credit, [10]institute, [12]teacher_names(JSON), [13]teacher_eams_ids(JSON)
pnpm cli import_course ./course_data/
```

### 管理员设置

```bash
# 查看数据库统计，确认用户 ID
pnpm cli stats

# 设置管理员（管理员和社区管理员互斥）
pnpm cli set_admin 123
pnpm cli set_community_admin 456
```

### 邮件测试

验证 SMTP 配置是否正确，支持发送到任意地址，输出完整 SMTP 会话日志。

```bash
# 发送默认测试邮件（包含 SMTP 配置摘要）
pnpm cli test_mail user@example.com

# 使用注册邮件模板
pnpm cli test_mail user@example.com --template register

# 使用密码重置邮件模板
pnpm cli test_mail user@example.com --template reset

# 自定义主题
pnpm cli test_mail user@example.com --subject "自定义主题"

# 自定义 HTML 内容
pnpm cli test_mail user@example.com --raw "<h1>Hello</h1>"
```

输出内容：
- SMTP 配置详情（密码脱敏）
- SMTP 连接验证结果及耗时
- 完整的 SMTP 会话 debug 日志
- 发送结果：Message-ID、服务器响应、accepted/rejected 地址

### 数据维护

```bash
# 合并重复授课组（教师集合完全相同的组）
pnpm cli rm_duplicate_group

# 删除所有用户数据（不可逆！需输入确认码）
pnpm cli clear_userdata Yes_Confirm
```

---

## 项目结构

```
frontend-next/
├── cli/                               # 命令行管理工具
│   ├── index.mjs                     # CLI 入口
│   ├── db.mjs                        # 数据库连接
│   └── commands/                     # 各命令实现
│       ├── admin.mjs                 # 管理员设置
│       ├── import-elrc.mjs           # ELRC API 导入
│       ├── import-teacher.mjs        # 教师 CSV 导入
│       ├── import-course.mjs         # 课程 CSV 导入
│       ├── import-teacher-uniid.mjs  # 教师工号导入
│       ├── update-teacher-institute.mjs # ELRC 教师学院更新
│       ├── rm-duplicate-group.mjs    # 合并重复组
│       ├── clear-userdata.mjs        # 清除用户数据
│       ├── stats.mjs                 # 数据库统计
│       └── test-mail.mjs            # 测试邮件发送
├── src/
│   ├── app/
│   │   ├── v1/                        # API Route Handlers (后端)
│   │   │   ├── user/                  # 用户认证、资料、头像
│   │   │   ├── course/                # 课程列表、详情
│   │   │   ├── comment/               # 评论 CRUD、点赞、回复
│   │   │   ├── teacher/               # 教师列表、详情
│   │   │   ├── reply/                 # 回复链、点赞
│   │   │   └── reward/                # 排行榜、奖励
│   │   ├── course/[id]/               # 课程页面
│   │   ├── teacher/[id]/              # 教师页面
│   │   ├── user/[id]/                 # 用户页面
│   │   └── ...                        # 其他前端页面
│   ├── server/                        # 服务端共享代码
│   │   ├── db/
│   │   │   ├── schema.ts             # Drizzle 表定义
│   │   │   ├── index.ts              # 数据库连接
│   │   │   ├── queries.ts            # 共享查询逻辑
│   │   │   └── soft-delete.ts        # 软删除辅助
│   │   ├── auth/
│   │   │   ├── session.ts            # iron-session 会话管理
│   │   │   ├── password.ts           # bcryptjs 密码哈希
│   │   │   └── casdoor.ts            # Casdoor OAuth 流程
│   │   ├── captcha/index.ts           # Cloudflare Turnstile 验证
│   │   ├── mail/
│   │   │   ├── send.ts               # Nodemailer SMTP
│   │   │   └── verify.ts             # 邮件验证码 (Upstash Redis)
│   │   ├── storage/blob.ts           # Vercel Blob 头像上传
│   │   ├── errors.ts                 # 错误码定义
│   │   ├── response.ts               # 统一 JSON 响应
│   │   └── validation.ts             # 输入校验
│   ├── components/                    # React 组件
│   ├── contexts/                      # React Context
│   ├── hooks/                         # SWR 数据获取 hooks
│   ├── lib/                           # Axios、SWR 配置
│   └── types/                         # TypeScript 类型定义
├── scripts/                           # 测试/迁移脚本
├── drizzle/                           # Drizzle 迁移文件
├── drizzle.config.ts                  # Drizzle Kit 配置
├── next.config.ts
├── package.json
└── .env.local                         # 本地环境变量 (git ignored)
```

---

## API 端点

所有 API 在 `/v1/` 路径下，与旧 Go 后端完全兼容。

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/v1/user/register` | 注册 | Turnstile |
| POST | `/v1/user/register_active` | 激活账号 | - |
| POST | `/v1/user/login` | 登录 | Turnstile |
| POST | `/v1/user/logout` | 登出 | Session |
| GET | `/v1/user/my_id` | 当前用户 ID | - |
| GET | `/v1/user/profile/:id` | 用户资料 | - |
| POST | `/v1/user/update_profile` | 更新资料 | Session |
| POST | `/v1/user/update_password` | 修改密码 | Session + Turnstile |
| POST | `/v1/user/upload_avatar` | 上传头像 | Session |
| POST | `/v1/user/reset_password` | 发送重置邮件 | Turnstile |
| POST | `/v1/user/reset_password_active` | 完成重置 | - |
| GET | `/v1/user/casdoor/login` | Casdoor SSO 登录 | - |
| GET | `/v1/user/casdoor/bind` | 绑定 Casdoor | Session |
| GET | `/v1/user/casdoor/callback` | OAuth 回调 | - |
| POST | `/v1/user/casdoor/unbind` | 解绑 Casdoor | Session |
| GET | `/v1/course/all` | 课程列表 | - |
| GET | `/v1/course/:id` | 课程详情 | - |
| GET | `/v1/teacher/all` | 教师列表 | - |
| GET | `/v1/teacher/:id` | 教师详情 | - |
| POST | `/v1/comment/post` | 发布评论 | Session |
| POST | `/v1/comment/update` | 更新评论 | Session |
| POST | `/v1/comment/delete` | 删除评论 | Session |
| POST | `/v1/comment/like` | 点赞/取消 | Session |
| POST | `/v1/comment/fold` | 折叠评论 | Admin |
| POST | `/v1/comment/cover` | 覆盖评论 | Community Admin |
| GET | `/v1/comment/course/:id` | 课程评论 | - |
| GET | `/v1/comment/course_group/:id` | 授课组评论 | - |
| GET | `/v1/comment/user/:id` | 用户评论 | - |
| GET | `/v1/comment/recent` | 最新评论 | - |
| GET | `/v1/comment/recent/:id` | 最新评论分页 | - |
| POST | `/v1/comment/:id/reply` | 发布回复 | Session |
| GET | `/v1/comment/:id/replies` | 评论回复列表 | - |
| GET | `/v1/reply/:id/chain` | 回复链 | - |
| POST | `/v1/reply/like` | 回复点赞 | Session |
| POST | `/v1/reply/update` | 更新回复 | Session |
| POST | `/v1/reply/delete` | 删除回复 | Session |
| GET | `/v1/reward/ranklist` | 排行榜 | - |
| POST | `/v1/reward/set` | 设置奖励 | Community Admin |

## License

AGPL-3.0 - See LICENSE file.
