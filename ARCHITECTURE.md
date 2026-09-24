# Plagiarism Checker & Fix Assistant (PCFA) — Architecture Document

> **Project:** BTech 4th Year Tech Project  
> **Authors:** Satwik2217  
> **Version:** 1.0.0  
> **Last Updated:** 2026-09-24

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture Diagram](#4-architecture-diagram)
5. [Server Architecture](#5-server-architecture)
6. [Client Architecture](#6-client-architecture)
7. [Database Schema](#7-database-schema)
8. [API Endpoints](#8-api-endpoints)
9. [LLM Integration](#9-llm-integration)
10. [Deployment](#10-deployment)
11. [Environment Variables](#11-environment-variables)
12. [Key Design Decisions](#12-key-design-decisions)

---

## 1. Overview

PCFA is a full-stack web application that detects plagiarism in text documents and provides AI-powered fix suggestions. It supports multiple file formats (TXT, DOCX, PDF), compares against a local corpus and web sources, and offers paraphrasing suggestions via LLMs or a rule-based fallback.

**Core Capabilities:**
- Text input and file upload (TXT, DOCX, PDF)
- Plagiarism detection using N-gram matching, cosine similarity, and string comparison
- Local corpus management (upload, toggle, delete papers)
- Web source checking (DuckDuckGo, arXiv)
- AI-powered fix suggestions (OpenAI, Gemini, Anthropic, Ollama, or rule-based fallback)
- Citation recommendations (APA, IEEE, MLA)
- Interactive fix editor with click-to-apply
- Export to DOCX and PDF
- Check history (local SQLite)
- Local-first architecture — all data stays on the user's machine

---

## 2. Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **TypeScript** | Type-safe JavaScript |
| **Vite** | Build tool and dev server |
| **Tailwind CSS** | Styling |
| **React Router DOM** | Client-side routing |
| **Axios** | HTTP client for API calls |
| **React Dropzone** | File drag-and-drop upload |
| **Recharts** | Data visualization (charts) |
| **jsPDF** | Client-side PDF generation |
| **docx** | Client-side DOCX generation |
| **Lucide React** | Icon library |

### Backend
| Technology | Purpose |
|------------|---------|
| **Express.js** | Web server framework |
| **TypeScript** | Type-safe JavaScript |
| **sql.js** | SQLite database (WASM-based, in-memory) |
| **OpenAI SDK** | LLM integration (OpenAI) |
| **Axios** | HTTP client for Anthropic, Ollama, Gemini APIs |
| **Multer** | File upload handling |
| **pdf-parse / pdfjs-dist / unpdf** | PDF text extraction |
| **mammoth / docx** | DOCX text extraction |
| **cheerio** | HTML parsing for web search |
| **string-similarity** | String comparison algorithms |
| **natural** | NLP utilities |
| **cors** | Cross-origin resource sharing |
| **dotenv** | Environment variable management |
| **uuid** | Unique ID generation |
| **zod** | Schema validation |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **npm workspaces** | Monorepo management |
| **Render** | Cloud deployment (free tier) |
| **SQLite** | Local database (via sql.js) |
| **Git / GitHub** | Version control |

---

## 3. Project Structure

```
pliagarism-removal-checker-tool/
├── client/                          # React + TypeScript + Tailwind frontend
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   │   ├── Layout.tsx           # Main layout with navigation
│   │   │   ├── FixEditor.tsx        # Side-by-side original vs. fix editor
│   │   │   ├── ProgressBar.tsx      # Upload/analysis progress bar
│   │   │   └── SkeletonLoader.tsx   # Loading skeleton UI
│   │   ├── pages/                   # Page-level components
│   │   │   ├── HomePage.tsx         # Text input, file upload, settings
│   │   │   ├── ResultsPage.tsx      # Plagiarism results dashboard
│   │   │   ├── CorpusPage.tsx       # Local corpus management
│   │   │   ├── HistoryPage.tsx      # Past check history
│   │   │   └── SettingsPage.tsx     # App settings (LLM, thresholds)
│   │   ├── types/                   # TypeScript interfaces
│   │   │   └── index.ts
│   │   ├── utils/                   # Utility functions
│   │   │   ├── api.ts               # Axios API client (baseURL: '/api')
│   │   │   └── helpers.ts           # Helper functions
│   │   ├── styles/                  # Tailwind CSS styles
│   │   │   └── index.css
│   │   ├── App.tsx                  # React Router configuration
│   │   └── main.tsx                 # Entry point
│   ├── index.html                   # HTML template
│   ├── package.json                 # Client dependencies
│   ├── tsconfig.json                # TypeScript config
│   ├── tsconfig.node.json           # Node.js TypeScript config
│   ├── vite.config.ts               # Vite config (port 5173, API proxy)
│   ├── tailwind.config.js           # Tailwind CSS config
│   ├── postcss.config.js            # PostCSS config
│   ├── jest.config.cjs              # Test config
│   └── dist/                        # Production build output
│
├── server/                          # Express + TypeScript backend
│   ├── src/
│   │   ├── index.ts                 # Main entry point (Express app)
│   │   ├── db/
│   │   │   └── init.ts              # SQLite database initialization (sql.js)
│   │   ├── routes/                  # API route handlers
│   │   │   ├── check.routes.ts      # Plagiarism check + batch fix
│   │   │   ├── suggest.routes.ts    # Fix suggestion endpoint
│   │   │   ├── corpus.routes.ts     # Corpus CRUD operations
│   │   │   ├── corpus-import.routes.ts # arXiv/URL import
│   │   │   ├── history.routes.ts    # Check history CRUD
│   │   │   ├── export.routes.ts     # DOCX/PDF export
│   │   │   └── settings.routes.ts   # User settings CRUD
│   │   ├── controllers/             # Business logic controllers
│   │   │   ├── corpus.controller.ts
│   │   │   ├── history.controller.ts
│   │   │   └── settings.controller.ts
│   │   ├── services/                # Core business logic services
│   │   │   ├── plagiarism.service.ts # N-gram matching, cosine similarity
│   │   │   ├── llm.service.ts       # LLM integration (OpenAI, Gemini, Anthropic, Ollama)
│   │   │   ├── topic.service.ts     # Topic extraction from text
│   │   │   ├── web-search.service.ts # DuckDuckGo web search
│   │   │   ├── auto-source.service.ts # Automatic source gathering
│   │   │   └── pdf-parser.ts        # PDF text extraction utility
│   │   ├── middleware/              # Express middleware
│   │   │   └── rate-limit.ts        # Request rate limiting
│   │   ├── types/                   # Shared TypeScript types
│   │   │   └── index.ts
│   │   └── utils/                   # File parsing utilities
│   │       ├── docx-parser.ts       # DOCX text extraction
│   │       └── pdf-parser.ts        # PDF text extraction
│   ├── data/                        # SQLite database (plagiarism.db)
│   ├── dist/                        # Compiled JavaScript output
│   ├── package.json                 # Server dependencies
│   └── tsconfig.json                # TypeScript config
│
├── test/                            # Test files
│   └── files/
│       ├── sample-input.txt
│       └── sample-paper.txt
│
├── .env                             # Environment variables (gitignored)
├── .env.example                     # Environment variable template
├── .gitignore                       # Git ignore rules
├── package.json                     # Root monorepo config (npm workspaces)
├── render.yaml                      # Render deployment configuration
└── README.md                        # Project documentation
```

---

## 4. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  HomePage │  │ Results  │  │  Corpus  │  │ History  │   │
│  │          │  │  Page    │  │  Page    │  │  Page    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│  ┌────▼─────────────▼─────────────▼─────────────▼─────┐   │
│  │              React Router (App.tsx)                  │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                  │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │           Axios API Client (baseURL: '/api')         │   │
│  └──────────────────────┬──────────────────────────────┘   │
└─────────────────────────┼──────────────────────────────────┘
                          │ HTTP Requests
                          │ (same origin in production)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        SERVER (Express)                      │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Express Middleware Stack                  │  │
│  │  • CORS • JSON Parser • Rate Limiter • Static Files   │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                  │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │              Route Handlers                            │  │
│  │  /api/check-plagiarism  /api/suggest-fix              │  │
│  │  /api/corpus            /api/history                  │  │
│  │  /api/export            /api/settings                 │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                  │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │              Services Layer                            │  │
│  │  • PlagiarismService (N-gram, cosine, string match)   │  │
│  │  • LLMService (OpenAI, Gemini, Anthropic, Ollama)     │  │
│  │  • TopicService • WebSearchService • AutoSourceService │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                  │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │              Database Layer (sql.js / SQLite)          │  │
│  │  • checks table • corpus_papers table • settings table │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Server Architecture

### 5.1 Entry Point (`server/src/index.ts`)

The server entry point initializes the Express application:

1. **Middleware Setup:**
   - CORS configuration (origin from `CLIENT_URL` env var)
   - JSON body parser (10MB limit)
   - Rate limiting (60 requests per 60 seconds per IP)
   - Static file serving from `client/dist/` (production)
   - SPA catch-all route (`app.get('*')`) serving `index.html`

2. **Route Registration:**
   - `/api/check-plagiarism` → `check.routes.ts`
   - `/api/suggest-fix` → `suggest.routes.ts`
   - `/api/corpus`, `/api/upload-corpus` → `corpus.routes.ts`
   - `/api/corpus` (import) → `corpus-import.routes.ts`
   - `/api/history` → `history.routes.ts`
   - `/api/export` → `export.routes.ts`
   - `/api/settings` → `settings.routes.ts`
   - `/api/health` → Health check endpoint

3. **Database Initialization:**
   - Calls `initializeDatabase()` before starting the server
   - Creates SQLite tables if they don't exist
   - Inserts default settings

4. **Production Static Serving:**
   - `express.static(path.join(__dirname, '../../client/dist'))` serves built React files
   - `app.get('*')` catches all non-API routes and serves `index.html` for SPA routing

### 5.2 Service Layer

#### PlagiarismService (`server/src/services/plagiarism.service.ts`)
- **N-gram Matching:** Splits text into n-grams (configurable n=3/5/7) and compares against corpus
- **Cosine Similarity:** Vector-based similarity calculation between text and corpus papers
- **String Comparison:** Uses `string-similarity` library for direct string matching
- **Threshold-based filtering:** Only reports matches above the configured threshold (default: 15%)

#### LLMService (`server/src/services/llm.service.ts`)
- **Provider Detection:** Reads `LLM_PROVIDER` env var (`openai`, `gemini`, `anthropic`, `ollama`, or `fallback`)
- **OpenAI Integration:** Uses `openai` SDK with 30s timeout
- **Gemini Integration:** Uses `axios` REST API to `generativelanguage.googleapis.com`
- **Anthropic Integration:** Uses `axios` REST API to `api.anthropic.com`
- **Ollama Integration:** Uses `axios` to local Ollama instance
- **Fallback:** Rule-based paraphrasing using synonym replacement and sentence restructuring
- **Graceful Degradation:** If no provider is configured or API call fails, automatically falls back to rule-based suggestions

#### TopicService (`server/src/services/topic.service.ts`)
- Extracts topic/category from input text using keyword analysis
- Used for automatic source gathering

#### WebSearchService (`server/src/services/web-search.service.ts`)
- Searches DuckDuckGo for related content
- Returns web sources for plagiarism comparison

#### AutoSourceService (`server/src/services/auto-source.service.ts`)
- Orchestrates automatic source gathering
- Combines local corpus, web search, and arXiv results
- Configurable number of arXiv results (default: 5)

### 5.3 Middleware

#### RateLimiter (`server/src/middleware/rate-limit.ts`)
- In-memory rate limiting using a `Map`
- Default: 60 requests per 60 seconds per IP
- Prevents abuse of API endpoints
- Cleanup interval runs every 60 seconds

### 5.4 Database (`server/src/db/init.ts`)

Uses **sql.js** (SQLite compiled to WebAssembly) for an in-memory database:

- **Database Path:** `server/data/plagiarism.db`
- **Initialization:** Creates tables if they don't exist
- **Tables:** `checks`, `corpus_papers`, `settings`
- **Persistence:** Database is saved to disk after each write operation
- **Path Resolution:** Uses `path.dirname()` for cross-platform compatibility

---

## 6. Client Architecture

### 6.1 Application Structure

The client is a **React + TypeScript** single-page application built with **Vite**.

#### Routing (`client/src/App.tsx`)
```
/          → Layout → HomePage
/results   → Layout → ResultsPage
/corpus    → Layout → CorpusPage
/history   → Layout → HistoryPage
/settings  → Layout → SettingsPage
```

#### Layout (`client/src/components/Layout.tsx`)
- Navigation bar with links to all pages
- Consistent header and footer across pages

#### Pages
| Page | Function |
|------|----------|
| **HomePage** | Text input area, file upload (drag-and-drop), configuration options (threshold, n-gram size, citation style, web search toggle) |
| **ResultsPage** | Similarity percentage, charts (Recharts), highlighted text, paragraph breakdown, fix suggestions, export options |
| **CorpusPage** | Upload/manage reference papers, toggle papers on/off, delete papers |
| **HistoryPage** | View past plagiarism checks, save/delete history items |
| **SettingsPage** | Configure LLM provider, model, API keys, and app preferences |

#### API Client (`client/src/utils/api.ts`)
- **Axios instance** with `baseURL: '/api'` and 120s timeout
- All API calls use `/api` prefix (proxied to Express server in dev)
- Interceptors handle error responses globally
- Functions: `checkPlagiarism()`, `suggestFix()`, `getCorpus()`, `uploadCorpusFile()`, `getHistory()`, `exportDocument()`, etc.

#### Key Components
| Component | Purpose |
|-----------|---------|
| **FixEditor** | Side-by-side original vs. fixed text, click-to-apply fixes, manual editing |
| **ProgressBar** | Visual progress indicator during analysis |
| **SkeletonLoader** | Loading placeholder UI |
| **Layout** | Navigation and page structure |

### 6.2 Build Configuration

- **Vite** dev server runs on port 5173
- API proxy: `/api` → `http://localhost:5000` (development only)
- Production build outputs to `client/dist/`
- TypeScript strict mode enabled

---

## 7. Database Schema

The database uses **sql.js** (SQLite via WebAssembly) with three tables:

### `checks` Table
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Unique check ID (`chk_timestamp_random`) |
| `date` | TEXT | ISO date string |
| `filename` | TEXT | Document name |
| `original_text` | TEXT | Original text analyzed |
| `similarity` | REAL | Overall similarity percentage |
| `matches` | TEXT | JSON string of match array |
| `exported` | INTEGER | 0 or 1 flag |
| `created_at` | TEXT | Auto-timestamp |

### `corpus_papers` Table
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Unique paper ID (`cor_timestamp_random`) |
| `filename` | TEXT | Paper name |
| `content` | TEXT | Full text content |
| `added_at` | TEXT | ISO date string |
| `enabled` | INTEGER | 1 (enabled) or 0 (disabled) |

### `settings` Table
| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT (PK) | Setting name |
| `value` | TEXT | Setting value |

**Default Settings:**
- `plagiarism_threshold` = `'15'`
- `ngram_size` = `'5'`
- `enable_web_check` = `'false'`
- `llm_provider` = `'openai'`
- `llm_model` = `'gpt-3.5-turbo'`

---

## 8. API Endpoints

### Check & Plagiarism
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/check-plagiarism` | Analyze text for plagiarism. Accepts text or file (multipart/form-data). Returns similarity %, matches, topic, sources. |
| POST | `/api/check-plagiarism/batch` | Batch plagiarism check for multiple texts. |

### Fix Suggestions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/suggest-fix` | Get paraphrasing suggestions for text. Returns suggestions array and citations. |
| POST | `/api/suggest-fix-batch` | Batch suggestion generation for multiple matches. |

### Corpus Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/corpus` | List all corpus papers |
| POST | `/api/corpus` | Add paper via text |
| POST | `/api/corpus/upload` | Upload paper file (.txt, .doc, .docx, .pdf) |
| DELETE | `/api/corpus/:id` | Delete a paper |
| PATCH | `/api/corpus/:id/toggle` | Enable/disable a paper |
| GET | `/api/corpus/arxiv-search` | Search arXiv for papers |
| POST | `/api/corpus/arxiv-import` | Import paper from arXiv |
| POST | `/api/corpus/url-import` | Import paper from URL |

### History
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/history` | Get check history (last 100) |
| POST | `/api/history/save` | Save a check to history |
| DELETE | `/api/history/:id` | Delete history item |

### Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/export` | Export document as DOCX or PDF |
| POST | `/api/export/report` | Generate full plagiarism report as PDF |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get current settings |
| PUT | `/api/settings` | Update settings (threshold, n-gram, LLM provider, etc.) |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check endpoint |

---

## 9. LLM Integration

### 9.1 Supported Providers

| Provider | Env Var | Model Default | API Endpoint | Timeout |
|----------|---------|---------------|--------------|---------|
| **OpenAI** | `OPENAI_API_KEY` | `gpt-3.5-turbo` | `api.openai.com` | 30s |
| **Gemini** | `GEMINI_API_KEY` | `gemini-1.5-flash` | `generativelanguage.googleapis.com` | 30s |
| **Anthropic** | `ANTHROPIC_API_KEY` | `claude-3-haiku-20240307` | `api.anthropic.com` | 15s |
| **Ollama** | `OLLAMA_URL` | `llama2` | Local (`localhost:11434`) | 30s |
| **Fallback** | None | N/A | N/A | N/A |

### 9.2 Provider Selection Logic

```
LLM_PROVIDER env var → Provider
├── 'openai' + OPENAI_API_KEY → OpenAI SDK
├── 'gemini' + GEMINI_API_KEY → axios POST to Gemini API
├── 'anthropic' + ANTHROPIC_API_KEY → axios POST to Anthropic API
├── 'ollama' → axios POST to local Ollama
└── default ('fallback') → Rule-based paraphrasing
```

### 9.3 Fallback Mechanism

When no LLM provider is configured or the API call fails:
1. `callLLM()` throws `'No LLM provider configured'`
2. `suggestFix()` catches the error
3. `getFallbackSuggestions()` is called:
   - Splits text into sentences
   - Replaces common words with synonyms
   - Restructures sentence order
   - Adds hedging phrases ("It appears that...", "Evidence suggests that...")
4. Citations are still generated using `generateCitations()`

### 9.4 Gemini API Integration

Uses `axios` to call the Gemini REST API directly (no SDK needed):
```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}
Body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1000, temperature: 0.7 } }
```

---

## 10. Deployment

### 10.1 Render (Recommended)

**Configuration:** `render.yaml` at project root

```yaml
services:
  - type: web
    name: pcfa-server
    env: node
    plan: starter
    nodeVersion: 18
    buildCommand: npm run build
    startCommand: npm start
    rootDir: .
    envVars:
      - key: PORT
        value: 5000
      - key: CLIENT_URL
        value: https://YOUR-RENDER-URL.onrender.com
      - key: LLM_PROVIDER
        value: fallback
      - key: LLM_MODEL
        value: gemini-1.5-flash
    healthCheckPath: /api/health
    autoDeploy: true
    regions:
      - us-east-1
```

**Deployment Steps:**
1. Push code to GitHub
2. Sign up at [Render](https://render.com) with GitHub
3. Create Web Service → Connect repo
4. Configure build/start commands
5. Add environment variables and secrets
6. Deploy

**How it works:**
- `npm run build` compiles both client (Vite) and server (TypeScript)
- `npm start` runs `node dist/index.js` from the server directory
- Express serves the built React app as static files
- Single port (5000) serves both API and frontend

### 10.2 Local Production

```bash
npm run build    # Builds both client and server
npm start        # Starts Express server on port 5000
```

The server automatically serves `client/dist/index.html` for all non-API routes.

### 10.3 Free Tier Considerations

- **Render Starter:** 750 hours/month (enough for 1 web service)
- **Cold starts:** ~30s delay on first request after inactivity
- **Ephemeral filesystem:** SQLite database resets on deploy (data is not persistent between deploys)
- **No persistent storage:** For production with persistent data, consider a managed database

---

## 11. Environment Variables

### Root `.env`
```env
PORT=5000
CLIENT_URL=http://localhost:5173
LLM_PROVIDER=fallback
LLM_MODEL=gemini-1.5-flash
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

### Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Server port |
| `CLIENT_URL` | No | `http://localhost:5173` | Frontend URL for CORS |
| `LLM_PROVIDER` | No | `fallback` | LLM provider (`openai`, `gemini`, `anthropic`, `ollama`, `fallback`) |
| `LLM_MODEL` | No | `gemini-1.5-flash` | LLM model name |
| `OPENAI_API_KEY` | Only if `LLM_PROVIDER=openai` | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | Only if `LLM_PROVIDER=anthropic` | — | Anthropic API key |
| `GEMINI_API_KEY` | Only if `LLM_PROVIDER=gemini` | — | Google Gemini API key |
| `OLLAMA_URL` | Only if `LLM_PROVIDER=ollama` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | Only if `LLM_PROVIDER=ollama` | `llama2` | Ollama model name |

### Security Notes
- `.env` is in `.gitignore` — never committed to GitHub
- API keys should be added as **Secrets** in Render, not plain environment variables
- The `.env.example` file is committed as a template

---

## 12. Key Design Decisions

### 12.1 Monorepo with npm Workspaces
- **Why:** Single repository for client and server, shared dependencies, simplified CI/CD
- **Benefit:** `npm run build` builds everything, `npm start` starts the server

### 12.2 Local-First Architecture
- **Why:** Privacy is critical for plagiarism detection — user text should not leave their machine
- **Implementation:** SQLite database stored locally, all analysis runs server-side
- **Trade-off:** No multi-user collaboration, database resets on deploy

### 12.3 Non-Blocking LLM Enrichment
- **Why:** LLM API calls are slow and unreliable. Blocking the plagiarism check on them causes timeouts.
- **Implementation:** Plagiarism check returns matches immediately. Fix suggestions are fetched on-demand via `/api/suggest-fix` when the user clicks "Fix".
- **Benefit:** Fast results, graceful degradation if LLM is unavailable

### 12.4 sql.js (SQLite in WASM)
- **Why:** No need for a separate database server. Single-file database, easy deployment.
- **Trade-off:** In-memory database (persists via file I/O), not suitable for high-concurrency scenarios

### 12.5 Express Static File Serving
- **Why:** Single-port deployment simplifies hosting. No need for separate frontend hosting.
- **Implementation:** `express.static()` serves `client/dist/`, catch-all route serves `index.html` for SPA routing
- **Benefit:** Works on any Node.js hosting platform (Render, Railway, VPS)

### 12.6 Multi-Provider LLM Support
- **Why:** Avoid vendor lock-in. Different providers have different free tiers and capabilities.
- **Implementation:** Provider pattern with `LLMService` class, each provider has its own code path
- **Fallback:** Rule-based paraphrasing ensures the app always works, even without API keys

### 12.7 File Format Support
- **Why:** Academic papers come in various formats. Supporting PDF, DOCX, and TXT covers most use cases.
- **Implementation:** `pdf-parse`, `mammoth`, `docx` libraries for text extraction
- **Limitations:** Large PDFs (>10MB) are rejected by multer

---

## Appendix: Testing

### Server Tests
```bash
cd server && npm test
```
Uses **Jest** with **supertest** for API endpoint testing.

### Client Tests
```bash
cd client && npm test
```
Uses **Jest** with **@testing-library/react** for component testing.

### Sample Test Files
Located in `test/files/`:
- `sample-input.txt` — Sample text for plagiarism testing
- `sample-paper.txt` — Sample reference paper

---

## Appendix: Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails on Render | Check `npm run build` output for TypeScript errors |
| Database error `mkdir ''` | Fixed: `path.dirname()` replaces hardcoded backslash in `init.ts` |
| App hangs at fix suggestions | Fixed: Added 30s timeout to OpenAI client; non-blocking LLM enrichment |
| CORS errors | Set `CLIENT_URL` to the deployed URL in Render env vars |
| LLM suggestions fail | Check API key as Secret in Render; app falls back to rule-based |
| Port already in use | Change `PORT` in `.env` |
| File upload fails | Check file format (.txt/.doc/.docx/.pdf) and size (<10MB) |
| "Text too short" error | Enter at least 100 characters |

---

*This document covers the complete architecture of the Plagiarism Checker & Fix Assistant. For usage instructions, see [README.md](./README.md).*
