import 'dotenv/config'

import { enhanceWithRag } from '@/lib/actions/chat'

const query = process.argv.slice(2).join(' ') || 'all about S5 site'

async function main() {
  const result = await enhanceWithRag(query)
  console.log(JSON.stringify(result, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
