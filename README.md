# ncomplo2-api

REST API for the World Cup 2026 predictions app. Built with Node.js, Express and PostgreSQL.

## Stack

- **Runtime**: Node.js (ESM)
- **Framework**: Express 4
- **Database**: PostgreSQL (via `pg`)
- **Auth**: JWT access tokens (15 min) + refresh tokens (7 days) in httpOnly cookies
- **Security**: bcrypt password hashing, rate limiting on auth endpoints

## Getting started

```bash
npm install
cp .env.example .env   # fill in the values
npm run dev
```

### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `CLIENT_ORIGIN` | Frontend origin for CORS (e.g. `https://ncomplo.com`) |
| `NODE_ENV` | Set to `production` to enable secure cookies |
| `PORT` | Server port (default 3000) |

## Project structure

```
src/
├── app.js                  # Express app setup
├── server.js               # Entry point
├── controllers/            # Route handlers
├── middleware/
│   ├── auth.js             # requireAuth / requireAdmin
│   ├── cors.js             # CORS config
│   └── rateLimiter.js      # Rate limiting for auth endpoints
├── routes/                 # Express routers
├── services/               # Business logic (scoring, standings)
└── db/
    ├── pool.js             # PostgreSQL connection pool
    ├── schema.sql          # Full database schema
    ├── migrations/         # Incremental migrations
    └── seeds/              # Seed data (teams, matches, slots)
```

## API endpoints

### Auth — `/auth`
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Register (email whitelist required) |
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Get current user |

### Matches — `/matches`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/matches` | — | All matches (group or knockout via `?phase=`) |
| GET | `/matches/today` | — | Today's matches, or next upcoming if none |
| GET | `/matches/next` | — | Next single upcoming match |

### Predictions — `/predictions`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/predictions` | ✓ | My group predictions |
| PUT | `/predictions/bulk` | ✓ | Save multiple predictions |

### Bracket — `/bracket`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/bracket` | ✓ | My bracket picks + slot structure |
| GET | `/bracket/qualifiers` | ✓ | Computed group qualifiers |
| POST | `/bracket` | ✓ | Save bracket picks |

### Leaderboard — `/leaderboard`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/leaderboard` | ✓ | Ranked user standings |

### Users — `/users`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users/:userId/predictions/today` | ✓ | Another user's today predictions (locked only) |
| GET | `/users/:userId/predictions` | ✓ | Another user's all group predictions (locked only) |
| GET | `/users/:userId/bracket` | ✓ | Another user's bracket picks (locked only) |

### Tournament — `/tournament`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/tournament/settings` | — | `predictions_locked`, `group_stage_locked` flags |

### Admin — `/admin`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/admin/results` | ✓ Admin | Set match results |
| POST | `/admin/lock` | ✓ Admin | Lock/unlock predictions |
| GET | `/admin/users` | ✓ Admin | List all users |

## Database

Run `src/db/schema.sql` to create all tables, then the files in `src/db/seeds/` to populate teams, group matches and knockout slots. Apply migrations in `src/db/migrations/` in order.

Key tables: `users`, `group_matches`, `predictions`, `predicted_bracket`, `knockout_slots`, `real_bracket`, `leaderboard` (view), `tournament_settings`.

## Auth flow

1. Login → server sets `access_token` (15 min) and `refresh_token` (7 days) as httpOnly cookies.
2. Requests include cookies automatically (`credentials: 'include'`).
3. On 401, the frontend retries once after calling `/auth/refresh`.
4. Refresh tokens are stored hashed in the database and rotated on each use.
