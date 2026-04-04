# PR Review Agent — UI

Interfaz web para el agente de code review de PRs de GitHub.

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar en desarrollo
npm run dev
# → http://localhost:3000
```

Variables de entorno opcionales en `.env.local`
(si no las configurás acá, podés ingresarlas directamente en la UI):

```env
GITHUB_PAT=github_pat_...
GITHUB_REPO=owner/repo
LLM_PROVIDER=ollama          # o anthropic
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=codellama
OLLAMA_TIMEOUT_MS=120000
ANTHROPIC_API_KEY=sk-ant-...
```

## Estructura

```
src/
├── app/               # Next.js App Router
│   ├── api/review/    # SSE endpoint
│   ├── page.tsx       # Página principal (lean orchestrator)
│   └── globals.css    # Design system
├── components/
│   ├── modals/        # PromptModal, ModelModal
│   ├── panels/        # AppHeader, LogPanel, ResultsPanel
│   └── ui/            # Button, Input, Modal, Badge
├── hooks/
│   ├── useSettings.ts # Persistencia en localStorage
│   └── useReview.ts   # Lógica SSE streaming
├── store/
│   └── settings.ts    # Estado global + defaults
├── types/
│   └── index.ts       # Tipos centralizados
└── lib/               # Lógica de agente (GitHub, LLM, diff)
```

## Uso

1. Ingresá tu **GitHub PAT** y el **repositorio** en el header
2. Hacé click en **⬡ Modelo** para configurar Ollama o Claude
3. Opcional: editá el **System Prompt** con las reglas de tu equipo
4. Ingresá el número de PR y hacé click en **▶ Ejecutar**
5. El panel izquierdo muestra el log en tiempo real
6. El panel derecho muestra la tabla de hallazgos con filtros y detalle expandible
