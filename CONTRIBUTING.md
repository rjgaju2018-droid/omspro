# Contributing to OMS Pro

Thank you for your interest in contributing to OMS Pro!

OMS Pro is proprietary software — all rights belong to the owner
(Gajanand Bhankariwal, bhankariwal@gmail.com). External contributions are
welcomed at the owner's discretion; by opening a pull request you agree the
contribution may be incorporated into the proprietary product.

## How Can I Contribute?

* **Reporting Bugs:** Create an issue detailing the bug, reproduction steps, and expected behavior.
* **Suggesting Enhancements:** Open an issue to propose new features or improvements for order tracking and inventory management.
* **Pull Requests:**
  1. Fork the repo and create your branch from `main`.
  2. Write clean, tested code following the project standards.
  3. Submit a Pull Request with a clear description of your changes.

## Development Setup

- **Stack**: Next.js 16 (App Router, Server Actions, TypeScript) + Supabase (Postgres, Auth, Storage) + Tailwind.
- `npm ci` to install, `npm run dev` to develop.
- Database schema changes go in a dated `db/*.sql` migration plus `db/schema.sql`; regenerate types with `scripts/gen-types.mjs`.
- Run `npx tsc --noEmit` and `npx eslint` on changed files before opening a PR.

## Questions?

bhankariwal@gmail.com · +91 99830 00552
