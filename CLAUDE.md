# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (uses tsx, hot-reloads `src/index.ts`)
- **Build:** `npm run build` (runs `tsc`, outputs to `dist/`)
- **Start production:** `npm run start` (runs `node dist/index.js`)
- No test runner configured; test files in `src/test/` are standalone scripts

## Environment Variables

Required: `LASTFM_API_KEY`, `GEMINI_API_KEY` (or `GOOGLE_AI_API_KEY`)
Optional: `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` (for artist link enrichment), `PORT` (default 3000), `GEMINI_MODEL`, `RECOMMEND_ARTISTS_LIMIT`, `SPOTIFY_SKIP_ENRICHMENT`, `SPOTIFY_REQUESTS_PER_SECOND`

## Architecture

This is a **music recommendation API** built with Express 5 + TypeScript (NodeNext modules). A single endpoint `POST /api/music/recommend` accepts either a free-text `message` (parsed by Gemini into structured input) or explicit `artists`/`tags` arrays.

### Request Flow

1. **Routes** (`src/http/routes.ts`) — validates input; if `message` is provided, calls Gemini to extract artists/tags
2. **Query Mode** (`src/core/services/query-mode.service.ts`) — classifies input into one of four modes: `single`, `intersection`, `by-tags`, `artist+tags`
3. **Resolve Query** (`src/core/services/resolve-query.service.ts`) — orchestrates the full pipeline per mode
4. **Signal Collection** (`src/core/services/signals.service.ts`) — for each input artist, fetches similar artists + tags from Last.fm and MusicBrainz in parallel
5. **Recommendation Building** (`src/core/services/recommend.service.ts`) — merges artist signals, expands tag signals via Last.fm, deduplicates, scores, and ranks
6. **Spotify Enrichment** — optionally adds Spotify URLs to results via a rate-limited queue

### Key Concepts

- **MusicSignal** (`src/core/models/music-signal.model.ts`) — the core data type: `{source, kind, value, weight}`. Everything (similar artists, tags) is normalized into signals before scoring.
- **Four query modes** determine how signals are combined: single artist lookup, intersection of multiple artists' similar sets, tag-only search, or mixed artist+tags.
- **Tag expansion** (`src/core/services/tag-expand.service.ts`) — converts tag signals into artist signals by querying Last.fm `tag.getTopArtists`. For compound era+genre tags (e.g. "80s synthpop"), falls back to splitting and intersecting if the compound tag returns few results.

### External APIs

- **Last.fm** (`src/core/providers/lastfm.provider.ts`) — primary data source. Has in-memory cache (24h TTL) and rate limiter.
- **MusicBrainz** (`src/core/providers/musicbrainz.provider.ts`) — supplementary tags. Rate-limited, failures are non-fatal.
- **Spotify** (`src/core/providers/spotify.provider.ts`) — enrichment only (artist URLs). Uses a serial queue with 429 backoff; if rate-limited, gracefully returns results without links.
- **Gemini** (`src/core/services/query-from-message.service.ts`) — NLP parsing of free-text messages into `{artists, tags}`.

### Code Conventions

- Comments and Gemini prompts are in Russian
- All external API calls go through provider files in `src/core/providers/`
- Adapters in `src/core/adapters/` transform provider responses into `MusicSignal[]`
