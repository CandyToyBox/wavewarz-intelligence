/**
 * Operator attribution: which arena ran a battle.
 *
 * A faithful port of the resolution rules in the protocol repo's
 * spec/operators.json (tools/resolve-operator.py). The inputs are chain facts
 * (the battle's fee wallet at offset 100 and launcher at offset 257), never
 * anything a caller supplies. Rules, in order:
 *
 *   0. explicit_claim     the battle id is claimed by an operator
 *   1. fee_wallet         the fee wallet is one an operator collects at
 *   2. declared_redirect  the fee wallet is a destination an operator declares it
 *                         routes its cut to AND the launcher is one of that operator's
 *   otherwise             unattributed (never defaulted to the largest operator)
 *
 * Attribution and LISTING are different questions. Rule 1 is right for
 * attribution (only the operator controls its own fee wallet). A partner listing
 * is a public page under an operator's name, and a stranger can point any battle's
 * fee wallet at somebody else's address, so listing needs the stronger test:
 * see listingDecision().
 */

export type Basis = 'explicit_claim' | 'fee_wallet' | 'declared_redirect' | 'unattributed'
export type ListingMode = 'off' | 'main' | 'partner'

export interface OperatorDef {
  id: string
  name: string
  status: 'active' | 'suspended'
  listingMode: ListingMode
  feeWallets: Set<string>
  launcherWallets: Set<string>
  redirectWallets: Set<string>
  claims: Set<number>
}
export interface Registry { operators: OperatorDef[] }
export interface BattleFacts { battleId: number; feeWallet: string | null; launcher: string | null }
export interface Match { operatorId: string | null; basis: Basis }

export function resolveOperator(b: BattleFacts, reg: Registry): Match {
  for (const op of reg.operators) if (op.claims.has(b.battleId)) return { operatorId: op.id, basis: 'explicit_claim' }
  if (b.feeWallet) for (const op of reg.operators) if (op.feeWallets.has(b.feeWallet)) return { operatorId: op.id, basis: 'fee_wallet' }
  if (b.feeWallet && b.launcher) {
    for (const op of reg.operators) {
      if (op.redirectWallets.has(b.feeWallet) && op.launcherWallets.has(b.launcher)) return { operatorId: op.id, basis: 'declared_redirect' }
    }
  }
  return { operatorId: null, basis: 'unattributed' }
}

export interface ListingDecision { list: boolean; reason: string }

/**
 * May this battle be listed under the operator it was attributed to?
 * Yes only when the operator is active and in 'partner' mode, and the evidence is
 * an explicit claim, a declared redirect (which already needs the launcher), or a
 * fee wallet match WITH a registered launcher.
 */
export function listingDecision(b: BattleFacts, m: Match, reg: Registry): ListingDecision {
  if (!m.operatorId) return { list: false, reason: 'no operator matches this fee wallet or launcher' }
  const op = reg.operators.find(o => o.id === m.operatorId)
  if (!op) return { list: false, reason: 'operator not in the registry' }
  if (op.status !== 'active') return { list: false, reason: `operator ${op.id} is ${op.status}` }
  if (op.listingMode !== 'partner') return { list: false, reason: `operator ${op.id} listing mode is ${op.listingMode}` }
  if (m.basis === 'explicit_claim' || m.basis === 'declared_redirect') return { list: true, reason: m.basis }
  if (m.basis === 'fee_wallet') {
    return b.launcher && op.launcherWallets.has(b.launcher)
      ? { list: true, reason: 'fee_wallet and registered launcher' }
      : { list: false, reason: `fee wallet matches ${op.id} but the launcher is not registered to it` }
  }
  return { list: false, reason: 'unattributed' }
}

/** Refuse an ambiguous registry (the same checks as the protocol repo's resolver). */
export function validateRegistry(reg: Registry): string[] {
  const problems: string[] = []
  const fee = new Map<string, string>(), redirect = new Map<string, string>(), claim = new Map<number, string>()
  for (const op of reg.operators) {
    for (const w of op.feeWallets) { if (fee.has(w)) problems.push(`fee wallet ${w} claimed by both ${fee.get(w)} and ${op.id}`); fee.set(w, op.id) }
    for (const w of op.redirectWallets) {
      if (redirect.has(w)) problems.push(`redirect ${w} claimed by both ${redirect.get(w)} and ${op.id}`)
      redirect.set(w, op.id)
      if (!op.launcherWallets.size) problems.push(`${op.id} declares redirect ${w} but registers no launcher wallets, so rule 2 can never match`)
    }
    for (const c of op.claims) { if (claim.has(c)) problems.push(`battle ${c} claimed by both ${claim.get(c)} and ${op.id}`); claim.set(c, op.id) }
  }
  for (const w of fee.keys()) if (redirect.has(w)) problems.push(`${w} is registered as both a fee wallet and a redirect destination`)
  return problems
}

type OpRow = { operator_id: string; name: string; status: string; listing_mode: string }
type WalletRow = { operator_id: string; wallet: string; kind: string }
type ClaimRow = { operator_id: string; battle_id: number | string }

export function registryFromRows(ops: OpRow[], wallets: WalletRow[], claims: ClaimRow[]): Registry {
  const byId = new Map<string, OperatorDef>()
  for (const o of ops) byId.set(o.operator_id, {
    id: o.operator_id, name: o.name,
    status: o.status === 'suspended' ? 'suspended' : 'active',
    listingMode: (['off', 'main', 'partner'].includes(o.listing_mode) ? o.listing_mode : 'off') as ListingMode,
    feeWallets: new Set(), launcherWallets: new Set(), redirectWallets: new Set(), claims: new Set(),
  })
  for (const w of wallets) {
    const op = byId.get(w.operator_id); if (!op) continue
    if (w.kind === 'fee') op.feeWallets.add(w.wallet)
    else if (w.kind === 'launcher') op.launcherWallets.add(w.wallet)
    else if (w.kind === 'redirect') op.redirectWallets.add(w.wallet)
  }
  for (const c of claims) byId.get(c.operator_id)?.claims.add(Number(c.battle_id))
  return { operators: [...byId.values()] }
}
