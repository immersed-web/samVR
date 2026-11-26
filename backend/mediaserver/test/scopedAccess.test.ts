// Run without Docker:  node --import tsx --test test/scopedAccess.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scopedAccessLevel, type ScopedResource } from '../src/modules/scopedAccess.ts';

const ORG = 'org-1';
const UNIT = 'unit-1';
const res = (over: Partial<ScopedResource> = {}): ScopedResource => ({
  ownerUserId: 'owner', visibility: 'private', organizationId: ORG, unitId: UNIT, ...over,
});

test('personal resource: membership gives nothing', () => {
  const r = res({ organizationId: null, unitId: null, visibility: 'organization' });
  assert.equal(scopedAccessLevel({ userId: 'u', resource: r, membership: { orgRole: 'org_admin' } }), undefined);
});

test('org_admin administers everything in the organization, including every unit', () => {
  for (const unitId of [UNIT, null]) {
    assert.equal(scopedAccessLevel({ userId: 'u', resource: res({ unitId }), membership: { orgRole: 'org_admin' } }), 'admin');
  }
});

test('unit_admin administers only their own unit', () => {
  assert.equal(scopedAccessLevel({ userId: 'u', resource: res(), membership: { orgRole: 'member', unitRole: 'unit_admin' } }), 'admin');
  // membership passed in is for the resource's own unit; a member of another unit has no unitRole here
  assert.equal(scopedAccessLevel({ userId: 'u', resource: res(), membership: { orgRole: 'member', unitRole: null } }), undefined);
});

test('unit_admin role does not leak to organization-level resources', () => {
  assert.equal(scopedAccessLevel({ userId: 'u', resource: res({ unitId: null }), membership: { orgRole: 'member', unitRole: 'unit_admin' } }), undefined);
});

test("visibility 'unit': only unit members can view", () => {
  const r = res({ visibility: 'unit' });
  assert.equal(scopedAccessLevel({ userId: 'u', resource: r, membership: { orgRole: 'member', unitRole: 'member' } }), 'view');
  assert.equal(scopedAccessLevel({ userId: 'u', resource: r, membership: { orgRole: 'member', unitRole: null } }), undefined);
  assert.equal(scopedAccessLevel({ userId: 'u', resource: r, membership: {} }), undefined);
});

test("visibility 'organization': any organization member can view, outsiders cannot", () => {
  const r = res({ visibility: 'organization' });
  assert.equal(scopedAccessLevel({ userId: 'u', resource: r, membership: { orgRole: 'member' } }), 'view');
  assert.equal(scopedAccessLevel({ userId: 'u', resource: r, membership: {} }), undefined);
});

test("visibility 'private' in an organization: plain members get nothing", () => {
  assert.equal(scopedAccessLevel({ userId: 'u', resource: res(), membership: { orgRole: 'member', unitRole: 'member' } }), undefined);
});

test('owner keeps ownership only while still a member', () => {
  assert.equal(scopedAccessLevel({ userId: 'owner', resource: res(), membership: { orgRole: 'member', unitRole: 'member' } }), 'owner');
  assert.equal(scopedAccessLevel({ userId: 'owner', resource: res(), membership: {} }), undefined);
  assert.equal(scopedAccessLevel({ userId: 'owner', resource: res({ unitId: null }), membership: { orgRole: 'member' } }), 'owner');
});

test('unknown visibility fails closed', () => {
  assert.equal(scopedAccessLevel({ userId: 'u', resource: res({ visibility: 'whatever' }), membership: { orgRole: 'member', unitRole: 'member' } }), undefined);
});
