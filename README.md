# PawMart — 香港寵物用品零售平台

Next.js 全端 + PostgreSQL + Prisma 打造的寵物用品網店。

## 功能概覽

### 前台 — 個人化購物
- 商品瀏覽、分類 / 品種 / 生命階段 / 過敏原智慧篩選
- 購物車（訪客 session / 會員；可改數量與移除）與示範結帳（HKD）
- 會員註冊登入、會員中心、送貨地址（香港 18 區）
- 多寵物檔案（含生日、體重、過敏原；可編輯／刪除）
- 推薦引擎：品種、生命階段、過敏原避障
- 營養熱量估算（RER）
- 訂閱制定期補貨（14 / 30 / 60 天）

### 後台 — 供應鏈與營運
- 商品／規格 CRUD
- 進貨入庫（批號 Lot Number + 有效期限）；整箱入庫自動拆入單件批號
- 盤點（調整批號數量）與批號調撥
- 結帳 FEFO 扣減（先到期先出），訂單可見批號
- 到期 Alert（30 天內）與管理員預警電郵
- 組合包 / 整箱自動拆包扣庫存（單罐、一箱 12 罐、混搭組合包）
- 訂單出貨狀態：已付款 → 處理中／已出貨 → 已送達

### 會員 CRM
- 「快吃完了」催購（依訂閱到期或上次主糧消耗）
- 生日與生命階段行銷活動（Resend 電郵；未設定金鑰則模擬發送）
- 分級寵物點數：青銅 → 白銀 → 黃金 → 白金（每消費 HK$1 = 1 點）
- `/api/cron/crm` 可排程產生活動、發送待發電郵、到期預警，並處理到期訂閱

## 快速開始

```bash
# 1. 複製環境變數（npm run db:migrate 也會在缺少 .env 時自動複製）
cp .env.example .env

# 2. 用 Docker 啟動 PostgreSQL
npm run db:up

# 3. 資料庫遷移 & 種子資料
npm run db:migrate
npm run db:seed

# 4. 開發伺服器
npm run dev
```

開啟 http://localhost:3000

### 測試帳戶（seed 後）
| 角色 | 電郵 | 密碼 |
|------|------|------|
| 管理員 | admin@pawmart.hk | admin123 |
| 會員 | demo@pawmart.hk | demo1234 |

Demo 會員已有寵物 Mochi / Bagel、即將到期訂閱，以及一筆可觸發「快吃完了」的歷史訂單。

## 技術堆疊

| 層級 | 技術 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 語言 | TypeScript |
| 資料庫 | PostgreSQL + Prisma 7 |
| 認證 | Auth.js (NextAuth v5) |
| 金流 | Stripe（香港 HKD，選用）；未設定時使用示範結帳 |
| UI | Tailwind CSS 4 |

## 專案結構

```
src/
├── app/                  # 頁面 & API Routes
│   ├── products/         # 商品列表 & 詳情
│   ├── cart/             # 購物車 / 結帳
│   ├── account/          # 寵物、訂單、地址、訂閱、點數
│   ├── admin/            # 後台（商品 CRUD、庫存入庫／盤點、CRM）
│   └── api/              # REST API（含 /api/cron/crm）
├── components/           # UI 元件
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── inventory.ts      # FEFO / 批號 / 組合包
│   ├── checkout.ts       # 下單、訂閱履約、點數
│   ├── campaigns.ts      # CRM 催購與行銷活動
│   └── recommendations.ts
└── generated/prisma/     # Prisma Client
```

## 香港金流設定

1. 在 [Stripe Dashboard](https://dashboard.stripe.com) 建立香港帳戶
2. 取得 `STRIPE_SECRET_KEY` 與 `STRIPE_PUBLISHABLE_KEY`
3. 設定 Webhook 指向 `/api/webhooks/stripe`
4. 支援：Visa / Mastercard / Apple Pay / Google Pay

未設定 Stripe 時，會員結帳會直接建立已付款訂單，並扣減批號庫存。結帳會帶入會員預設送貨地址。

## 電郵設定（選用）

設定 `RESEND_API_KEY`、`EMAIL_FROM`、`ADMIN_ALERT_EMAIL` 後，CRM 活動與到期預警會經 Resend 寄出。未設定金鑰時，系統會在伺服器 log 模擬發送，並仍將活動標記為已發送。

## 開發指令

```bash
npm run dev          # 開發伺服器
npm run build        # 正式建置
npm run test         # 單元測試（FEFO / 點數 / CRM / 電郵 HTML）
npm run db:up            # Docker Compose 啟動 Postgres
npm run db:down          # 停止資料庫容器
npm run db:migrate       # 套用既有 migration（deploy）
npm run db:migrate:dev   # 開發時建立新 migration
npm run db:seed          # 載入種子資料
npm run db:studio        # Prisma Studio GUI
```

排程 CRM（可選）：

```bash
curl -X POST http://localhost:3000/api/cron/crm \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Roadmap

```
Phase 1 (MVP)     ██████████  商品、購物車、會員、寵物檔案、基礎推薦
Phase 2           ██████████  批號 FEFO、整箱入庫拆件、盤點調撥、到期電郵
Phase 3           ████████░░  訂閱制、CRM 自動化、點數獎勵
Phase 4           ░░░░░░░░░░  Stripe Checkout / Subscription
Phase 5           ██████████  商品 CRUD、出貨、地址、購物車數量、電郵
```
