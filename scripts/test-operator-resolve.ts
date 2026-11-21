/** Rule tests for src/lib/operators/resolve.ts. Run: npx tsx scripts/test-operator-resolve.ts */
import assert from 'node:assert/strict'
import { resolveOperator, listingDecision, validateRegistry, type Registry, type OperatorDef } from '../src/lib/operators/resolve'

type OpOpts = { fee?: string[]; launch?: string[]; redirect?: string[]; claims?: number[]; status?: OperatorDef['status']; listingMode?: OperatorDef['listingMode'] }
const op = (id: string, o: OpOpts): OperatorDef => ({
  id, name: id, status: 'active', listingMode: 'partner',
  feeWallets: new Set(o.fee ?? []), launcherWallets: new Set(o.launch ?? []), redirectWallets: new Set(o.redirect ?? []), claims: new Set(o.claims ?? []), ...(o.status ? { status: o.status } : {}), ...(o.listingMode ? { listingMode: o.listingMode } : {}),
})
const reg: Registry = { operators: [
  op('house', { fee: ['HOUSEFEE'], launch: ['HOUSEL'], redirect: ['CHARITY'], listingMode: 'main' }),
  op('africa', { launch: ['AFRL'], claims: [111] }),
  op('metal', { fee: ['METALFEE'], launch: ['METALL'] }),
] }
let n = 0; const t = (name: string, f: () => void) => { f(); n++; console.log('  ok  ' + name) }

t('explicit claim outranks a fee wallet that belongs to someone else', () =>
  assert.deepEqual(resolveOperator({ battleId: 111, feeWallet: 'HOUSEFEE', launcher: 'X' }, reg), { operatorId: 'africa', basis: 'explicit_claim' }))
t('fee wallet alone attributes', () =>
  assert.deepEqual(resolveOperator({ battleId: 5, feeWallet: 'METALFEE', launcher: 'STRANGER' }, reg), { operatorId: 'metal', basis: 'fee_wallet' }))
t('declared redirect needs the launcher too', () => {
  assert.deepEqual(resolveOperator({ battleId: 5, feeWallet: 'CHARITY', launcher: 'HOUSEL' }, reg), { operatorId: 'house', basis: 'declared_redirect' })
  assert.deepEqual(resolveOperator({ battleId: 5, feeWallet: 'CHARITY', launcher: 'STRANGER' }, reg), { operatorId: null, basis: 'unattributed' })
})
t('nothing matches: unattributed, never defaulted', () =>
  assert.deepEqual(resolveOperator({ battleId: 5, feeWallet: 'NOPE', launcher: null }, reg), { operatorId: null, basis: 'unattributed' }))

t('LISTING: fee wallet match with a stranger launcher is refused', () => {
  const f = { battleId: 5, feeWallet: 'METALFEE', launcher: 'STRANGER' }
  const d = listingDecision(f, resolveOperator(f, reg), reg)
  assert.equal(d.list, false); assert.match(d.reason, /launcher is not registered/)
})
t('LISTING: fee wallet match with the registered launcher is allowed', () => {
  const f = { battleId: 5, feeWallet: 'METALFEE', launcher: 'METALL' }
  assert.equal(listingDecision(f, resolveOperator(f, reg), reg).list, true)
})
t('LISTING: an explicit claim is allowed', () => {
  const f = { battleId: 111, feeWallet: 'X', launcher: 'Y' }
  assert.equal(listingDecision(f, resolveOperator(f, reg), reg).list, true)
})
t('LISTING: an operator in main or off mode never lists through the pull', () => {
  const f = { battleId: 5, feeWallet: 'HOUSEFEE', launcher: 'HOUSEL' }
  assert.equal(listingDecision(f, resolveOperator(f, reg), reg).list, false)
  const off: Registry = { operators: [op('metal', { fee: ['METALFEE'], launch: ['METALL'], listingMode: 'off' })] }
  const g = { battleId: 5, feeWallet: 'METALFEE', launcher: 'METALL' }
  assert.equal(listingDecision(g, resolveOperator(g, off), off).list, false)
})
t('LISTING: a suspended operator never lists', () => {
  const sus: Registry = { operators: [op('metal', { fee: ['METALFEE'], launch: ['METALL'], status: 'suspended' })] }
  const g = { battleId: 5, feeWallet: 'METALFEE', launcher: 'METALL' }
  assert.equal(listingDecision(g, resolveOperator(g, sus), sus).list, false)
})
t('LISTING: unattributed never lists', () => {
  const f = { battleId: 5, feeWallet: 'NOPE', launcher: 'NOPE' }
  assert.equal(listingDecision(f, resolveOperator(f, reg), reg).list, false)
})
t('registry checks: a wallet claimed twice, a battle claimed twice, a redirect with no launcher', () => {
  const bad: Registry = { operators: [op('a', { fee: ['W'], claims: [1], redirect: ['R'] }), op('b', { fee: ['W'], claims: [1], launch: ['L'] })] }
  const p = validateRegistry(bad).join(' | ')
  assert.match(p, /fee wallet W claimed by both a and b/); assert.match(p, /battle 1 claimed by both/); assert.match(p, /registers no launcher wallets/)
  assert.deepEqual(validateRegistry(reg), [])
})
console.log(`\n${n} passed`)
