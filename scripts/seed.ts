#!/usr/bin/env node
/**
 * Configuration-based seeding with separate seed directories and automatic database name resolution.
 *
 * Usage:
 *   npm run db:seed              # Local development
 *   npm run db:seed:test         # Test environment
 *   npm run db:seed:prod         # Production environment
 *   npm run db:seed -- --env=test --skip-setup  # Custom options
 *
 */

import { getPlatformProxy } from 'wrangler'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// =============================================================================
// Configuration
// =============================================================================

interface SeedEnvironmentConfig {
  /** Directory containing seed files for this environment */
  seeds: string
  /** Custom database name (optional, defaults to wrangler.jsonc value) */
  database_name?: string
  /** Wrangler CLI flags for this environment */
  flags: string
  /** Description for logging */
  description?: string
}

interface SeedConfig {
  /** Setup seeds that run before environment-specific seeds */
  setup?: {
    seeds: string
    description?: string
  }
  /** Environment-specific configurations */
  [env: string]: SeedEnvironmentConfig | any
}

const seedConfig: SeedConfig = {
  // Optional setup seeds (run first, before env-specific seeds)
  setup: {
    seeds: join(__dirname, '../database/seeds/setup'),
  },

  // Local development
  local: {
    seeds: join(__dirname, '../database/seeds/local'),
    flags: '--local',
  },

  // Test environment
  test: {
    seeds: join(__dirname, '../database/seeds/test'),
    flags: '--local --env=test',
  },

  // Production environment
  production: {
    seeds: join(__dirname, '../database/seeds/production'),
    flags: '--env=production',
  },
}

// =============================================================================
// Wrangler Configuration Reader
// =============================================================================

interface WranglerConfig {
  d1_databases?: Array<{
    binding: string
    database_name: string
    database_id: string
  }>
  env?: {
    [envName: string]: {
      d1_databases?: Array<{
        binding: string
        database_name: string
        database_id: string
      }>
    }
  }
}

/**
 * Read and parse wrangler.jsonc file
 */
function readWranglerConfig(): WranglerConfig {
  const wranglerPath = join(__dirname, '../wrangler.jsonc')

  if (!existsSync(wranglerPath)) {
    throw new Error(`wrangler.jsonc not found at ${wranglerPath}`)
  }

  const fs = require('node:fs')
  const content = fs.readFileSync(wranglerPath, 'utf-8')

  // Remove comments from JSONC
  const jsonContent = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

  return JSON.parse(jsonContent)
}

/**
 * Get database name for a specific environment from wrangler.jsonc
 */
function getDatabaseName(env: string): string {
  const config = readWranglerConfig()

  // For local/dev, use the default d1_databases
  if (env === 'local' || env === 'development') {
    return config.d1_databases?.[0]?.database_name || 'bookstore-db'
  }

  // For other environments, check env overrides
  if (config.env?.[env]?.d1_databases) {
    return config.env[env].d1_databases![0].database_name
  }

  // Fallback to default
  return config.d1_databases?.[0]?.database_name || 'bookstore-db'
}

// =============================================================================
// Command Line Argument Parsing
// =============================================================================

const args = process.argv.slice(2)
const envArg = args.find((arg) => arg.startsWith('--env='))
const skipSetup = args.includes('--skip-setup')
const env = envArg ? envArg.split('=')[1] : 'local'

// Validate environment
if (!seedConfig[env]) {
  console.error(`❌ Invalid environment: ${env}`)
  console.error(`   Valid environments: ${Object.keys(seedConfig).filter((k) => k !== 'setup').join(', ')}`)
  process.exit(1)
}

// =============================================================================
// Seed Discovery and Execution
// =============================================================================

/**
 * Get all seed files in a directory in alphabetical order
 */
function getSeedFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return []
  }

  try {
    const files = readdirSync(directory)
      .filter((file) => file.endsWith('.seed.ts'))
      .sort() // Alphabetical order: 001-, 002-, etc.

    return files.map((file) => join(directory, file))
  } catch (error) {
    console.error(`❌ Failed to read seeds directory: ${directory}`)
    return []
  }
}

/**
 * Execute a seed file
 */
async function executeSeedFile(seedPath: string, db: any) {
  const seedName = seedPath.split('/').pop()!.replace('.seed.ts', '')

  try {
    // Import the seed module
    const seedModule = await import(seedPath)
    const seedFunction = seedModule.default

    if (typeof seedFunction !== 'function') {
      throw new Error(`Seed file ${seedName} does not export a default function`)
    }

    // Run the seed function with real D1 binding
    await seedFunction(db)

    console.info(`   ✓ Completed: ${seedName}`)
  } catch (error) {
    console.error(`  X Failed: ${seedName}`)
    console.error(error)
    throw error
  }
}


/**
 * Run all seeds for an environment
 */
async function runSeeds(directory: string, db: any, label: string) {
  const seedFiles = getSeedFiles(directory)

  if (seedFiles.length === 0) {
    return
  }

  for (const seedFile of seedFiles) {
    await executeSeedFile(seedFile, db)
  }
}

// =============================================================================
// Main Function
// =============================================================================

async function main() {
  const envConfig = seedConfig[env] as SeedEnvironmentConfig
  const dbName = envConfig.database_name || getDatabaseName(env)

  console.info(`Seeding database: ${dbName} in ${env} environment`)

  // Initialize platform proxy with D1 binding
  const { env: platformEnv, dispose } = await getPlatformProxy<{ DB: any }>({
    configPath: join(__dirname, '../wrangler.jsonc'),
    environment: env === 'local' ? undefined : env,
    persist: true,
  })

  try {
    const db = platformEnv.DB

    // Step 1: Run setup seeds (if they exist and not skipped)
    if (seedConfig.setup && !skipSetup) {
      console.info(`  Running setup seeds...`)
      await runSeeds(seedConfig.setup.seeds, db, 'setup')
    }

    // Step 2: Run environment-specific seeds
    console.info(`  Running ${env} seeds...`)
    await runSeeds(envConfig.seeds, db, env)

    console.info('✓ All seeds completed successfully!')
  } finally {
    // Always cleanup platform proxy resources
    await dispose()
  }
}

// Run main function
main().catch((error) => {
  console.error('❌ Seeding failed:')
  console.error(error)
  process.exit(1)
})
