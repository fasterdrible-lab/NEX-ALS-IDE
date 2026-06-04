import fs from 'fs'
import path from 'path'

const TEST_DB_DIR = path.join(__dirname, '.test-db')

export default function globalSetup(): void {
  // Wipe test databases from previous runs so each run starts clean
  if (fs.existsSync(TEST_DB_DIR)) {
    fs.rmSync(TEST_DB_DIR, { recursive: true, force: true })
  }
  fs.mkdirSync(TEST_DB_DIR, { recursive: true })
}
