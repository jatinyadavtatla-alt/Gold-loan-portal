# Aurum Gold Finance — Gold Loan Portal with AI Agent

A complete, production-grade gold loan application portal featuring live gold valuation, plan comparison, an intuitive 3-step applicant flow, an admin dashboard, and an AI Loan Assistant powered by Google Gemini with tool calling and a strict human confirmation gate.

---

## 1. Stack & Architecture

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | React 19 + Next.js 16 (App Router) | Responsive 3-step application flow, live debounced quotes, admin dashboard |
| **Styling** | Vanilla CSS + Tailwind CSS v4 | Private banking aesthetic: warm off-white, deep charcoal, muted gold accents |
| **Backend** | Next.js Server Route Handlers | RESTful endpoints under `/api/v1/*` |
| **Database** | PostgreSQL + Drizzle ORM | Relational schema with basis points (bps) and integer paise (no floats) |
| **Validation** | Zod | Shared validation schemas across API routes and AI tool parameters |
| **AI Provider**| Google Gemini (`@google/genai` SDK) | Function calling with 3 tools: `get_loan_schemes`, `calculate_quote`, `submit_application` |
| **Testing** | Vitest | 75 automated unit, finance, validation, and AI agent safety tests |

---

## 2. Prerequisites

- **Node.js**: v20 or later (v22 recommended)
- **npm**: v10 or later
- **PostgreSQL**: Local instance (via Docker or Homebrew) or hosted provider (Neon, Supabase, Render, AWS RDS)
- **Google Gemini API Key**: Optional for UI/form usage; required for AI assistant features

---

## 3. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your `.env` variables:

```ini
# ── PostgreSQL Connection ──────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db

# ── AI Assistant (Google Gemini) ───────────────────────────────────────────
LLM_PROVIDER=google
GOOGLE_API_KEY=your_google_gemini_api_key_here
GEMINI_MODEL=gemini-3.7-flash

# ── Reference Gold Rate ────────────────────────────────────────────────────
# Mock 24-karat gold rate in ₹ per gram (default: 7000)
GOLD_RATE_24K_PER_GRAM=7000
```

> **Note on Gemini Models:** The provider adapter uses the official `@google/genai` SDK and defaults to `gemini-3.7-flash`. It features built-in multi-turn `thoughtSignature` handling and automatic candidate fallback (`gemini-3.7-flash` -> `gemini-3.1-flash-lite` -> `gemini-3.8-flash`) if Google's public endpoints experience temporary demand spikes (HTTP 503) or model deprecation (HTTP 404).
>
> **Security Note:** All API keys and database credentials remain strictly on the server (`process.env`). Never expose keys to client bundles or prefix them with `NEXT_PUBLIC_`.

---

## 4. PostgreSQL Setup Guide

The application expects PostgreSQL. You can run PostgreSQL locally using Docker, Homebrew, or connect to a free hosted database.

### Option A: Docker (Fastest, Beginner-Friendly)

If you have Docker Desktop installed, run:

```bash
docker run --name gold-loan-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app_db -p 5432:5432 -d postgres:16
```

Connection string:
`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db`

### Option B: Homebrew (macOS)

```bash
brew install postgresql@16
brew services start postgresql@16
createdb app_db
```

Connection string:
`DATABASE_URL=postgresql://localhost:5432/app_db`

### Option C: Free Hosted PostgreSQL (Neon / Supabase)

1. Create a free database on [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com).
2. Copy the pooled connection string provided in your dashboard.
3. Paste it as `DATABASE_URL` in your `.env` file.

---

## 5. Database Migrations & Seeding

The application is self-bootstrapping and idempotently creates tables and seeds schemes on startup. You can also run the database commands directly:

```bash
# Push schema directly to PostgreSQL using Drizzle Kit
npm run db:push

# Or generate and run migrations
npm run db:generate
npm run db:migrate

# Seed the two assignment loan schemes
npm run db:seed
```

### Seeded Loan Schemes

1. **Monthly EMI (`PLAN_EMI_01`)**:
   - Interest: 10.5% p.a. (`1050` bps)
   - Max LTV: 75% (`7500` bps)
   - Tenure: 12 months
2. **Bullet Repayment (`PLAN_BULLET_01`)**:
   - Interest: 12.0% p.a. (`1200` bps)
   - Max LTV: 70% (`7000` bps)
   - Tenure: 12 months

---

## 6. Running the Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:
- Main Gold Loan Portal: `http://localhost:3000/`
- Admin Dashboard: `http://localhost:3000/admin`
- Health check: `http://localhost:3000/api/health`

To build and run the production bundle:

```bash
npm run build
npm run start
```

---

## 7. Available API Endpoints

Base URL: `/api/v1`. All error responses return a standardized JSON format:
`{ "error": { "code": string, "message": string, "details"?: unknown } }`

| Method & Path | Description | Constraints & Details |
|---|---|---|
| `GET /api/v1/loan-schemes` | Returns active loan schemes from DB | Dynamic source of truth |
| `POST /api/v1/quotes` | Pure quote calculation | Validates weights & karat; 404 if schemeId invalid; pure computation (no DB write) |
| `POST /api/v1/leads` | Create a gold loan application | Server recalculates quote; advisory lock concurrency safe; 409 duplicate check (<7 days); supports idempotency key |
| `GET /api/v1/leads` | Admin application list | Ordered newest first; mobile numbers always masked (`98XXXXXX10`); supports `?plan=` and `?search=` filters |
| `GET /api/v1/chat` | AI availability probe | Returns `{ available: boolean, provider: string, model: string }` |
| `POST /api/v1/chat` | AI Loan Assistant conversation | Multi-turn agent loop with Google Gemini function calling; confirmation gate enforced |
| `GET /api/health` | System health check | Checks PostgreSQL database connectivity |

---

## 8. Financial Formulas & Canonical Examples

Reference rate: ₹7,000 / gram (24K gold). All financial calculations are stored in exact integer **paise** (100 paise = ₹1) and whole-rupee display is floored.

```
pureGoldGrams = netWeightGrams * (karat / 24)
goldValue     = pureGoldGrams * rate24kPerGram
eligibleLoan  = floor(goldValue * min(plan.maxLtv, 0.75))
```

### Verified Test Cases

1. **45 g net weight, 22K gold, Monthly EMI (75% LTV)**:
   - Pure gold: `41.25 g`
   - Gold value: `₹2,88,750`
   - Eligible loan: `₹2,16,562`
2. **45 g net weight, 22K gold, Bullet Repayment (70% LTV)**:
   - Eligible loan: `₹2,02,125`
3. **10 g net weight, 18K gold, Monthly EMI (75% LTV)**:
   - Pure gold: `7.5 g`
   - Gold value: `₹52,500`
   - Eligible loan: `₹39,375`

---

## 9. AI Loan Assistant — Google Gemini

The assistant is powered by Google's official `@google/genai` SDK and implements function calling:

### Integrated Tools:
1. `get_loan_schemes()`: Fetches current plans directly from backend.
2. `calculate_quote(grossWeightGrams, netWeightGrams, karat, schemeId)`: Invokes the quote engine. The model never calculates numbers on its own.
3. `submit_application(payload)`: Submits the application only after explicit user confirmation of the full loan summary.

### Safety Guards:
- **Confirmation Gate**: Deterministic server-side guard blocks `submit_application` unless the user has explicitly replied affirmatively to a complete summary.
- **Validation**: Tool arguments are validated against the same Zod schemas as the REST API.
- **Graceful Degradation**: If `GOOGLE_API_KEY` is not configured, the assistant provides setup instructions while the rest of the portal (form, quote engine, admin table) remains fully functional.

---

## 10. Automated Testing

Run the full test suite:

```bash
npm test
```

75 tests pass across 6 test suites:
- `tests/finance.test.ts` (7 tests): All 3 assignment calculation cases, 75% LTV cap, integer paise precision, flooring.
- `tests/validation.test.ts` (36 tests): Gross weight, net weight, net ≤ gross, karat (18, 22, 24), name regex, mobile regex.
- `tests/format.test.ts` (5 tests): Currency formatting, mobile masking, gram precision.
- `tests/api.quotes.test.ts` (7 tests): Schemes endpoint, quote calculation, pure calculation without DB write, invalid karat/weights, 404 on nonexistent plan.
- `tests/api.leads.test.ts` (7 tests): Application creation (201), duplicate rejection (409), unknown plan (404), validation (400), idempotency key replay, mobile masking, newest-first ordering.
- `tests/agent.test.ts` (13 tests): Unconfirmed submission blocked, confirmed submission executed, argument validation, finance numbers verified from API, duplicate handling surfaced, missing field prompt, off-topic deflection.

---

## 11. Security & Production Considerations

- **Admin Page (`/admin`)**: Currently unauthenticated for demonstration purposes. Before production deployment, place `/admin` and `GET /api/v1/leads` behind session authentication (e.g. NextAuth/Auth.js) and role-based access control.
- **Masked Data**: Mobile numbers are masked in all client responses (`98XXXXXX10`). Full mobile numbers are stored internally solely for 7-day duplicate detection.
- **Database Locks**: Concurrent duplicate applications for the same mobile number are prevented at the database level using PostgreSQL advisory transaction locks (`pg_advisory_xact_lock`).
