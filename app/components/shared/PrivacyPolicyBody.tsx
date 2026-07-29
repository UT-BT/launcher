import { PRIVACY_POLICY } from '@/app/constants/legal'
import { MarkdownBody } from '@/app/components/shared/MarkdownBody'

export function PrivacyPolicyBody({ className }: { className?: string }) {
  return <MarkdownBody className={className}>{PRIVACY_POLICY}</MarkdownBody>
}
