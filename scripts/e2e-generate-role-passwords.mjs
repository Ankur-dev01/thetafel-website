// One-off helper for the e2e role accounts (BATCH-4 D8.4). Writes random
// 24-char passwords for the manager / service / kitchen test accounts into
// .env.local (gitignored) and, with --rotate-owner, replaces
// E2E_DASHBOARD_PASSWORD. Values are NEVER printed.
//
//   node scripts/e2e-generate-role-passwords.mjs [--rotate-owner]

import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = '.env.local'
const rotateOwner = process.argv.includes('--rotate-owner')
let env = readFileSync(FILE, 'utf8')
const eol = env.includes('\r\n') ? '\r\n' : '\n'

const newPassword = () => randomBytes(18).toString('base64url') // 24 chars
const has = (key) => new RegExp(`^${key}=.+$`, 'm').test(env)
const set = (key, value) => {
  const re = new RegExp(`^${key}=.*$`, 'm')
  env = re.test(env) ? env.replace(re, `${key}=${value}`) : env.replace(/\s*$/, eol) + `${key}=${value}${eol}`
}

const added = []
for (const role of ['MANAGER', 'SERVICE', 'KITCHEN']) {
  if (!has(`E2E_${role}_EMAIL`)) set(`E2E_${role}_EMAIL`, `e2e-${role.toLowerCase()}@e2e.thetafel.invalid`)
  if (!has(`E2E_${role}_PASSWORD`)) {
    set(`E2E_${role}_PASSWORD`, newPassword())
    added.push(`E2E_${role}_PASSWORD`)
  }
}
if (rotateOwner) {
  set('E2E_DASHBOARD_PASSWORD', newPassword())
  added.push('E2E_DASHBOARD_PASSWORD (rotated)')
}

writeFileSync(FILE, env)
console.log('updated .env.local keys:', added.length ? added.join(', ') : '(none — already present)')
