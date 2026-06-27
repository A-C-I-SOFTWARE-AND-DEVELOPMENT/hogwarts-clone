// ─────────────────────────────────────────────────────────────────────────────
//  actions.js — the verbs of caring. Each returns a result the UI turns into a
//  toast, plays an animation on the live creature, spawns particles and grants
//  bond/XP. Favourite foods and well-timed care give the biggest rewards.
// ─────────────────────────────────────────────────────────────────────────────
import { ITEMS } from './items-data.js';
import { NEED_META } from './needs.js';

const now = () => performance.now() / 1000;
const COOLDOWN = { pet: 0.6, groom: 0.5, wash: 0.5, play: 0.8, feed: 0.4, rest: 0.5 };

function cooled(live, kind) {
  live._cool = live._cool || {};
  const t = now();
  if (live._cool[kind] && t - live._cool[kind] < COOLDOWN[kind]) return false;
  live._cool[kind] = t; return true;
}

function ctxOk(ctx) { return ctx && ctx.state && ctx.live && ctx.beast; }

// ── PET — the free, core interaction (tap the beast) ──
export function pet(ctx) {
  if (!ctxOk(ctx) || !cooled(ctx.live, 'pet')) return null;
  const { state, world, live, beast } = ctx;
  state.applyNeeds(beast, { joy: 7 });
  state.addBond(beast, 1.4);
  state.data.stats.petted++;
  live.command('pet', 1.4);
  const love = beast.bond > 60 || live.mood() > 0.7;
  live.react(love ? 'love' : 'happy');
  return { kind: 'pet', text: `You pet ${beast.name}.`, emoji: love ? '💞' : '💗' };
}

// ── FEED ──
export function feed(ctx, itemId) {
  if (!ctxOk(ctx)) return null;
  const { state, world, live, beast } = ctx;
  const item = ITEMS[itemId];
  if (!item) return null;
  if (!state.useItem(itemId, 1)) return { kind: 'fail', text: `No ${item.name} left — buy more.`, emoji: '🛒', fail: true };
  if (!cooled(ctx.live, 'feed')) { /* still consumed; allow */ }

  const meta = live.meta;
  const loved = itemId === meta.favorite;
  const liked = meta.diet?.includes(itemId);
  const fx = { ...(item.effects || {}) };
  let bond = 2;
  if (liked) { fx.joy = (fx.joy || 0) + 6; bond += 3; }
  if (loved) { fx.joy = (fx.joy || 0) + 8; bond += 4; }
  state.applyNeeds(beast, fx);
  state.addBond(beast, bond);
  state.data.stats.fed++;

  live.command('eat', 2.2);
  if (loved) { live.react('love'); world?.spawnHearts(live.headWorld(), 5); }
  else if (liked) { live.react('happy'); world?.spawnHearts(live.headWorld(), 2); }
  if (item.tag === 'shiny') world?.spawnSparkles(live.headWorld(), 12, meta.palette?.spark || 0xffe9b0);

  const tail = loved ? ' — its favourite!' : liked ? ' — yum!' : '';
  return { kind: 'feed', text: `Fed ${item.name} to ${beast.name}${tail}`, emoji: item.emoji };
}

// ── GROOM (brush) ──
export function groom(ctx) {
  if (!ctxOk(ctx) || !cooled(ctx.live, 'groom')) return null;
  const { state, world, live, beast } = ctx;
  if (!state.inv('brush')) return { kind: 'fail', text: 'You need a Grooming Brush.', emoji: '🧹', fail: true };
  state.applyNeeds(beast, { hygiene: 16, joy: 6 });
  state.addBond(beast, 2.2);
  state.data.stats.brushed++;
  live.command('pet', 1.8);
  live.react('happy');
  world?.spawnSparkles(live.headWorld(), 8, 0xeaf2ff);
  return { kind: 'groom', text: `Brushed ${beast.name}'s coat.`, emoji: '🧹' };
}

// ── WASH (soap/bubbles) ──
export function wash(ctx) {
  if (!ctxOk(ctx) || !cooled(ctx.live, 'wash')) return null;
  const { state, world, live, beast } = ctx;
  if (!state.inv('soap')) return { kind: 'fail', text: 'You need Bubotuber Soap.', emoji: '🫧', fail: true };
  state.applyNeeds(beast, { hygiene: 30, joy: 4 });
  state.addBond(beast, 2.4);
  state.data.stats.brushed++;
  live.command('pet', 2.0);
  live.react('happy');
  world?.spawnSparkles(live.headWorld(), 14, 0xbfe6ff);
  return { kind: 'wash', text: `${beast.name} is sparkling clean!`, emoji: '🫧' };
}

// ── PLAY (optional toy) ──
export function play(ctx, toyId) {
  if (!ctxOk(ctx) || !cooled(ctx.live, 'play')) return null;
  const { state, world, live, beast } = ctx;
  if (toyId && !state.inv(toyId)) return { kind: 'fail', text: `You don't own that toy.`, emoji: '🧸', fail: true };
  if (beast.needs.energy < 12) return { kind: 'fail', text: `${beast.name} is too tired to play.`, emoji: '😴', fail: true };
  let joy = 18, bond = 4;
  if (toyId === 'feather_wand') { joy += 6; bond += 2; }
  if (toyId === 'whistle') { joy += 4; bond += 3; }
  state.applyNeeds(beast, { joy, energy: -8 });
  state.addBond(beast, bond);
  state.data.stats.played++;
  live.command('play', 3.2);
  live.react('love');
  world?.spawnHearts(live.headWorld(), 4);
  const toy = toyId ? ITEMS[toyId] : null;
  return { kind: 'play', text: `Played${toy ? ' ' + toy.name : ''} with ${beast.name}!`, emoji: toy?.emoji || '🎉' };
}

// ── REST (sleep, or Pepperup for instant energy) ──
export function rest(ctx, usePotion = false) {
  if (!ctxOk(ctx) || !cooled(ctx.live, 'rest')) return null;
  const { state, world, live, beast } = ctx;
  if (usePotion) {
    if (!state.useItem('pepperup', 1)) return { kind: 'fail', text: 'No Pepperup Tonic.', emoji: '🧪', fail: true };
    state.applyNeeds(beast, { energy: 45 });
    world?.spawnSparkles(live.headWorld(), 16, 0xff8a4c);
    return { kind: 'rest', text: `${beast.name} is wide awake!`, emoji: '🧪' };
  }
  live.command('sleep', 10);
  return { kind: 'rest', text: `${beast.name} curls up for a nap.`, emoji: '😴' };
}

// ── COLLECT passive produce (coins the beast gathered) ──
export function collect(ctx) {
  if (!ctxOk(ctx)) return null;
  const { state, world, live, beast } = ctx;
  const pending = Math.floor(beast._produce || 0);
  if (pending <= 0) return { kind: 'fail', text: 'Nothing to collect yet.', emoji: '🪙', fail: true };
  beast._produce -= pending;
  state.addCoins(pending);
  state.data.stats.collected += pending;
  world?.spawnCoins(live.headWorld(), Math.min(10, 3 + (pending / 6) | 0));
  live.react('happy');
  const label = live.meta.produces?.item || 'treasure';
  return { kind: 'collect', text: `${beast.name} gave you ${pending} ${pending === 1 ? 'Galleon' : 'Galleons'} of ${label}!`, emoji: '🪙', coins: pending };
}
