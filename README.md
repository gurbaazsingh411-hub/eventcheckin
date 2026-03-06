# EventPresence | Effortless Check-ins

**EventPresence** is a streamlined event management and presence tracking system designed for speed, reliability, and ease of use. This platform allows organizers to manage participants in real-time and provides a frictionless check-in experience for attendees.

> Made with ❤️ by **DevX**

## 🚀 Key Features

- **Instant Check-ins**: Participants can confirm their presence using a unique event code.
- **Admin Dashboard**: A comprehensive suite for event managers to:
  - Import/Export participant lists (CSV/Excel support).
  - Manage event schedules in real-time.
  - Track "Overnight Stay" registrations.
  - Search and filter participant lists by name or email.
  - Manage multiple administrators via invite links.
- **Mobile-First Design**: Fully responsive UI/UX optimized for organizers on the go.
- **Real-time Sync**: Powered by Supabase for instantaneous updates across all connected devices.
- **SPA Reliability**: Implements hash-based routing to ensure persistent sessions even after page refreshes.

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui (Radix UI)
- **Backend/Database**: Supabase (PostgreSQL, Auth, Real-time)
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router DOM (HashRouter)
- **Animations**: Framer Motion

## ⚙️ Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd event-flow-main
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## 📂 Project Structure

- `/src/pages`: Application views (Index, Dashboard, AdminDashboard, etc.)
- `/src/components`: Reusable UI components powered by shadcn/ui.
- `/src/integrations`: Supabase client configuration and hooks.
- `/supabase`: Database migrations and schema definitions.

---

© 2026 DevX. All rights reserved.
