import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 20000,       // close idle connections after 20s (before Neon kills them)
  connectionTimeoutMillis: 10000, // fail fast if can't connect in 10s
})

pool.on('error', (err) => {
  console.error('Unexpected DB pool error', err)
})

export default pool
