# Plagiarism Checker & Fix Assistant (PCFA)

A complete web-based tool that checks text for plagiarism against web sources and local academic corpora, then provides actionable fix suggestions you can apply manually.

## Features

- **Text Input & File Upload** — Paste text or drag-and-drop `.txt`, `.doc`, `.docx`, `.pdf` files
- **Plagiarism Detection** — N-gram matching (n=3/5/7), cosine similarity, string comparison
- **Local Corpus** — Upload and manage your own reference papers for offline comparison
- **Web Search Check** — Opt-in comparison against web sources (DuckDuckGo)
- **Results Dashboard** — Overall similarity %, charts, highlighted text, paragraph breakdown
- **AI Fix Suggestions** — Paraphrased rewrites via OpenAI, Claude, or local Ollama (with rule-based fallback)
- **Citation Recommendations** — APA, IEEE, and MLA format suggestions
- **Interactive Fix Editor** — Side-by-side original vs. fix, click-to-apply, manual editing
- **Export** — Download fixed document as `.docx` or `.pdf`, plus full plagiarism report
- **Check History** — Save and review past analyses (local SQLite, opt-in)
- **Local-first** — All analysis runs on your machine; no data leaves your server

## Project Structure

```
pliagarism-removal-checker-tool/
├── client/                 # React + TypeScript + Tailwind frontend
│   ├── src/
│   │   ├── components/     # Layout, FixEditor, ProgressBar, etc.
│   │   ├── pages/          # Home, Results, Corpus, History, Settings
│   │   ├── types/          # TypeScript interfaces
│   │   ├── utils/          # API client, helpers
│   │   └── styles/         # Tailwind CSS
│   ├── index.html
│   ├── package.json
│   └── tsconfig.json
├── server/                 # Express + TypeScript backend
│   ├── src/
│   │   ├── controllers/    # Corpus, History, Settings
│   │   ├── services/       # Plagiarism engine, LLM service
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Rate limiting
│   │   ├── db/             # SQLite initialization
│   │   ├── types/          # Shared types
│   │   └── utils/          # PDF/DOCX parsers
│   ├── package.json
│   └── tsconfig.json
├── .env                    # API keys (create from .env.example)
├── package.json            # Root monorepo config
└── README.md
```

## Setup

### Prerequisites

- Node.js >= 18
- npm >= 9

### 1. Install Dependencies

```bash
# From the project root — installs workspaces (client + server)
npm install

# Or install each separately:
cd client && npm install
cd ../server && npm install
```

### 2. Configure Environment Variables

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
PORT=5000
CLIENT_URL=http://localhost:5173

# Choose one LLM provider:
LLM_PROVIDER=openai        # openai | anthropic | ollama
LLM_MODEL=gpt-3.5-turbo

# Add your API key:
OPENAI_API_KEY=sk-...

# Or for Anthropic:
# ANTHROPIC_API_KEY=sk-ant-...

# Or for local Ollama (no API key needed):
# LLM_PROVIDER=ollama
# LLM_MODEL=llama2
# OLLAMA_URL=http://localhost:11434
```

> **Note:** If no LLM is configured, the tool uses rule-based paraphrasing as a fallback — fix suggestions still work.

### 3. Run in Development

```bash
# From the project root — starts both client and server:
npm run dev

# Or start them separately:
npm run dev:server   # Express on http://localhost:5000
npm run dev:client   # React on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

### 4. Production Build

```bash
npm run build    # Builds both client and server
npm start        # Starts the production server
```

## How to Add Papers to the Local Corpus

1. Navigate to **Corpus** in the navigation bar
2. **Upload a file**: Drag and drop or click to select `.txt`, `.doc`, `.docx`, `.pdf`
3. **Paste text**: Click "Paste text as a paper", give it a filename, and paste the content
4. Toggle papers **on/off** to include/exclude them from checks
5. Delete papers you no longer need with the trash icon

All corpus papers are stored locally in `server/data/plagiarism.db`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/check-plagiarism` | Analyze text for plagiarism |
| POST | `/api/suggest-fix` | Get paraphrasing suggestions |
| POST | `/api/suggest-fix-batch` | Batch suggestion generation |
| GET | `/api/corpus` | List corpus papers |
| POST | `/api/corpus` | Add paper (text) |
| POST | `/api/corpus/upload` | Upload paper file |
| DELETE | `/api/corpus/:id` | Delete paper |
| PATCH | `/api/corpus/:id/toggle` | Enable/disable paper |
| GET | `/api/history` | Get check history |
| POST | `/api/history/save` | Save a check |
| DELETE | `/api/history/:id` | Delete history item |
| POST | `/api/export` | Export as PDF/DOCX |
| POST | `/api/export/report` | Generate PDF report |
| GET | `/api/settings` | Get settings |
| PUT | `/api/settings` | Update settings |
| GET | `/api/health` | Health check |

## Usage

1. **Enter text** (100+ chars) or **upload a file** on the Home page
2. Adjust **threshold**, **n-gram size**, and **citation style** as needed
3. Optionally enable **web search** for broader checks
4. Click **Check for Plagiarism**
5. Review the **results dashboard**: similarity %, charts, highlighted text
6. Click **Fix** on any match to see paraphrasing suggestions and citations
7. **Apply fixes** one by one or edit manually
8. **Export** the corrected document or generate a full report
9. **Save to history** for later reference

## Testing

```bash
# Server tests
cd server && npm test

# Client tests
cd client && npm test
```

Sample test documents are in `test/files/`.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Text too short" | Enter at least 100 characters |
| File upload fails | Check format (.txt/.doc/.docx/.pdf) and size (<10MB) |
| LLM suggestions fail | Check API key in `server/.env`, or tool falls back to rule-based |
| Web check fails | Internet connection required; tool continues with local checks |
| Port already in use | Change `PORT` in `server/.env` |

## License

MIT

## Deployment

This app is a full-stack monorepo. The Express server serves the React frontend in production.

### Quick Deploy to Render (Free Tier)

1. **Push your code to GitHub** (see steps below)
2. **Sign up at [Render](https://render.com)** using your GitHub account
3. **Create a new Web Service** and connect your GitHub repository
4. **Configure the service:**
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Root Directory:** `.`
   - **Instance Type:** Starter (free)
5. **Add Environment Variables** in the Render dashboard:
   - `PORT` = `5000`
   - `CLIENT_URL` = `https://YOUR-RENDER-URL.onrender.com`
   - `LLM_PROVIDER` = `openai`
   - `LLM_MODEL` = `gpt-3.5-turbo`
   - `OPENAI_API_KEY` = *(add your key as a secret)*
   - `ANTHROPIC_API_KEY` = *(optional, add as secret)*
6. **Click Deploy** — Render will build and deploy automatically
7. **Share the URL** with your friends!

### Alternative: Deploy to Railway

1. Sign up at [Railway](https://railway.app) with GitHub
2. Create a new project and deploy from your GitHub repo
3. Set the same environment variables as above
4. Railway auto-deploys on every push

### Local Production Build

```bash
npm run build    # Builds both client and server
npm start        # Starts the production server on port 5000
```

The server automatically serves the React app from `client/dist/` in production.
