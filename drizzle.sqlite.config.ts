import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

config()

export default defineConfig({
  dialect: 'sqlite',
  schema: './db/schema.sqlite.ts',
  out: './migrations',
  dbCredentials: {
    url: './tibetan_translation.db'
  }
})