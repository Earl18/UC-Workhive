# UC WorkHive Tech Stack

This document summarizes the technologies currently used in the UC WorkHive system based on the repository's source code, manifests, and deployment configuration.

## Core Application

- Next.js 16
- React 19
- TypeScript 5
- Node.js 22 for containerized runtime

## Frontend

- Tailwind CSS 4
- shadcn/ui
- Radix UI component primitives
- Lucide React for icons
- Framer Motion for animation
- Recharts for data visualization
- React Hook Form for form state
- Sonner for toast notifications
- Embla Carousel
- Vaul for drawer UI
- `cmdk` for command-style interactions
- `input-otp` for one-time-password inputs

## State Management And Client Data

- TanStack React Query for API data fetching and caching
- Zustand for local client state

## Backend And Server Logic

- Next.js App Router
- Next.js route handlers under `src/app/api`
- Server-side TypeScript modules in `src/lib`

## Database

- PostgreSQL
- Prisma ORM
- Prisma schema and migrations in `prisma/`

## Authentication And Access Control

- Supabase Auth for login and password reset flows
- Custom session/auth routes in the application
- Role-based access model for `employee`, `hr`, and `admin`

## Storage And File Handling

- Supabase Storage for:
  - employee documents
  - leave attachments
  - applicant templates
- Google Cloud Storage for applicant requirements archives
- JSZip for archive handling
- Sharp for image and asset processing support

## Maps And Location Features

- Google Maps API
- Geocoding
- Address search
- Static map generation
- Browser key endpoint for client-side map usage
- Geofence zone management

## Python Utilities

- Python 3 in the production container
- `openpyxl` for spreadsheet processing
- Python helper scripts for:
  - attendance workbook parsing
  - employment status workbook parsing
  - attendance exports
  - employee master list exports
  - leave summary exports

## Infrastructure And Deployment

- Docker multi-stage build
- Docker Compose for local PostgreSQL
- Google Cloud Build
- Google Cloud Run deployment target
- Caddy as reverse proxy for local/runtime routing

## Tooling

- ESLint 9
- `eslint-config-next`
- PostCSS
- Prisma CLI
- npm for install/build flow
- Bun lockfile present in repo

## Notable Libraries In The Project

- Zod
- date-fns
- React Markdown
- react-syntax-highlighter
- UUID
- `@dnd-kit/*`
- `@mdxeditor/editor`

## Environment-Driven External Services

The application is configured to integrate with:

- PostgreSQL
- Supabase
- Google Maps Platform
- Google Cloud Storage
- Google Cloud Run

## Notes

- The main application build and runtime flow uses npm and Node.js.
- A `bun.lock` file exists, but the checked-in Docker and package scripts use npm.
- `next-auth` is installed in `package.json`, but the current source is primarily wired around custom auth routes and Supabase-based authentication.
