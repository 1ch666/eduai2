// Phase 3: private study groups with revocable invite codes.
// One global Groups DO stores all groups, memberships and invite codes.
// A member who leaves immediately loses read access to group data.
// The group owner can kick members and revoke invite codes.
// Owner leaving dissolves the group and removes all data.
import { DurableObject } from 'cloudflare:workers';
import type { AppEnv } from './env';
import { readJsonObject, type Responder } from './http';
import { resolveSession, csrfTokenMatches } from './session';

const MAX_GROUPS_PER_USER = 10;
const MAX_MEMBERS_PER_GROUP = 50;
const MAX_GROUP_NAME = 40;

type GroupRow  = { id: string; name: string; owner_id: string; created_at: string };
type MemberRow = { group_id: string; user_id: string; display_name: string; joined_at: string };
type InviteRow = { code: string; group_id: string; created_by: string; created_at: string; revoked: number };

export class Groups extends DurableObject<AppEnv> {
  constructor(ctx: DurableObjectState, env: AppEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS groups (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          owner_id   TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS members (
          group_id     TEXT NOT NULL,
          user_id      TEXT NOT NULL,
          display_name TEXT NOT NULL,
          joined_at    TEXT NOT NULL,
          PRIMARY KEY (group_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS members_user ON members(user_id);
        CREATE TABLE IF NOT EXISTS invite_codes (
          code       TEXT PRIMARY KEY,
          group_id   TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          revoked    INTEGER NOT NULL DEFAULT 0
        );
      `);
    });
  }

  isMember(groupId: string, userId: string): boolean {
    return this.ctx.storage.sql.exec<{ n: number }>(
      'SELECT COUNT(*) AS n FROM members WHERE group_id=? AND user_id=?', groupId, userId).one().n > 0;
  }

  isOwner(groupId: string, userId: string): boolean {
    const g = this.ctx.storage.sql.exec<{ owner_id: string }>(
      'SELECT owner_id FROM groups WHERE id=?', groupId).toArray()[0];
    return g?.owner_id === userId;
  }

  groupCountForUser(userId: string): number {
    return this.ctx.storage.sql.exec<{ n: number }>(
      'SELECT COUNT(*) AS n FROM members WHERE user_id=?', userId).one().n;
  }

  groupsForUser(userId: string): GroupRow[] {
    return this.ctx.storage.sql.exec<GroupRow>(
      `SELECT g.* FROM groups g INNER JOIN members m ON g.id=m.group_id
       WHERE m.user_id=? ORDER BY g.created_at DESC LIMIT 20`, userId).toArray();
  }

  getGroup(groupId: string): GroupRow | null {
    return this.ctx.storage.sql.exec<GroupRow>(
      'SELECT * FROM groups WHERE id=?', groupId).toArray()[0] ?? null;
  }

  getMembers(groupId: string): MemberRow[] {
    return this.ctx.storage.sql.exec<MemberRow>(
      'SELECT * FROM members WHERE group_id=? ORDER BY joined_at', groupId).toArray();
  }

  memberCount(groupId: string): number {
    return this.ctx.storage.sql.exec<{ n: number }>(
      'SELECT COUNT(*) AS n FROM members WHERE group_id=?', groupId).one().n;
  }

  createGroup(id: string, name: string, ownerId: string, displayName: string): boolean {
    if (this.groupCountForUser(ownerId) >= MAX_GROUPS_PER_USER) return false;
    const now = new Date().toISOString();
    this.ctx.storage.sql.exec('INSERT INTO groups VALUES(?,?,?,?)', id, name, ownerId, now);
    this.ctx.storage.sql.exec('INSERT INTO members VALUES(?,?,?,?)', id, ownerId, displayName, now);
    return true;
  }

  createInvite(code: string, groupId: string, createdBy: string): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO invite_codes VALUES(?,?,?,?,0)', code, groupId, createdBy, new Date().toISOString());
  }

  revokeInvite(code: string, groupId: string, requestedBy: string): boolean {
    const inv = this.ctx.storage.sql.exec<InviteRow>(
      'SELECT * FROM invite_codes WHERE code=? AND group_id=?', code, groupId).toArray()[0];
    if (!inv || inv.created_by !== requestedBy) return false;
    this.ctx.storage.sql.exec('UPDATE invite_codes SET revoked=1 WHERE code=?', code);
    return true;
  }

  listInvites(groupId: string): InviteRow[] {
    return this.ctx.storage.sql.exec<InviteRow>(
      'SELECT * FROM invite_codes WHERE group_id=? AND revoked=0 ORDER BY created_at DESC', groupId).toArray();
  }

  joinByCode(code: string, userId: string, displayName: string): { ok: true; groupId: string } | { ok: false; error: string } {
    const inv = this.ctx.storage.sql.exec<InviteRow>(
      'SELECT * FROM invite_codes WHERE code=? AND revoked=0', code).toArray()[0];
    if (!inv) return { ok: false, error: '邀請碼無效或已撤銷' };
    if (this.isMember(inv.group_id, userId)) return { ok: false, error: '你已經是此群組成員' };
    if (this.memberCount(inv.group_id) >= MAX_MEMBERS_PER_GROUP) return { ok: false, error: '群組人數已達上限（50 人）' };
    if (this.groupCountForUser(userId) >= MAX_GROUPS_PER_USER) return { ok: false, error: `你已加入的群組數達到上限（${MAX_GROUPS_PER_USER} 個）` };
    this.ctx.storage.sql.exec(
      'INSERT INTO members VALUES(?,?,?,?)', inv.group_id, userId, displayName, new Date().toISOString());
    return { ok: true, groupId: inv.group_id };
  }

  leave(groupId: string, userId: string): { ok: true; groupDeleted: boolean } | { ok: false; error: string } {
    if (!this.isMember(groupId, userId)) return { ok: false, error: '你不是此群組成員' };
    const group = this.getGroup(groupId);
    if (!group) return { ok: false, error: '群組不存在' };
    if (group.owner_id === userId) {
      // Owner leaving dissolves the group entirely.
      this.ctx.storage.sql.exec('DELETE FROM members WHERE group_id=?', groupId);
      this.ctx.storage.sql.exec('DELETE FROM invite_codes WHERE group_id=?', groupId);
      this.ctx.storage.sql.exec('DELETE FROM groups WHERE id=?', groupId);
      return { ok: true, groupDeleted: true };
    }
    this.ctx.storage.sql.exec('DELETE FROM members WHERE group_id=? AND user_id=?', groupId, userId);
    return { ok: true, groupDeleted: false };
  }

  kickMember(groupId: string, targetUserId: string, requestedBy: string): { ok: true } | { ok: false; error: string } {
    if (!this.isOwner(groupId, requestedBy)) return { ok: false, error: '只有群主才能移除成員' };
    if (targetUserId === requestedBy) return { ok: false, error: '群主不能移除自己，如需解散群組請使用退出群組' };
    if (!this.isMember(groupId, targetUserId)) return { ok: false, error: '此使用者不是群組成員' };
    this.ctx.storage.sql.exec('DELETE FROM members WHERE group_id=? AND user_id=?', groupId, targetUserId);
    return { ok: true };
  }
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

export async function handleGroups(
  request: Request, env: AppEnv, respond: Responder, trustedOrigin?: string
): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const session = await resolveSession(request, env);
  if (!session) return respond({ error: '請登入才能使用群組功能' }, 401);

  const db = env.GROUPS.get(env.GROUPS.idFromName('global'));

  // GET /api/groups — list my groups
  if (pathname === '/api/groups' && request.method === 'GET') {
    const groups = await db.groupsForUser(session.user.id);
    return respond({ groups });
  }

  // POST /api/groups — create new group
  if (pathname === '/api/groups' && request.method === 'POST') {
    if (!trustedOrigin || !csrfTokenMatches(request, session)) return respond({ error: '請重新登入後再試' }, 403);
    const body = await readJsonObject(request, 256, respond, '資料過長');
    if (body.error) return body.error;
    const name = typeof body.value.name === 'string' ? body.value.name.trim() : '';
    if (!name || name.length > MAX_GROUP_NAME) return respond({ error: `群組名稱需為 1–${MAX_GROUP_NAME} 個字` }, 400);
    const id = crypto.randomUUID();
    const ok = await db.createGroup(id, name, session.user.id, session.user.displayName);
    if (!ok) return respond({ error: `最多可加入 ${MAX_GROUPS_PER_USER} 個群組` }, 409);
    return respond({ groupId: id, name }, 201);
  }

  // POST /api/groups/join — join with invite code
  if (pathname === '/api/groups/join' && request.method === 'POST') {
    if (!trustedOrigin || !csrfTokenMatches(request, session)) return respond({ error: '請重新登入後再試' }, 403);
    const body = await readJsonObject(request, 128, respond, '資料過長');
    if (body.error) return body.error;
    const code = typeof body.value.code === 'string' ? body.value.code.trim().toUpperCase() : '';
    if (!code) return respond({ error: '請提供邀請碼' }, 400);
    const result = await db.joinByCode(code, session.user.id, session.user.displayName);
    if (!result.ok) return respond({ error: result.error }, 409);
    return respond({ groupId: result.groupId });
  }

  // Group-specific routes: /api/groups/:uuid[/...]
  const groupMatch = pathname.match(/^\/api\/groups\/([0-9a-f-]{36})(\/.*)?$/);
  if (!groupMatch) return respond({ error: '找不到端點' }, 404);
  const groupId = groupMatch[1];
  const sub = groupMatch[2] ?? '';

  // GET /api/groups/:id — group info + members (membership required)
  if (sub === '' && request.method === 'GET') {
    if (!await db.isMember(groupId, session.user.id)) return respond({ error: '你不是此群組成員' }, 403);
    const group = await db.getGroup(groupId);
    if (!group) return respond({ error: '群組不存在' }, 404);
    const members = await db.getMembers(groupId);
    const isOwner = group.owner_id === session.user.id;
    const invites = isOwner ? await db.listInvites(groupId) : null;
    return respond({
      group: { id: group.id, name: group.name, isOwner, memberCount: members.length },
      members: members.map(m => ({ userId: m.user_id, displayName: m.display_name, joinedAt: m.joined_at, isOwner: m.user_id === group.owner_id })),
      invites,
    });
  }

  // DELETE /api/groups/:id/leave
  if (sub === '/leave' && request.method === 'DELETE') {
    if (!trustedOrigin || !csrfTokenMatches(request, session)) return respond({ error: '請重新登入後再試' }, 403);
    const result = await db.leave(groupId, session.user.id);
    if (!result.ok) return respond({ error: result.error }, 409);
    return respond(result);
  }

  // POST /api/groups/:id/invite — generate invite code (owner only)
  if (sub === '/invite' && request.method === 'POST') {
    if (!trustedOrigin || !csrfTokenMatches(request, session)) return respond({ error: '請重新登入後再試' }, 403);
    if (!await db.isOwner(groupId, session.user.id)) return respond({ error: '只有群主才能產生邀請碼' }, 403);
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const code = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    await db.createInvite(code, groupId, session.user.id);
    return respond({ code }, 201);
  }

  // DELETE /api/groups/:id/invite/:code — revoke invite code (owner only)
  const revokeMatch = sub.match(/^\/invite\/([0-9A-F]{8})$/);
  if (revokeMatch && request.method === 'DELETE') {
    if (!trustedOrigin || !csrfTokenMatches(request, session)) return respond({ error: '請重新登入後再試' }, 403);
    const ok = await db.revokeInvite(revokeMatch[1], groupId, session.user.id);
    return ok ? respond({ revoked: true }) : respond({ error: '邀請碼不存在或無權撤銷' }, 403);
  }

  // DELETE /api/groups/:id/members/:userId — kick member (owner only)
  const kickMatch = sub.match(/^\/members\/([0-9a-f-]{36})$/);
  if (kickMatch && request.method === 'DELETE') {
    if (!trustedOrigin || !csrfTokenMatches(request, session)) return respond({ error: '請重新登入後再試' }, 403);
    const result = await db.kickMember(groupId, kickMatch[1], session.user.id);
    return result.ok ? respond({ removed: true }) : respond({ error: result.error }, 403);
  }

  // GET /api/groups/:id/leaderboard — group leaderboard (membership required)
  if (sub === '/leaderboard' && request.method === 'GET') {
    if (!await db.isMember(groupId, session.user.id)) return respond({ error: '你不是此群組成員' }, 403);
    const members = await db.getMembers(groupId);
    const rankings = env.RANKINGS.get(env.RANKINGS.idFromName('global'));
    const rows = await rankings.forUsers(members.map(m => m.user_id));
    const weekly = url.searchParams.get('weekly') === '1';
    const board = members.map(m => {
      const r = rows.find(r => r.user_id === m.user_id);
      return {
        userId: m.user_id,
        displayName: m.display_name,
        isOwner: m.user_id === (members[0]?.group_id ? undefined : m.user_id), // resolved below
        score:   weekly ? (r?.week_score   ?? 0) : (r?.score   ?? 0),
        correct: weekly ? (r?.week_correct ?? 0) : (r?.correct ?? 0),
        attempts:weekly ? (r?.week_attempts?? 0) : (r?.attempts?? 0),
      };
    }).sort((a, b) => b.score - a.score || b.correct - a.correct)
      .map((m, i) => ({ ...m, rank: i + 1 }));
    const group = await db.getGroup(groupId);
    return respond({ leaderboard: board.map(m => ({ ...m, isOwner: m.userId === group?.owner_id })) });
  }

  return respond({ error: '找不到端點' }, 404);
}
