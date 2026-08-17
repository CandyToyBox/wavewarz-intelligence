'use client'

import { useEffect } from 'react'

/**
 * Captures X Ads' `twclid` click-id query param from landing URLs and stashes it
 * in sessionStorage, so a later outbound conversion click (see outbound-link.tsx)
 * can attribute back to the ad that brought the visitor in.
 */
export function AdClickCapture() {
  useEffect(() => {
    const twclid = new URLSearchParams(window.location.search).get('twclid')
    if (!twclid) return
    try {
      sessionStorage.setItem('twclid', twclid)
    } catch {
      // sessionStorage unavailable — nothing to do
    }
  }, [])
  return null
}
