# PawMart — 香港寵物用品零售平台

Next.js 全端 + PostgreSQL + Prisma 打造的寵物用品網店 MVP。

## 功能概覽

### MVP（Phase 1 — 目前）
- 商品瀏覽與分類篩選
- 購物車（訪客 session / 會員）
- 會員註冊登入
- 多寵物檔案管理
- 基礎推薦引擎（品種、生命階段、過敏原避障）
- 營養熱量估算
- 後台商品 / 批號 / 組合包檢視
- Stripe 金流介面預留（HKD）

### Phase 2 — 供應鏈
- 批號 FEFO 扣減
- 到期 Alert 通知（Email / Dashboard）
- 組合包 / 整箱自動拆包扣庫存
- 進貨與調撥

### Phase 3 — 訂閱 & CRM
- Stripe Subscription 定期補貨
- 「快吃完了」催購提醒
- 生日 / 生命階段自動行銷
- 分級寵物點數（Bronze → Platinum）

## 快速開始

```bash
# 1. 複製環境變數
cp .env.example .env

# 2. 啟動 PostgreSQL（擇一）
npx prisma dev          # Prisma 內建本地 Postgres
# 或 Docker:
# docker run -d --name pawmart-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pawmart -p 5432:5432 postgres:16

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

## 技術堆疊

| 層級 | 技術 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 語言 | TypeScript |
| 資料庫 | PostgreSQL + Prisma 7 |
| 認證 | Auth.js (NextAuth v5) |
| 金流 | Stripe（香港 HKD） |
| UI | Tailwind CSS 4 |

## 專案結構

```
src/
├── app/                  # 頁面 & API Routes
│   ├── products/         # 商品列表 & 詳情
│   ├── cart/             # 購物車
│   ├── account/pets/     # 寵物檔案
│   ├── admin/            # 後台
│   └── api/              # REST API
├── components/           # UI 元件
├── lib/
│   ├── prisma.ts         # DB client
│   ├── auth.ts           # 認證設定
│   ├── inventory.ts      # 庫存 / 批號 / 組合包邏輯
│   └── recommendations.ts # 推薦 & 營養引擎
└── generated/prisma/     # Prisma Client
prisma/
├── schema.prisma         # 資料模型
└── seed.ts               # 種子資料
```

## 資料模型重點

- **ProductVariant.unitType**: `SINGLE` | `CASE` | `BUNDLE`
- **ProductLot**: 批號 + 有效期限 + 數量
- **BundleItem**: 組合包 → 組成 SKU 對應
- **Pet.allergies**: 字串陣列，推薦引擎自動排除
- **Subscription**: Phase 3 訂閱制預留
- **PointsAccount**: Phase 3 點數系統預留

## 香港金流設定

1. 在 [Stripe Dashboard](https://dashboard.stripe.com) 建立香港帳戶
2. 取得 `STRIPE_SECRET_KEY` 與 `STRIPE_PUBLISHABLE_KEY`
3. 設定 Webhook 指向 `/api/webhooks/stripe`
4. 支援：Visa / Mastercard / Apple Pay / Google Pay

## 開發指令

```bash
npm run dev          # 開發伺服器
npm run build        # 正式建置
npm run db:migrate   # 執行 migration
npm run db:seed      # 載入種子資料
npm run db:studio    # Prisma Studio GUI
```

## Roadmap

```
Phase 1 (MVP)     ████████░░  商品、購物車、會員、寵物檔案、基礎推薦
Phase 2           ░░░░░░░░░░  批號 FEFO、組合包扣減、進貨管理
Phase 3           ░░░░░░░░░░  訂閱制、CRM 自動化、點數獎勵
Phase 4           ░░░░░░░░░░  進階營養計算、AI 推薦、行動 App
```
