import { ChangelogBanner } from '@/components/changelog-banner'
import { Chat } from '@/components/chat'

export default async function Page() {
  return (
    <>
      <Chat />
      <ChangelogBanner />
    </>
  )
}
