# APE POLICE - Crypto Community Watchdog

## Overview
APE POLICE is a community-driven crypto watchdog website built to expose scams, celebrate heroes, and keep the blockchain jungle safe. It features scam reporting, hero nominations, community voting, and rankings.

## Architecture
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter (frontend), Express routes (backend)
- **State Management**: TanStack React Query

## Project Structure
```
client/src/
  pages/
    home.tsx          - Main landing page with all sections
    report-scam.tsx   - Scam reporting form + reports list
    nominate-hero.tsx - Hero nomination form + nominations list
    rankings.tsx      - Community leaderboard
    not-found.tsx     - 404 page
  components/
    navigation.tsx       - Top nav with logo and menu
    hero-section.tsx     - Hero banner
    mission-section.tsx  - Mission statement cards
    tokenomics-section.tsx - Token details
    channel-section.tsx  - Channel info with leaderboard preview
    roadmap-section.tsx  - 4-phase roadmap
    join-section.tsx     - Social links (Telegram, X, etc.)
    footer.tsx           - Footer with disclaimer
    ui/                  - shadcn/ui components (do not edit)
server/
  index.ts    - Express server setup
  routes.ts   - API endpoints
  storage.ts  - Database operations (DatabaseStorage)
  db.ts       - PostgreSQL connection
shared/
  schema.ts   - Drizzle ORM schemas, Zod validation, TypeScript types
```

## Database Tables
- `users` - User accounts
- `scam_reports` - Reported scams with votes
- `hero_nominations` - Hero nominations with votes
- `votes` - Community votes on reports/nominations

## Theme
- Dark theme (slate-900 background)
- Custom APE POLICE colors: electric-blue, jungle-green, warning-yellow, deep-navy, neon-pink, police-blue
- Custom fonts: Fredoka One (meme), Orbitron (monospace), Inter (sans)
- Custom animations: siren, float, wiggle, flash

## API Endpoints
- `GET/POST /api/scam-reports` - Scam reports CRUD
- `GET/POST /api/hero-nominations` - Hero nominations CRUD
- `POST /api/votes` - Voting on reports/nominations
