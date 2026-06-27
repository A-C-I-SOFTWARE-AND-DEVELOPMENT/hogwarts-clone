// ─────────────────────────────────────────────────────────────────────────────
//  quests.js — daily tasks and lifetime milestones. Daily quests reroll each
//  in-game day and pay Galleons; milestones are the long arc (rescue the whole
//  menagerie, raise a Legendary, etc.). Kept deliberately small and readable.
// ─────────────────────────────────────────────────────────────────────────────

const DAILY_POOL = [
  { id: 'feed3',   kind: 'feed',    goal: 3, reward: 20, text: 'Feed your beasts 3 times' },
  { id: 'feed6',   kind: 'feed',    goal: 6, reward: 40, text: 'Feed your beasts 6 times' },
  { id: 'pet5',    kind: 'pet',     goal: 5, reward: 18, text: 'Pet your beasts 5 times' },
  { id: 'play3',   kind: 'play',    goal: 3, reward: 26, text: 'Play 3 times' },
  { id: 'groom2',  kind: 'groom',   goal: 2, reward: 22, text: 'Groom a beast twice' },
  { id: 'wash2',   kind: 'wash',    goal: 2, reward: 22, text: 'Bathe a beast twice' },
  { id: 'collect1',kind: 'collect', goal: 1, reward: 16, text: 'Collect produce once' },
  { id: 'fav1',    kind: 'fav',     goal: 1, reward: 30, text: 'Feed a beast its favourite food' },
];

const MILESTONES = [
  { id: 'first',   test: s => s.stats.rescued >= 1,  reward: 0,   text: 'Rescue your first beast' },
  { id: 'three',   test: s => s.beasts.length >= 3,  reward: 60,  text: 'Care for 3 beasts at once' },
  { id: 'five',    test: s => s.beasts.length >= 5,  reward: 120, text: 'Build a menagerie of 5' },
  { id: 'lvl5',    test: s => s.beasts.some(b => b.level >= 5),  reward: 80,  text: 'Raise a beast to Level 5' },
  { id: 'lvl10',   test: s => s.beasts.some(b => b.level >= 10), reward: 200, text: 'Raise a beast to Level 10' },
  { id: 'rich',    test: s => s.stats.collected >= 500, reward: 100, text: 'Collect 500 Galleons of produce' },
  { id: 'allcommon',test: s => ['niffler','puffskein'].every(x => s.unlocked.includes(x)), reward: 50, text: 'Adopt the common beasts' },
  { id: 'legend',  test: s => s.unlocked.includes('unicorn'), reward: 300, text: 'Earn a Unicorn foal\'s trust' },
];

export class Quests {
  constructor(state, bus) { this.state = state; this.bus = bus; this._ensureShape(); }

  _ensureShape() {
    const d = this.state.data;
    if (!d.quests) d.quests = { day: 0, daily: [], milestonesDone: [] };
    this.ensureDaily();
  }

  ensureDaily() {
    const d = this.state.data;
    if (d.quests.day === d.day && d.quests.daily.length) return;
    d.quests.day = d.day;
    // pick 3 distinct daily quests, seeded by day for stability
    const pool = [...DAILY_POOL];
    const picks = [];
    let seed = d.day * 9301 + 49297;
    while (picks.length < 3 && pool.length) {
      seed = (seed * 9301 + 49297) % 233280;
      const i = Math.floor(seed / 233280 * pool.length);
      picks.push(pool.splice(i, 1)[0]);
    }
    d.quests.daily = picks.map(q => ({ ...q, progress: 0, done: false, claimed: false }));
    this.bus?.emit('quests', this.list());
  }

  // called when a care action succeeds
  track(kind, meta = {}) {
    const d = this.state.data;
    let changed = false;
    for (const q of d.quests.daily) {
      if (q.done) continue;
      const hit = q.kind === kind || (q.kind === 'fav' && meta.favorite);
      if (!hit) continue;
      q.progress = Math.min(q.goal, q.progress + 1);
      if (q.progress >= q.goal) { q.done = true; }
      changed = true;
    }
    if (changed) { this.checkMilestones(); this.bus?.emit('quests', this.list()); this.state.save(); }
    this.checkMilestones();
  }

  claim(qid) {
    const q = this.state.data.quests.daily.find(x => x.id === qid);
    if (!q || !q.done || q.claimed) return 0;
    q.claimed = true;
    this.state.addCoins(q.reward);
    this.bus?.emit('quests', this.list());
    this.state.save();
    return q.reward;
  }

  checkMilestones() {
    const d = this.state.data;
    let newly = null;
    for (const m of MILESTONES) {
      if (d.quests.milestonesDone.includes(m.id)) continue;
      if (m.test(d)) {
        d.quests.milestonesDone.push(m.id);
        if (m.reward) this.state.addCoins(m.reward);
        newly = m;
        this.bus?.emit('milestone', m);
      }
    }
    return newly;
  }

  list() { return this.state.data.quests.daily; }
  milestones() {
    const done = new Set(this.state.data.quests.milestonesDone);
    return MILESTONES.map(m => ({ ...m, done: done.has(m.id) }));
  }
}
