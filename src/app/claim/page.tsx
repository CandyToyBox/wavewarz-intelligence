import { permanentRedirect } from 'next/navigation'

// The working Claim tool lives at claim.wavewarz.info. Keep old /claim links and bookmarks pointing there.
export default function ClaimPage() {
  permanentRedirect('https://claim.wavewarz.info')
}
