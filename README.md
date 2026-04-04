# PR Review Agent

Agente de code review impulsado por IA para Pull Requests de GitHub. Analiza el diff de un PR, detecta problemas de código aplicando las reglas de tu equipo, y los presenta en una tabla interactiva con prioridad, categoría, snippet y sugerencia de corrección.

Soporta dos modos de ejecución:

- **Ollama** — modelo local (CodeLlama u otros), corre en tu propia máquina, sin costo y sin que el código salga de tu entorno.
- **Claude (Anthropic)** — modelo en la nube, más capaz, requiere API key.

---

## Índice

1. [¿Qué hace?](#qué-hace)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Dependencias](#dependencias)
4. [Instalación y uso local](#instalación-y-uso-local)
5. [Configurar GitHub PAT](#configurar-github-pat)
6. [Configurar Ollama + CodeLlama](#configurar-ollama--codellama)
7. [Exponer Ollama con ngrok (para deploy en la nube)](#exponer-ollama-con-ngrok-para-deploy-en-la-nube)
8. [Configurar Claude (Anthropic)](#configurar-claude-anthropic)
9. [Deploy en Vercel](#deploy-en-vercel)
10. [Variables de entorno](#variables-de-entorno)
11. [System Prompt](#system-prompt)

---

## ¿Qué hace?

1. Se conecta a la API de GitHub y descarga el diff completo del PR indicado.
2. Parsea el diff en hunks con números de línea exactos.
3. Envía el código al LLM configurado (local o cloud) con un system prompt que define las reglas de revisión.
4. Valida la respuesta JSON con Zod y la muestra en una tabla con:
   - **Archivo y línea** exacta del problema
   - **Prioridad**: HIGH / MEDIUM / LOW
   - **Categoría**: bug, security, performance, style, maintainability, suggestion
   - **Snippet** de la línea problemática
   - **Comentario** técnico + sugerencia de corrección
5. El panel izquierdo muestra los logs del proceso en tiempo real (streaming SSE).

---

## Estructura del proyecto

```
gh-review-ui/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── review/route.ts   # Endpoint SSE principal — orquesta todo el análisis
│   │   │   └── prompt/route.ts   # Devuelve el system prompt por defecto
│   │   ├── page.tsx              # Página principal (orquestador de componentes)
│   │   ├── layout.tsx            # Root layout con fuentes
│   │   └── globals.css           # Variables CSS + Tailwind base
│   │
│   ├── components/
│   │   ├── modals/
│   │   │   ├── ModelModal.tsx    # Configuración del LLM (Ollama / Claude)
│   │   │   └── PromptModal.tsx   # Editor del system prompt con sección bloqueada
│   │   ├── panels/
│   │   │   ├── AppHeader.tsx     # Header con inputs de PAT, repo, PR# y acciones
│   │   │   ├── LogPanel.tsx      # Panel izquierdo — logs en tiempo real
│   │   │   └── ResultsPanel.tsx  # Panel derecho — tabla de hallazgos
│   │   └── ui/                   # Primitivas shadcn/ui (Button, Input, Dialog, Badge…)
│   │
│   ├── hooks/
│   │   ├── useSettings.ts        # Lee/guarda settings en localStorage
│   │   └── useReview.ts          # Lógica de streaming SSE + estado de la corrida
│   │
│   ├── store/
│   │   └── settings.ts           # Defaults, LOCKED_SCHEMA, helpers de persistencia
│   │
│   ├── types/
│   │   └── index.ts              # Tipos centralizados (Finding, ReviewResult, etc.)
│   │
│   └── lib/                      # Lógica del agente (sin UI)
│       ├── llm-engine.ts         # Proveedores Ollama y Claude, retry con feedback
│       ├── diff-parser.ts        # Parser del unified diff con números de línea exactos
│       ├── diff-fetcher.ts       # Descarga el diff crudo desde GitHub API
│       ├── pr-fetcher.ts         # Metadata del PR (título, autor, archivos)
│       ├── github-client.ts      # Cliente Octokit autenticado
│       ├── review-schema.ts      # Schema Zod + normalización de la respuesta del LLM
│       ├── prompts.ts            # Builders de user prompt (por archivo y completo)
│       └── utils.ts              # cn() helper para Tailwind
│
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── next.config.js
└── package.json
```

---

## Dependencias

### Runtime

| Paquete                    | Versión  | Para qué                                    |
| -------------------------- | -------- | ------------------------------------------- |
| `next`                     | 15.0.0   | Framework React con App Router y API routes |
| `react` / `react-dom`      | ^18.3.1  | UI                                          |
| `@octokit/rest`            | ^20.1.1  | Cliente oficial de la API de GitHub         |
| `@anthropic-ai/sdk`        | ^0.82.0  | SDK oficial de Claude (solo si usás Claude) |
| `zod`                      | ^3.23.8  | Validación del JSON devuelto por el LLM     |
| `@radix-ui/react-*`        | varios   | Primitivas accesibles para shadcn/ui        |
| `class-variance-authority` | ^0.7.0   | Variantes de componentes (shadcn)           |
| `clsx` + `tailwind-merge`  | ^2       | Utilidades de clases CSS                    |
| `lucide-react`             | ^0.460.0 | Iconos                                      |
| `tailwindcss-animate`      | ^1.0.7   | Animaciones de Radix                        |

### Dev

| Paquete                    | Para qué                    |
| -------------------------- | --------------------------- |
| `tailwindcss` ^3.4         | Framework CSS utility-first |
| `autoprefixer` / `postcss` | Procesamiento de CSS        |
| `typescript` ^5.3          | Tipado estático             |

---

## Instalación y uso local

### Requisitos previos

- Node.js 18 o superior
- npm 9 o superior
- Cuenta de GitHub (para el PAT)

### Pasos

```bash
# 1. Clonar o descomprimir el proyecto
cd gh-review-ui

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno (opcional si usás la UI)
cp .env.local.example .env.local
# Editar .env.local con tu editor preferido

# 4. Levantar en modo desarrollo
npm run dev
# → http://localhost:3000

# Para producción
npm run build && npm start
```

> **Nota:** todas las variables de entorno son opcionales si las configurás directamente en la UI de la app. El botón **⬡ Modelo** abre el modal de configuración y el header tiene los inputs de PAT y repositorio.

---

## Configurar GitHub PAT

El agente necesita un **Personal Access Token** (PAT) para leer los Pull Requests.

### Crear el token

1. Ir a [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click en **Generate new token → Fine-grained token** (recomendado) o **Classic**
3. Permisos mínimos necesarios:
   - **Fine-grained:** `Pull requests: Read-only` en el repositorio específico
   - **Classic:** marcar `repo` (o solo `public_repo` si el repo es público)
4. Copiar el token generado (empieza con `github_pat_...`)

### Dónde usarlo

**En la UI:** pegarlo en el campo **GitHub PAT** del header — se guarda automáticamente en `localStorage`.

**En `.env.local`:**

```env
GITHUB_PAT=github_pat_xxxxxxxxxxxxxxxxxxxx
```

---

## Configurar Ollama + CodeLlama

Ollama permite correr modelos LLM localmente, sin costo y sin que el código salga de tu máquina.

### 1. Instalar Ollama

Descargarlo desde [ollama.com/download](https://ollama.com/download) o con Homebrew en macOS:

```bash
brew install ollama
```

### 2. Descargar CodeLlama

```bash
ollama pull codellama
```

Esto descarga el modelo de ~4 GB. Otras opciones según tu hardware:

| Modelo           | VRAM requerida | Calidad                     |
| ---------------- | -------------- | --------------------------- |
| `codellama` (7B) | ~4 GB          | Bueno para la mayoría       |
| `codellama:13b`  | ~8 GB          | Mejor precisión             |
| `codellama:34b`  | ~20 GB         | El mejor, muy lento sin GPU |
| `deepseek-coder` | ~4 GB          | Alternativa muy capaz       |
| `qwen2.5-coder`  | ~4 GB          | Excelente para código       |

### 3. Iniciar Ollama

```bash
ollama serve
```

O simplemente abrir la app de escritorio de Ollama si la instalaste con el instalador.

Verificar que esté corriendo:

```bash
curl http://localhost:11434/api/tags
# Debe devolver JSON con la lista de modelos instalados
```

### 4. Configurar en la UI

Hacer click en el botón **⬡ Ollama** del header → se abre el modal con las variables:

| Variable            | Default                  | Descripción              |
| ------------------- | ------------------------ | ------------------------ |
| `OLLAMA_HOST`       | `http://localhost:11434` | URL del servidor Ollama  |
| `OLLAMA_MODEL`      | `codellama`              | Nombre exacto del modelo |
| `OLLAMA_TIMEOUT_MS` | `120000`                 | Timeout en ms (2 min)    |

---

## Exponer Ollama con ngrok (para deploy en la nube)

Si la app está deployada en Vercel u otro hosting, `localhost:11434` apunta a los servidores del host, no a tu máquina. Necesitás exponer Ollama públicamente con ngrok.

### Por qué el 403

Desde la versión 0.1.29, Ollama verifica el header `Origin` de cada request y rechaza los que no coinciden con los orígenes permitidos. Cuando el request viene de Vercel a través de ngrok, el origen no es `localhost` y Ollama lo bloquea.

### Solución completa (dos pasos obligatorios)

**Paso 1 — Configurar `OLLAMA_ORIGINS` en tu Mac**

Antes de iniciar Ollama, hay que permitir cualquier origen:

```bash
# Opción A: setear la variable de entorno del sistema (persiste entre reinicios)
launchctl setenv OLLAMA_ORIGINS "*"
# Luego abrir/reiniciar la app de Ollama

# Opción B: arrancar Ollama desde terminal con la variable (solo para esa sesión)
OLLAMA_ORIGINS="*" ollama serve
```

**Paso 2 — Instalar y configurar ngrok**

```bash
# Instalar con Homebrew
brew install --cask ngrok

# Crear cuenta gratuita en ngrok.com y obtener el authtoken
ngrok config add-authtoken TU_AUTHTOKEN

# Exponer Ollama con el host-header correcto (OBLIGATORIO para evitar el 403)
ngrok http 11434 --host-header="localhost:11434"
```

La flag `--host-header="localhost:11434"` hace que ngrok reescriba el header `Host` de cada request antes de reenviarlo a Ollama, para que Ollama lo reconozca como un request local válido.

**Paso 3 — Usar la URL de ngrok en la UI**

ngrok mostrará algo como:

```
Forwarding  https://abc123def456.ngrok-free.app -> http://localhost:11434
```

En el modal de modelo de la app, cambiar `OLLAMA_HOST` a esa URL:

```
OLLAMA_HOST = https://abc123def456.ngrok-free.app
```

> **Atención:** en el plan gratuito de ngrok la URL cambia cada vez que reiniciás el túnel. Para una URL fija hay que pagar el plan de ngrok, o usar [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) que es gratuito y mantiene el dominio.

### Flujo completo con ngrok

```
Vercel (nube)
  → POST https://abc123.ngrok-free.app/api/chat
      → ngrok reescribe Host: localhost:11434
          → Ollama en tu Mac (OLLAMA_ORIGINS="*") ✅
```

---

## Configurar Claude (Anthropic)

Claude corre en la nube de Anthropic. No requiere hardware especial ni ngrok, pero necesita una API key paga.

### 1. Obtener la API key

1. Crear cuenta en [console.anthropic.com](https://console.anthropic.com)
2. Ir a **API Keys → Create Key**
3. Copiar la key (empieza con `sk-ant-...`)

### 2. Configurar en la UI

Hacer click en el botón del modelo → seleccionar **Claude** → ingresar:

| Variable            | Valor                             |
| ------------------- | --------------------------------- |
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...`                |
| `ANTHROPIC_MODEL`   | `claude-sonnet-4-5` (recomendado) |

### Modelos disponibles

| Modelo                      | Velocidad  | Capacidad | Costo |
| --------------------------- | ---------- | --------- | ----- |
| `claude-opus-4-5`           | Lento      | Máxima    | Alto  |
| `claude-sonnet-4-5`         | Balanceado | Alta      | Medio |
| `claude-haiku-4-5-20251001` | Rápido     | Buena     | Bajo  |

### Para deploy en Vercel

Agregar en **Vercel → Settings → Environment Variables**:

```
ANTHROPIC_API_KEY=sk-ant-...
LLM_PROVIDER=anthropic
ANTHROPIC_MODEL=claude-sonnet-4-5
```

---

## Deploy en Vercel

### Deploy directo

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Variables de entorno en Vercel

Ir a **Vercel → tu proyecto → Settings → Environment Variables** y agregar:

```env
GITHUB_PAT=github_pat_...
GITHUB_REPO=owner/repo         # opcional, se puede ingresar en la UI

# Si usás Claude:
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5

# Si usás Ollama vía ngrok:
LLM_PROVIDER=ollama
OLLAMA_HOST=https://abc123.ngrok-free.app
OLLAMA_MODEL=codellama
OLLAMA_TIMEOUT_MS=120000
```

> **Importante:** si las variables están definidas en Vercel, la app las usa directamente al ejecutar el análisis. Los valores ingresados en la UI tienen prioridad sobre las variables de entorno del servidor.

---

## Variables de entorno

Referencia completa de todas las variables disponibles en `.env.local`:

```env
# ── GitHub ────────────────────────────────────────────────────
GITHUB_PAT=github_pat_xxxx         # Personal Access Token (requerido)
GITHUB_REPO=owner/repo             # Repo por defecto (opcional)

# ── LLM Provider ──────────────────────────────────────────────
LLM_PROVIDER=ollama                # "ollama" o "anthropic"

# ── Ollama ────────────────────────────────────────────────────
OLLAMA_HOST=http://localhost:11434  # URL del servidor (o URL de ngrok)
OLLAMA_MODEL=codellama              # Nombre del modelo instalado
OLLAMA_TIMEOUT_MS=120000           # Timeout en ms para la respuesta
OLLAMA_IGNORE_SSL=true             # Ignorar errores de certificado SSL

# ── Anthropic ─────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...       # API key de Anthropic
ANTHROPIC_MODEL=claude-sonnet-4-5  # Modelo a usar

# ── SSL (redes corporativas / VPN) ────────────────────────────
NODE_TLS_REJECT_UNAUTHORIZED=0     # Deshabilitar verificación SSL (solo dev)
```

---

## System Prompt

El agente usa un system prompt que define cómo debe revisar el código. Se puede editar haciendo click en el botón **✎ Prompt** del header.

El prompt tiene dos secciones:

- **Editable:** reglas del equipo, criterios de prioridad, tono. Se puede modificar, importar desde `.md` y exportar.
- **Bloqueada (🔒):** el esquema JSON de respuesta. Esta sección no se puede modificar porque define el contrato entre el LLM y la tabla de resultados. Si se cambia, la respuesta del LLM no va a parsear correctamente.

El prompt por defecto incluye reglas como:

- No dejar `console.log` en producción
- Usar optional chaining y nullish coalescing
- Manejar errores en todo código async
- No usar `any` en TypeScript
- Nombres descriptivos en inglés

Estas reglas se pueden reemplazar por las convenciones de tu equipo.
