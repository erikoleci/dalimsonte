// ============ "SHKOJMË BASHKË" — GROUP VOTE ============
// POST { action: 'create', eventIds: [2–3 ids], title? }        -> { id }
// POST { action: 'get',    id, voterToken? }                    -> { poll, events, results, mine }
// POST { action: 'vote',   id, eventId, voterToken, name? }     -> same as get
//
// Voters are identified by a random token kept in their browser (hashed here),
// so friends on the same Wi-Fi each get their own vote. IP rate limits stop spam.

import crypto from 'crypto';
import { cleanString, enforceRateLimit, getClientIp, rateLimit, requirePost, sb } from './_lib/security.js';
import { toAppEvent } from './_lib/events.js';

const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const POLL_RE = /^[A-Za-z0-9_-]{6,16}$/;
const TOKEN_RE = /^[A-Za-z0-9-]{16,64}$/;

function voterHash(token, pollId) {
  return crypto.createHash('sha256').update(`${pollId}:${token}`).digest('base64url').slice(0, 24);
}

async function loadPoll(id, voterToken) {
  const rows = await sb(`polls?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  const poll = Array.isArray(rows) ? rows[0] : null;
  if (!poll) return null;
  const ids = (poll.event_ids || []).filter((x) => ID_RE.test(x));
  const events = ids.length ? await sb(`events?select=*&status=eq.approved&id=in.(${ids.join(',')})`) : [];
  const votes = (await sb(`poll_votes?select=event_id,name,voter&poll_id=eq.${encodeURIComponent(id)}&order=created_at.asc`)) || [];
  const results = {};
  for (const eid of ids) results[eid] = { count: 0, names: [] };
  for (const v of votes) {
    if (!results[v.event_id]) continue;
    results[v.event_id].count++;
    if (v.name && results[v.event_id].names.length < 12) results[v.event_id].names.push(v.name);
  }
  const me = voterToken && TOKEN_RE.test(voterToken) ? voterHash(voterToken, id) : null;
  const mine = me ? votes.find((v) => v.voter === me)?.event_id || null : null;
  // keep the order chosen by the creator
  const byId = Object.fromEntries((events || []).map((e) => [e.id, toAppEvent(e)]));
  return {
    poll: { id: poll.id, title: poll.title || '', createdAt: poll.created_at },
    events: ids.map((x) => byId[x]).filter(Boolean),
    results,
    total: votes.length,
    mine,
  };
}

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  if (!(await enforceRateLimit(req, res, { windowMs: 60 * 1000, max: 60, bucket: 'poll' }))) return;

  try {
    const { action, id, eventIds, title, eventId, voterToken, name } = req.body || {};

    if (action === 'create') {
      const { allowed } = await rateLimit(`poll-create:${getClientIp(req)}`, { windowMs: 3600 * 1000, max: 20 });
      if (!allowed) return res.status(429).json({ error: 'Shumë votime të krijuara. Provo më vonë.' });
      const ids = Array.from(new Set(Array.isArray(eventIds) ? eventIds : [])).filter((x) => ID_RE.test(String(x)));
      if (ids.length < 2 || ids.length > 3) return res.status(400).json({ error: 'Zgjidh 2 ose 3 evente' });
      const found = await sb(`events?select=id&status=eq.approved&id=in.(${ids.join(',')})`);
      if (!Array.isArray(found) || found.length !== ids.length) return res.status(400).json({ error: 'Event i pavlefshëm' });
      const pollId = crypto.randomBytes(6).toString('base64url');
      await sb('polls', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ id: pollId, event_ids: ids, title: cleanString(title, 60) || null }),
      });
      return res.status(200).json({ id: pollId });
    }

    if (!POLL_RE.test(String(id || ''))) return res.status(400).json({ error: 'Votim i pavlefshëm' });

    if (action === 'get') {
      const data = await loadPoll(id, voterToken);
      if (!data) return res.status(404).json({ error: 'Votimi nuk u gjet' });
      return res.status(200).json(data);
    }

    if (action === 'vote') {
      if (!TOKEN_RE.test(String(voterToken || ''))) return res.status(400).json({ error: 'Token i pavlefshëm' });
      const { allowed } = await rateLimit(`poll-vote:${id}:${getClientIp(req)}`, { windowMs: 3600 * 1000, max: 30 });
      if (!allowed) return res.status(429).json({ error: 'Shumë vota nga ky rrjet' });
      const current = await loadPoll(id, voterToken);
      if (!current) return res.status(404).json({ error: 'Votimi nuk u gjet' });
      if (!current.events.some((e) => e.id === eventId)) return res.status(400).json({ error: 'Event i pavlefshëm' });
      await sb('poll_votes?on_conflict=poll_id,voter', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          poll_id: id,
          voter: voterHash(voterToken, id),
          event_id: eventId,
          name: cleanString(name, 20) || null,
        }),
      });
      return res.status(200).json(await loadPoll(id, voterToken));
    }

    return res.status(400).json({ error: 'Veprim i panjohur' });
  } catch (err) {
    console.error('poll error:', err);
    return res.status(500).json({ error: 'Gabim në server' });
  }
}
