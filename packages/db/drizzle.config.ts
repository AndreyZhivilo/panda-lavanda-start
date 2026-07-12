import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    // Drizzle reads this from the environment when running migrations.
    url: process.env.DATABASE_URL!,
  },
})
