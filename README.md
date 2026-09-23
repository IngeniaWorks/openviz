# OpenViz 🎨

![OpenViz Interface](public/images/interface.png)

OpenViz is an AI-powered design application that transforms hand-sketched drawings and imported images into photorealistic renders using advanced text-to-image models. Built with a modern, intuitive workflow, it seamlessly bridges creative sketching with AI generation.

## ✨ Features

### 🎨 Studio — The Creative Canvas

A focused, high-performance workspace for sketching and AI generation.

**Drawing Tools**
- **Brush & Eraser** — Configurable size, opacity, hardness, and stabilizer
- **Shape Tools** — Rectangles, circles, and lines with stroke/fill options
- **Paint Bucket** — Quick fills with tolerance control
- **Transform** — Move, scale, and rotate objects after placement
- **Keyboard Shortcuts** — `B` brush, `E` eraser, `R` rect, `O` circle, `L` line, `S` select

**Layer System**
- Full layer management with reorder, rename, hide, delete
- Real-time thumbnails for every layer
- Opacity and blend modes (Normal, Multiply, Screen, Overlay)
- Support for sketch, image, and render layers
- Copy/paste layers between projects

**Canvas**
- Smooth zoom (10%–500%) and pan
- Viewport controls with fit-to-screen
- Grid and symmetry guides
- Background color customization

**AI Rendering**
- **ComfyUI Integration** — Connect to local ComfyUI for generation
- **Style Presets** — Switch between Photorealistic, Cyberpunk, Watercolor, and more
- **Reference Images** — Upload reference images to guide generation
- **Influence Slider** — Balance between sketch adherence and prompt creativity
- **Batch Generation** — Generate 1–4 variations at once
- **Results Gallery** — Browse, compare, and add renders to layers or workbench

### 🛠️ Workbench — Node-Based Flow

A powerful visual editor for managing complex projects with multiple assets.

**Node Types**
- **Image Nodes** — Sketch canvases with full Studio integration
- **Animate Nodes** — Keyframe-based animation with AI interpolation
- **Video Nodes** — Video processing and generation pipelines
- **Render Nodes** — AI render settings and batch configurations

**Flow Features**
- **Visual Connections** — Wire nodes together to create processing pipelines
- **Drag & Drop** — Add new sketches with preset formats (Square, A4, 16:9, etc.)
- **Context Menu** — Right-click nodes for copy, paste, duplicate, delete, and layer ordering
- **Batch Operations** — Select and move multiple nodes
- **Smart Navigation** — Auto-center on nodes when switching from Studio

### 📊 Dashboard — Project Management

Your central hub for organizing creative work.

**Project Browser**
- Grid and list view layouts
- Sort by last viewed, name, or creation date
- Search and filter projects
- Thumbnail previews

**Quick Actions**
- Create new projects in Studio or Workbench mode
- Jump directly to recent work
- Persistent project state across sessions

### 🔐 Authentication

- **GitHub OAuth** — Sign in with your GitHub account
- **Google OAuth** — Sign in with Google
- **Email** — Passwordless magic link login (optional)
- **Development Mode** — Quick dev login for local testing

---

## 🚀 Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine + Compose
- Optional for manual host mode only:
  - [Node.js](https://nodejs.org/) 18+
  - [PostgreSQL](https://www.postgresql.org/) 14+
  - [Redis](https://redis.io/)
  - [ComfyUI](https://github.com/comfyanonymous/ComfyUI)

### Quick Setup (Docker-First, Recommended)

After Docker Desktop or Docker Engine with Compose is installed, run this one-liner:

```bash
git clone https://github.com/IngeniaWorks/openviz.git && cd openviz && docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000). No Node.js, PostgreSQL, Redis, dependency installation, or environment-file setup is required on the host.

Docker automatically:
- builds the app container;
- installs dependencies;
- starts PostgreSQL and Redis with persistent volumes;
- waits for the database to become ready;
- generates local development configuration and an auth secret;
- applies the database schema; and
- seeds the default workspace and example project.

To customize the Docker setup, copy the example environment file before starting:

```bash
cp .env.docker.example .env.docker
docker compose up --build
```

If ports are already in use, change these values in `.env.docker`:
- `POSTGRES_HOST_PORT=5433`
- `REDIS_HOST_PORT=6380`
- `APP_HOST_PORT=3001`

Useful Docker commands:
```bash
pnpm run dev:docker    # start or rebuild the local stack
pnpm run docker:logs   # tail app, PostgreSQL, and Redis logs
pnpm run docker:down   # stop containers
```

If you hit `bind: address already in use`, free the host port or remap it in `.env.docker`.

### Manual Host Setup (Fallback)

1. **Clone the repository**
   ```bash
   git clone https://github.com/IngeniaWorks/openviz.git
   cd openviz
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your credentials:
   ```env
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/openviz
   
   # NextAuth
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key-here
  
   # Local dev login
   DEV_ADMIN_ID=00000000-0000-0000-0000-000000000000
   DEV_ADMIN_EMAIL=admin@example.com
   DEV_ADMIN_NAME=Demo Admin
   DEMO_PASSWORD=your-demo-password
   NEXT_PUBLIC_DEMO_PASSWORD=your-demo-password
   NEXT_PUBLIC_DEV_ADMIN_EMAIL=admin@example.com
   
   # OAuth (optional)
   GITHUB_ID=your-github-client-id
   GITHUB_SECRET=your-github-client-secret
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   
   # S3 (optional)
   S3_ENDPOINT=
   S3_ACCESS_KEY_ID=
   S3_SECRET_ACCESS_KEY=
   S3_BUCKET=
   
   # Redis (optional in local mock mode)
   REDIS_URL=redis://localhost:6379
   ```

4. **Initialize database and seed defaults**
   ```bash
   pnpm run setup
   ```
   
   If you need setup only (without auto-starting dev server in scripted contexts):
   ```bash
   pnpm run setup:container
   ```

5. **Launch ComfyUI (optional for mock mode)**
   ```bash
   # In your ComfyUI directory
   python main.py --listen --port 7821
   ```
   
   **Required Models:**
   - **Checkpoints:** `sd3.5_large_fp8_scaled.safetensors` → `ComfyUI/models/checkpoints/`
   - **ControlNet:** `sd3.5_large_controlnet_canny.safetensors` → `ComfyUI/models/controlnet/`

6. **Start development server**
   ```bash
   pnpm run dev
   ```

7. **Open in browser**
   ```
   http://localhost:3000
   ```

---

## 🏗️ Architecture

OpenViz follows a modern, modular architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│    Dashboard    │     Studio      │       Workbench         │
│  (Project Mgmt) │ (Canvas Editor) │   (Node Flow Editor)    │
└─────────────────┴─────────────────┴─────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │    State Layer     │
                    │    (Zustand)       │
                    └─────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐  ┌─────────▼──────────┐  ┌──────▼──────┐
│  Next.js API   │  │   ComfyUI Proxy    │  │    S3       │
│   (tRPC/REST)  │  │    (WebSocket)     │  │  (Assets)   │
└───────┬────────┘  └─────────┬──────────┘  └──────┬──────┘
        │                     │                     │
┌───────▼─────────────────────▼─────────────────────▼──────┐
│              Data & Infrastructure                        │
│     PostgreSQL    │    Redis    │    BullMQ Jobs         │
└───────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Framework** | [Next.js 16](https://nextjs.org/) | App Router, SSR, API routes |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | Type safety |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Utility-first CSS |
| **UI Components** | [Radix UI](https://www.radix-ui.com/) | Accessible primitives |
| **State** | [Zustand](https://github.com/pmndrs/zustand) | Global state management |
| **Animation** | [Framer Motion](https://www.framer.com/motion/) | Transitions & gestures |
| **Canvas** | [Konva.js](https://konvajs.org/) + [React-Konva](https://konvajs.org/docs/react/) | 2D drawing engine |
| **Node Editor** | [React Flow](https://reactflow.dev/) | Visual flow editor |
| **Auth** | [NextAuth.js](https://next-auth.js.org/) | Authentication |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) | Database queries |
| **Database** | [PostgreSQL](https://www.postgresql.org/) | Data persistence |
| **Queue** | [BullMQ](https://docs.bullmq.io/) + [Redis](https://redis.io/) | Job processing |
| **Storage** | [AWS S3](https://aws.amazon.com/s3/) | Asset storage |
| **AI** | [ComfyUI](https://github.com/comfyanonymous/ComfyUI) | Image generation |
| **Testing** | [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/) | Unit tests |

---

## 📁 Project Structure

```
openviz/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes (NextAuth, projects, jobs, generate)
│   │   ├── dashboard/      # Dashboard page
│   │   ├── login/          # Authentication page
│   │   ├── projects/[id]/  # Project workspace
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Landing/redirect
│   │
│   ├── components/
│   │   ├── dashboard/      # Dashboard components
│   │   ├── studio/         # Studio canvas UI
│   │   ├── workbench/      # Workbench node editor
│   │   ├── nodes/          # React Flow node components
│   │   └── common/         # Shared components
│   │
│   ├── store/              # Zustand state management
│   │   ├── slices/         # State slices (layer, tool, render, workbench)
│   │   ├── useStore.ts     # Main store hook
│   │   └── storeTypes.ts   # TypeScript types
│   │
│   ├── services/           # Business logic
│   │   ├── ai/            # Workflow registry, prompt handling
│   │   ├── renderService.ts
│   │   └── apiRenderService.ts
│   │
│   ├── lib/               # Utilities & config
│   │   ├── auth.ts        # NextAuth configuration
│   │   ├── db/schema.ts   # Drizzle schema
│   │   └── services/      # S3, job services
│   │
│   ├── hooks/             # Custom React hooks
│   ├── types/             # Global TypeScript types
│   └── utils/             # Utility functions
│
├── public/                # Static assets
├── drizzle/               # Database migrations
└── tests/                 # Test files
```

---

## 🧪 Available Scripts

```bash
# Development
pnpm run dev           # Start Next.js dev server
pnpm run setup         # First-run setup + start dev server
pnpm run setup:container # Non-interactive setup (no dev start), used by Docker entrypoint
pnpm run init          # Alias for setup
pnpm run dev:docker    # Docker-first dev startup
pnpm run docker:logs   # Tail Docker logs
pnpm run docker:down   # Stop Docker services
pnpm run db:studio     # Open Drizzle Studio (DB GUI)

# Build
pnpm run build         # Production build
pnpm start            # Start production server

# Database
pnpm run db:push       # Push schema changes to DB
pnpm run db:generate   # Generate migration files

# Testing
pnpm run test          # Run Vitest tests
pnpm run test:ui       # Open Vitest UI

# Code Quality
pnpm run lint          # Run ESLint
```

---

## 🛣️ Roadmap

### ✅ Completed

- [x] **Studio Mode** — Full canvas with drawing tools and layer system
- [x] **Workbench Mode** — Node-based flow editor with multiple node types
- [x] **Dashboard** — Project management with authentication
- [x] **ComfyUI Integration** — Real-time AI rendering
- [x] **Undo/Redo** — Full history management
- [x] **Keyboard Shortcuts** — Tool switching and actions
- [x] **Batch Generation** — Generate multiple variations

### 🚧 In Progress

- [ ] **Animate Mode** — Full animation pipeline with interpolation
- [ ] **Video Generation** — AI video synthesis workflows
- [ ] **Workflow Presets** — Save/load custom ComfyUI workflows
- [ ] **Import/Export** — PNG/JPG export and `.openviz` project files
- [ ] **Collaboration** — Real-time multi-user editing

### 🔮 Future

- [ ] **AI Prompt Assistant** — Auto-suggest prompts based on sketches
- [ ] **Mobile App** — Touch-optimized iOS/Android companion
- [ ] **Cloud Sync** — Cross-device project synchronization
- [ ] **Plugin System** — Third-party workflow extensions
- [ ] **Template Marketplace** — Community-contributed templates

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) for the amazing AI generation backend
- [Konva.js](https://konvajs.org/) for the powerful canvas library
- [React Flow](https://reactflow.dev/) for the node-based editor
- All the open-source contributors who make this project possible

---

<p align="center">
  Made with ❤️ by the OpenViz Team
</p>
