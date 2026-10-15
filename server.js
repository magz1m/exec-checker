require('dotenv').config();
const express = require('express');
const session = require('cookie-session');
const fetch = require('node-fetch');
const path = require('path');

/* ============================================================
   FIREBASE
============================================================ */
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    console.log('📦 FIREBASE_SERVICE_ACCOUNT_JSON');
  } catch (e) { console.error('❌ Ошибка парсинга:', e.message); }
}
if (!serviceAccount) {
  serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  };
  console.log('☁️ Vercel env vars');
}

let db = null;
try {
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
    console.log('✅ Firebase initialized');
  }
  db = getFirestore();
} catch (e) { console.error('❌ FIREBASE INIT ERROR:', e.message); }

const app = express();
const PORT = process.env.PORT || 3000;
const OWNER_ID = process.env.OWNER_DISCORD_ID;

/* ============================================================
   РОЛИ — константы
============================================================ */
const ROLES = {
  GLOBAL_ADMIN:     { name: 'Гл. Администратор', color: '#610000', priority: 1, level: 90,  bg: 'linear-gradient(135deg,#610000,#8b0000)' },
  OWNER:            { name: 'Владелец',          color: '#ffd700', priority: 2, level: 100, bg: 'linear-gradient(135deg,#ffd700,#ff8c00)' },
  SENIOR_ADMIN:     { name: 'Ст. Администратор', color: '#a80000', priority: 3, level: 80,  bg: 'linear-gradient(135deg,#a80000,#d82b2b)' },
  ADMIN:            { name: 'Администратор',     color: '#d82b2b', priority: 4, level: 70,  bg: 'linear-gradient(135deg,#d82b2b,#ff4a4a)' },
  GLOBAL_MODERATOR: { name: 'Гл. Модератор',     color: '#015469', priority: 5, level: 60,  bg: 'linear-gradient(135deg,#015469,#0097bd)' },
  SENIOR_MODERATOR: { name: 'Ст. Модератор',     color: '#0097bd', priority: 6, level: 50,  bg: 'linear-gradient(135deg,#0097bd,#4a9bff)' },
  MODERATOR:        { name: 'Модератор',         color: '#4a9bff', priority: 7, level: 40,  bg: 'linear-gradient(135deg,#4a9bff,#7eb8ff)' },
  SUPPORT:          { name: 'Тех. Поддержка',    color: '#ababab', priority: 8, level: 30,  bg: 'linear-gradient(135deg,#ababab,#d5d5d5)' },
  USER:             { name: 'Пользователь',      color: null,      priority: 99, level: 10, bg: null }
};
const ROLE_ORDER = ['GLOBAL_ADMIN','OWNER','SENIOR_ADMIN','ADMIN','GLOBAL_MODERATOR','SENIOR_MODERATOR','MODERATOR','SUPPORT'];

function getHighestLevel(roles) {
  if (!roles || roles.length === 0) return 10;
  return Math.max(...roles.map(r => (ROLES[r] && ROLES[r].level) || 0));
}
function hasRole(user, role) { return user && Array.isArray(user.roles) && user.roles.indexOf(role) !== -1; }
function hasAnyRole(user, roles) {
  if (!user || !Array.isArray(user.roles)) return false;
  return roles.some(r => user.roles.indexOf(r) !== -1);
}
function canManageRoles(user)  { return hasAnyRole(user, ['OWNER', 'GLOBAL_ADMIN']); }
function canModerate(user)     { return hasAnyRole(user, ['OWNER','GLOBAL_ADMIN','SENIOR_ADMIN','ADMIN','GLOBAL_MODERATOR','SENIOR_MODERATOR','MODERATOR']); }
function canPostNews(user)     { return hasAnyRole(user, ['OWNER','GLOBAL_ADMIN','SENIOR_ADMIN','ADMIN']); }
function isAdmin(user)         { return hasAnyRole(user, ['OWNER','GLOBAL_ADMIN','SENIOR_ADMIN','ADMIN']); }
function isStaff(user)         { return canModerate(user) || hasRole(user, 'SUPPORT'); }

/* ============================================================
   МАГАЗИН
============================================================ */
const SHOP_ITEMS = {
  frames: {
    bronze:  { name: '🥉 Bronze',  price: 200,  css: 'linear-gradient(135deg,#cd7f32,#8b5a2b)' },
    silver:  { name: '🥈 Silver',  price: 500,  css: 'linear-gradient(135deg,#c0c0c0,#707070)' },
    gold:    { name: '🥇 Gold',    price: 1000, css: 'linear-gradient(135deg,#ffd700,#ff8c00)' },
    diamond: { name: '💎 Diamond', price: 2000, css: 'linear-gradient(135deg,#b9f2ff,#7ec8ff)' },
    rainbow: { name: '🌈 Rainbow', price: 3000, css: 'conic-gradient(from 0deg,#ff0000,#ff8800,#ffff00,#00ff00,#0088ff,#8800ff,#ff0000)' },
    crown:   { name: '👑 Crown',   price: 5000, css: 'linear-gradient(135deg,#ffd700,#ff8c00,#ffd700)' }
  },
  colors: {
    red:     { name: '🔴 Красный',    price: 100,  css: '#ff4444' },
    green:   { name: '🟢 Зелёный',    price: 100,  css: '#44ff44' },
    blue:    { name: '🔵 Синий',      price: 100,  css: '#4488ff' },
    purple:  { name: '🟣 Фиолетовый', price: 150,  css: '#c39cff' },
    gold:    { name: '🟡 Золотой',    price: 300,  css: '#ffd700' },
    rainbow: { name: '🌈 Радужный',   price: 1000, css: 'rainbow' }
  },
  titles: {
    gamer:    { name: '🎮 Геймер',        price: 400 },
    fast:     { name: '⚡ Быстрый',        price: 500 },
    explorer: { name: '🌌 Исследователь', price: 800 },
    legend:   { name: '🔥 Легенда',       price: 2500 },
    chosen:   { name: '👑 Избранный',     price: 5000 }
  }
};
function getAdminItems() {
  return {
    frames: Object.keys(SHOP_ITEMS.frames),
    colors: Object.keys(SHOP_ITEMS.colors),
    titles: Object.keys(SHOP_ITEMS.titles)
  };
}

/* ============================================================
   MIDDLEWARE
============================================================ */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);
app.use(session({
  name: 'exec-session',
  keys: [process.env.SESSION_SECRET || 'fallback-secret-change-me'],
  maxAge: 1000 * 60 * 60 * 24 * 7,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  overwrite: true
}));

app.use(express.static(path.join(__dirname, 'public')));

/* ============================================================
   ДИАГНОСТИКА
============================================================ */
app.get('/api/debug', (req, res) => {
  res.json({
    firebase: db ? 'OK' : 'FAILED',
    projectId: serviceAccount.projectId || 'missing',
    nodeVersion: process.version
  });
});

/* ============================================================
   AUTH
============================================================ */
app.get('/api/auth/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds'
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

app.get('/api/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=no_code');

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No access token');

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const discordUser = await userRes.json();

    const userRef = db.collection('users').doc(discordUser.id);
    const userDoc = await userRef.get();

    let userData;
    if (userDoc.exists) {
      userData = userDoc.data();
      await userRef.update({ username: discordUser.username, avatar: discordUser.avatar });
    } else {
      const isOwner = discordUser.id === OWNER_ID;
      const roles = isOwner ? ['OWNER', 'GLOBAL_ADMIN', 'SUPPORT'] : [];
      const isAdm = ['OWNER','GLOBAL_ADMIN','SENIOR_ADMIN','ADMIN'].some(r => roles.indexOf(r) !== -1);
      const all = getAdminItems();
      userData = {
        discordId: discordUser.id,
        username: discordUser.username,
        avatar: discordUser.avatar,
        roles,
        coins: isOwner ? 999999 : 0,
        purchasedFrames: isAdm ? all.frames : [],
        purchasedColors: isAdm ? all.colors : [],
        purchasedTitles: isAdm ? all.titles : [],
        activeFrame: null,
        activeColor: null,
        activeTitle: isAdm ? 'chosen' : null,
        usedPromos: [],
        createdAt: FieldValue.serverTimestamp()
      };
      await userRef.set(userData);
      sendWebhook(`🎉 Новый: **${discordUser.username}** (\`${discordUser.id}\`)`);
    }

    // Миграция role → roles
    let roles = userData.roles;
    if (!roles || roles.length === 0) {
      roles = userData.role ? [userData.role] : [];
    }
    if (discordUser.id === OWNER_ID) {
      roles = Array.from(new Set([...roles, 'OWNER', 'GLOBAL_ADMIN', 'SUPPORT']));
    }
    const oldRolesKey = JSON.stringify((userData.roles || []).slice().sort());
    const newRolesKey = JSON.stringify(roles.slice().sort());
    if (oldRolesKey !== newRolesKey) {
      await userRef.update({ roles });
      userData.roles = roles;
    }

    // Авто-выдача товаров админам
    if (isAdmin({ roles })) {
      const all = getAdminItems();
      const updates = {};
      if ((userData.purchasedFrames || []).length !== all.frames.length) updates.purchasedFrames = all.frames;
      if ((userData.purchasedColors || []).length !== all.colors.length) updates.purchasedColors = all.colors;
      if ((userData.purchasedTitles || []).length !== all.titles.length) updates.purchasedTitles = all.titles;
      if (Object.keys(updates).length > 0) await userRef.update(updates);
    }

    req.session.userId = discordUser.id;
    req.session.user = {
      id: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,
      roles,
      coins: userData.coins || 0
    };

    res.redirect('/');
  } catch (err) {
    console.error('OAuth error:', err);
    res.redirect('/?error=oauth_failed');
  }
});

app.get('/api/auth/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.user) return res.json({ loggedIn: false });
  try {
    const userDoc = await db.collection('users').doc(req.session.user.id).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      let roles = data.roles;
      if (!roles || roles.length === 0) {
        roles = data.role ? [data.role] : [];
      }
      if (data.discordId === OWNER_ID) {
        roles = Array.from(new Set([...roles, 'OWNER', 'GLOBAL_ADMIN', 'SUPPORT']));
      }
      const oldKey = JSON.stringify((data.roles || []).slice().sort());
      const newKey = JSON.stringify(roles.slice().sort());
      if (oldKey !== newKey) {
        await db.collection('users').doc(req.session.user.id).update({ roles });
      }

      if (isAdmin({ roles })) {
        const all = getAdminItems();
        const updates = {};
        if ((data.purchasedFrames || []).length !== all.frames.length) updates.purchasedFrames = all.frames;
        if ((data.purchasedColors || []).length !== all.colors.length) updates.purchasedColors = all.colors;
        if ((data.purchasedTitles || []).length !== all.titles.length) updates.purchasedTitles = all.titles;
        if (Object.keys(updates).length > 0) {
          await db.collection('users').doc(req.session.user.id).update(updates);
          Object.assign(data, updates);
        }
      }

      req.session.user.roles = roles;
      req.session.user.coins = data.coins || 0;
      req.session.user.purchasedFrames = data.purchasedFrames || [];
      req.session.user.purchasedColors = data.purchasedColors || [];
      req.session.user.purchasedTitles = data.purchasedTitles || [];
      req.session.user.activeFrame = data.activeFrame || null;
      req.session.user.activeColor = data.activeColor || null;
      req.session.user.activeTitle = data.activeTitle || null;
    }
  } catch (err) {}
  res.json({ loggedIn: true, user: req.session.user });
});

/* ============================================================
   ПРОМОКОДЫ
============================================================ */
app.post('/api/promo/activate', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди через Discord' });
  const code = (req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Пустой код' });

  try {
    const promoRef = db.collection('promocodes').doc(code);
    const userRef = db.collection('users').doc(req.session.user.id);

    const result = await db.runTransaction(async (t) => {
      const promoDoc = await t.get(promoRef);
      const userDoc = await t.get(userRef);
      if (!promoDoc.exists) throw new Error('INVALID');
      const userData = userDoc.data();
      if (userData.usedPromos && userData.usedPromos.includes(code)) throw new Error('ALREADY_USED');
      const promo = promoDoc.data();
      if (promo.used) throw new Error('USED');
      t.update(promoRef, { used: true, usedBy: req.session.user.id, usedAt: FieldValue.serverTimestamp() });
      t.update(userRef, { coins: FieldValue.increment(promo.coins), usedPromos: FieldValue.arrayUnion(code) });
      return { coins: promo.coins, newBalance: (userData.coins || 0) + promo.coins };
    });

    req.session.user.coins = result.newBalance;
    sendWebhook(`🎁 **${req.session.user.username}** +**${result.coins} монет**!`);
    res.json({ success: true, coins: result.coins, newBalance: result.newBalance });
  } catch (err) {
    const map = {
      'INVALID': { code: 404, msg: 'Неверный код' },
      'ALREADY_USED': { code: 400, msg: 'Уже использовал' },
      'USED': { code: 400, msg: 'Код использован' }
    };
    const e = map[err.message];
    if (e) return res.status(e.code).json({ error: e.msg });
    res.status(500).json({ error: 'Ошибка' });
  }
});

/* ============================================================
   СТАТИСТИКА
============================================================ */
app.get('/api/stats', async (req, res) => {
  try {
    if (!db) return res.json({ users: 0, posts: 0, online: 20 });
    const usersSnap = await db.collection('users').count().get();
    const postsSnap = await db.collection('posts').count().get();
    res.json({
      users: usersSnap.data().count,
      posts: postsSnap.data().count,
      online: Math.floor(Math.random() * 30) + 15
    });
  } catch (err) {
    res.json({ users: 0, posts: 0, online: 20 });
  }
});

/* ============================================================
   ПРОФИЛЬ
============================================================ */
app.get('/api/user/:id', async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.params.id).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Не найден' });
    const data = userDoc.data();
    let roles = data.roles || (data.role ? [data.role] : []);
    res.json({
      discordId: data.discordId,
      username: data.username,
      avatar: data.avatar,
      roles,
      coins: data.coins,
      activeFrame: data.activeFrame || null,
      activeColor: data.activeColor || null,
      activeTitle: data.activeTitle || null
    });
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
});

/* ============================================================
   РОЛИ — публичный список
============================================================ */
app.get('/api/roles', (req, res) => {
  res.json({ roles: ROLES, order: ROLE_ORDER });
});

/* Поиск юзеров (только стафф) */
app.get('/api/users/search', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!isStaff(req.session.user)) return res.status(403).json({ error: 'Нет прав' });
  if (!db) return res.status(500).json({ error: 'БД' });

  const q = (req.query.q || '').toLowerCase().trim();
  if (q.length < 2) return res.json({ users: [] });

  try {
    const snap = await db.collection('users').limit(1000).get();
    const users = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(u => (u.username || '').toLowerCase().includes(q))
      .slice(0, 20)
      .map(u => ({
        id: u.discordId,
        username: u.username,
        avatar: u.avatar,
        roles: u.roles || (u.role ? [u.role] : []),
        coins: u.coins || 0
      }));
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка' });
  }
});

/* Инфо о юзере (только стафф) */
app.get('/api/users/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!isStaff(req.session.user)) return res.status(403).json({ error: 'Нет прав' });
  if (!db) return res.status(500).json({ error: 'БД' });

  try {
    const userDoc = await db.collection('users').doc(req.params.id).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Не найден' });
    const d = userDoc.data();
    const roles = d.roles || (d.role ? [d.role] : []);
    res.json({
      id: d.discordId,
      username: d.username,
      avatar: d.avatar,
      roles,
      coins: d.coins || 0
    });
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
});

/* Обновить роли (OWNER + GLOBAL_ADMIN) */
app.post('/api/users/:id/roles', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!canManageRoles(req.session.user)) return res.status(403).json({ error: 'Только Владелец и ГЛ. Администратор' });
  if (!db) return res.status(500).json({ error: 'БД' });

  const targetId = req.params.id;
  if (targetId === req.session.user.id) return res.status(400).json({ error: 'Нельзя менять свои роли' });
  if (targetId === OWNER_ID) return res.status(403).json({ error: 'Роли Владельца изменяются только вручную в БД' });

  const newRoles = Array.isArray(req.body.roles) ? req.body.roles : [];
  const validRoles = newRoles.filter(r => ROLES[r] && r !== 'USER');

  try {
    const targetDoc = await db.collection('users').doc(targetId).get();
    if (!targetDoc.exists) return res.status(404).json({ error: 'Юзер не найден' });
    const targetData = targetDoc.data();
    const oldRoles = targetData.roles || (targetData.role ? [targetData.role] : []);

    const added = validRoles.filter(r => oldRoles.indexOf(r) === -1);
    const removed = oldRoles.filter(r => validRoles.indexOf(r) === -1);

    if (added.length === 0 && removed.length === 0) {
      return res.json({ success: true, roles: validRoles });
    }

    const amOwner = hasRole(req.session.user, 'OWNER');
    const myLevel = getHighestLevel(req.session.user.roles);

    if (!amOwner) {
      if (added.indexOf('OWNER') !== -1 || removed.indexOf('OWNER') !== -1) {
        return res.status(403).json({ error: 'Только Владелец может управлять ролью OWNER' });
      }
      if (added.indexOf('GLOBAL_ADMIN') !== -1 || removed.indexOf('GLOBAL_ADMIN') !== -1) {
        return res.status(403).json({ error: 'Только Владелец может управлять ролью ГЛ. Администратор' });
      }
    }

    const all = added.concat(removed);
    const problemRole = all.find(r => {
      const rLevel = (ROLES[r] && ROLES[r].level) || 0;
      return rLevel >= myLevel && !amOwner;
    });
    if (problemRole) {
      return res.status(403).json({ error: 'Нельзя управлять ролью «' + ROLES[problemRole].name + '» — она не ниже твоей' });
    }

    await db.collection('users').doc(targetId).update({ roles: validRoles });

    await db.collection('role_logs').add({
      timestamp: FieldValue.serverTimestamp(),
      actorId: req.session.user.id,
      actorUsername: req.session.user.username,
      targetId,
      targetUsername: targetData.username,
      added,
      removed
    });

    if (added.length > 0 || removed.length > 0) {
      const changes = [];
      added.forEach(r => changes.push('+ ' + ROLES[r].name));
      removed.forEach(r => changes.push('- ' + ROLES[r].name));
      await db.collection('notifications').add({
        userId: targetId,
        type: 'role_change',
        fromUserId: req.session.user.id,
        fromUsername: req.session.user.username,
        fromAvatar: req.session.user.avatar,
        text: 'Изменены роли: ' + changes.join(', '),
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
    }

    const changeStr = [];
    added.forEach(r => changeStr.push('+**' + ROLES[r].name + '**'));
    removed.forEach(r => changeStr.push('-**' + ROLES[r].name + '**'));
    sendWebhook(`🎭 **${req.session.user.username}** изменил роли **${targetData.username}**: ${changeStr.join(' ')}`);

    res.json({ success: true, roles: validRoles });
  } catch (err) {
    console.error('Roles update error:', err);
    res.status(500).json({ error: 'Ошибка: ' + err.message });
  }
});

/* Журнал ролей */
app.get('/api/roles/log', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!canManageRoles(req.session.user)) return res.status(403).json({ error: 'Только стафф' });
  if (!db) return res.status(500).json({ error: 'БД' });

  try {
    const snap = await db.collection('role_logs').orderBy('timestamp', 'desc').limit(100).get();
    const logs = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        timestamp: d.timestamp,
        actorId: d.actorId,
        actorUsername: d.actorUsername,
        targetId: d.targetId,
        targetUsername: d.targetUsername,
        added: d.added || [],
        removed: d.removed || []
      };
    });
    res.json({ logs });
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
});

/* ============================================================
   МАГАЗИН
============================================================ */
app.get('/api/shop', (req, res) => {
  res.json(SHOP_ITEMS);
});

app.post('/api/shop/purchase', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди через Discord' });
  if (!db) return res.status(500).json({ error: 'БД' });

  const { type, itemId } = req.body;
  if (!type || !itemId) return res.status(400).json({ error: 'Не указан товар' });
  if (['frames','colors','titles'].indexOf(type) === -1) return res.status(400).json({ error: 'Неверный тип' });

  const catalog = SHOP_ITEMS[type];
  const item = catalog[itemId];
  if (!item) return res.status(404).json({ error: 'Товар не найден' });

  try {
    const userRef = db.collection('users').doc(req.session.user.id);

    const result = await db.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      const userData = userDoc.data();

      const fieldMap = { frames: 'purchasedFrames', colors: 'purchasedColors', titles: 'purchasedTitles' };
      const ownedField = fieldMap[type];
      const owned = userData[ownedField] || [];

      const userRoles = userData.roles || (userData.role ? [userData.role] : []);
      if (isAdmin({ roles: userRoles })) throw new Error('ADMIN_ALREADY_HAS');
      if (owned.indexOf(itemId) !== -1) throw new Error('ALREADY_OWNED');

      const coins = userData.coins || 0;
      if (coins < item.price) throw new Error('NOT_ENOUGH_COINS');

      const upd = {};
      upd.coins = FieldValue.increment(-item.price);
      upd[ownedField] = FieldValue.arrayUnion(itemId);
      t.update(userRef, upd);

      return { price: item.price, newBalance: coins - item.price, name: item.name };
    });

    req.session.user.coins = result.newBalance;
    sendWebhook(`🛒 **${req.session.user.username}** купил **${result.name}** за **${result.price}💰**`);
    res.json({ success: true, newBalance: result.newBalance, name: result.name });
  } catch (err) {
    const map = {
      'ADMIN_ALREADY_HAS': { code: 400, msg: 'У администратора уже есть всё' },
      'ALREADY_OWNED': { code: 400, msg: 'Уже куплено' },
      'NOT_ENOUGH_COINS': { code: 400, msg: 'Недостаточно монет' }
    };
    const e = map[err.message];
    if (e) return res.status(e.code).json({ error: e.msg });
    res.status(500).json({ error: 'Ошибка' });
  }
});

app.post('/api/shop/equip', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди через Discord' });
  if (!db) return res.status(500).json({ error: 'БД недоступна' });

  const { type, itemId } = req.body;
  if (['frames','colors','titles'].indexOf(type) === -1) return res.status(400).json({ error: 'Неверный тип' });

  const normalizedId = (itemId === null || itemId === 'null' || itemId === undefined || itemId === '') ? null : String(itemId);

  try {
    const userRef = db.collection('users').doc(req.session.user.id);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Профиль не найден' });
    const userData = userDoc.data();

    const ownedFieldMap = { frames: 'purchasedFrames', colors: 'purchasedColors', titles: 'purchasedTitles' };
    const activeFieldMap = { frames: 'activeFrame', colors: 'activeColor', titles: 'activeTitle' };
    const ownedField = ownedFieldMap[type];
    const activeField = activeFieldMap[type];

    if (normalizedId === null) {
      const upd = {};
      upd[activeField] = null;
      await userRef.update(upd);
      if (req.session.user) req.session.user[activeField] = null;
      return res.json({ success: true, active: null });
    }

    const owned = userData[ownedField] || [];
    const userRoles = userData.roles || (userData.role ? [userData.role] : []);
    const isAdm = isAdmin({ roles: userRoles });

    if (!isAdm && owned.indexOf(normalizedId) === -1) {
      return res.status(403).json({ error: 'Товар не куплен' });
    }

    const upd = {};
    upd[activeField] = normalizedId;
    await userRef.update(upd);
    if (req.session.user) req.session.user[activeField] = normalizedId;
    res.json({ success: true, active: normalizedId });
  } catch (err) {
    console.error('Equip error:', err);
    res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
  }
});

/* ============================================================
   @MENTIONS
============================================================ */
async function processMentions(text, fromUser, postId, replyId) {
  if (!db) return [];
  replyId = replyId || null;
  const matches = text.match(/@([a-zA-Z0-9_.]+)/g) || [];
  if (matches.length === 0) return [];
  const usernames = Array.from(new Set(matches.map(m => m.substring(1).toLowerCase())));
  const mentionedIds = [];

  for (let i = 0; i < usernames.length; i++) {
    const uname = usernames[i];
    try {
      const snap = await db.collection('users').where('username', '==', uname).limit(1).get();
      if (snap.empty) continue;
      const targetDoc = snap.docs[0];
      const targetId = targetDoc.id;
      if (targetId === fromUser.id) continue;

      await db.collection('notifications').add({
        userId: targetId,
        type: 'mention',
        fromUserId: fromUser.id,
        fromUsername: fromUser.username,
        fromAvatar: fromUser.avatar,
        postId,
        replyId,
        text: 'упомянул тебя в ' + (replyId ? 'ответе' : 'посте'),
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
      mentionedIds.push(targetId);
    } catch (e) { console.error('Mention error:', e); }
  }
  return mentionedIds;
}

/* ============================================================
   ФОРУМ
============================================================ */
app.get('/api/posts', async (req, res) => {
  if (!db) return res.json({ posts: [] });
  try {
    const search = (req.query.search || '').toLowerCase().trim();
    const sort = req.query.sort || 'new';
    const category = req.query.category || 'all';

    const snap = await db.collection('posts').limit(200).get();
    let posts = snap.docs.map(doc => {
      const d = doc.data();
      const aRoles = d.authorRoles || (d.authorRole ? [d.authorRole] : []);
      return {
        id: doc.id,
        authorId: d.authorId,
        authorUsername: d.authorUsername,
        authorAvatar: d.authorAvatar,
        authorRoles: aRoles,
        authorActiveFrame: d.authorActiveFrame || null,
        authorActiveColor: d.authorActiveColor || null,
        authorActiveTitle: d.authorActiveTitle || null,
        category: d.category,
        title: d.title,
        content: d.content,
        likes: (d.likes || []).length,
        likedByMe: req.session.user ? (d.likes || []).indexOf(req.session.user.id) !== -1 : false,
        replyCount: d.replyCount || 0,
        views: d.views || 0,
        pinned: d.pinned || false,
        editedAt: d.editedAt || null,
        createdAt: d.createdAt
      };
    });

    if (category !== 'all') posts = posts.filter(p => p.category === category);
    if (search) {
      posts = posts.filter(p =>
        (p.title || '').toLowerCase().includes(search) ||
        (p.content || '').toLowerCase().includes(search) ||
        (p.authorUsername || '').toLowerCase().includes(search)
      );
    }

    if (sort === 'new') posts.sort((a, b) => (b.createdAt && b.createdAt._seconds || 0) - (a.createdAt && a.createdAt._seconds || 0));
    else if (sort === 'top') posts.sort((a, b) => b.likes - a.likes);
    else if (sort === 'discussed') posts.sort((a, b) => b.replyCount - a.replyCount);
    else if (sort === 'views') posts.sort((a, b) => b.views - a.views);
    posts.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    res.json({ posts });
  } catch (err) {
    console.error('Posts list error:', err);
    res.status(500).json({ error: 'Ошибка' });
  }
});

app.get('/api/posts/:id', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'БД' });
  try {
    const postRef = db.collection('posts').doc(req.params.id);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Не найден' });
    const post = postDoc.data();

    if (!req.session.user || req.session.user.id !== post.authorId) {
      try { await postRef.update({ views: FieldValue.increment(1) }); } catch (e) {}
    }

    const repliesSnap = await db.collection('replies').where('postId', '==', req.params.id).limit(500).get();
    const replies = repliesSnap.docs.map(doc => {
      const d = doc.data();
      const rRoles = d.authorRoles || (d.authorRole ? [d.authorRole] : []);
      return {
        id: doc.id,
        authorId: d.authorId,
        authorUsername: d.authorUsername,
        authorAvatar: d.authorAvatar,
        authorRoles: rRoles,
        authorActiveFrame: d.authorActiveFrame || null,
        authorActiveColor: d.authorActiveColor || null,
        authorActiveTitle: d.authorActiveTitle || null,
        content: d.content,
        likes: (d.likes || []).length,
        likedByMe: req.session.user ? (d.likes || []).indexOf(req.session.user.id) !== -1 : false,
        editedAt: d.editedAt || null,
        createdAt: d.createdAt
      };
    }).sort((a, b) => (a.createdAt && a.createdAt._seconds || 0) - (b.createdAt && b.createdAt._seconds || 0));

    const pRoles = post.authorRoles || (post.authorRole ? [post.authorRole] : []);
    res.json({
      post: {
        id: postDoc.id,
        authorId: post.authorId,
        authorUsername: post.authorUsername,
        authorAvatar: post.authorAvatar,
        authorRoles: pRoles,
        authorActiveFrame: post.authorActiveFrame || null,
        authorActiveColor: post.authorActiveColor || null,
        authorActiveTitle: post.authorActiveTitle || null,
        category: post.category,
        title: post.title,
        content: post.content,
        likes: (post.likes || []).length,
        likedByMe: req.session.user ? (post.likes || []).indexOf(req.session.user.id) !== -1 : false,
        views: (post.views || 0) + 1,
        pinned: post.pinned || false,
        editedAt: post.editedAt || null,
        createdAt: post.createdAt
      },
      replies
    });
  } catch (err) {
    console.error('Post get error:', err);
    res.status(500).json({ error: 'Ошибка' });
  }
});

app.post('/api/posts', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!db) return res.status(500).json({ error: 'БД' });

  const { title, content, category } = req.body;
  if (!title || !content || !category) return res.status(400).json({ error: 'Заполни всё' });
  if (title.length > 150) return res.status(400).json({ error: 'Заголовок длинный' });
  if (content.length > 5000) return res.status(400).json({ error: 'Текст длинный' });

  const allowed = ['news', 'help', 'discussion', 'bugs'];
  if (allowed.indexOf(category) === -1) return res.status(400).json({ error: 'Раздел' });

  if (category === 'news' && !canPostNews(req.session.user)) {
    return res.status(403).json({ error: 'Нет прав' });
  }

  try {
    const uDoc = await db.collection('users').doc(req.session.user.id).get();
    const ud = uDoc.data() || {};
    const roles = ud.roles || (ud.role ? [ud.role] : []);

    const postRef = await db.collection('posts').add({
      authorId: req.session.user.id,
      authorUsername: req.session.user.username,
      authorAvatar: req.session.user.avatar,
      authorRoles: roles,
      authorActiveFrame: ud.activeFrame || null,
      authorActiveColor: ud.activeColor || null,
      authorActiveTitle: ud.activeTitle || null,
      category,
      title,
      content,
      likes: [],
      replyCount: 0,
      views: 0,
      pinned: false,
      createdAt: FieldValue.serverTimestamp()
    });

    await processMentions(content, req.session.user, postRef.id, null);
    sendWebhook(`📝 **${req.session.user.username}** создал пост «${title}» в /${category}`);
    res.json({ success: true, id: postRef.id });
  } catch (err) {
    console.error('Post create error:', err);
    res.status(500).json({ error: 'Ошибка' });
  }
});

app.post('/api/posts/:id/edit', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!db) return res.status(500).json({ error: 'БД' });

  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Заполни всё' });

  try {
    const postRef = db.collection('posts').doc(req.params.id);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Не найден' });

    const isAuthor = postDoc.data().authorId === req.session.user.id;
    if (!isAuthor && !canModerate(req.session.user)) return res.status(403).json({ error: 'Нет прав' });

    await postRef.update({ title, content, editedAt: FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
});

app.post('/api/posts/:id/pin', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!isAdmin(req.session.user)) return res.status(403).json({ error: 'Только админ/владелец' });
  if (!db) return res.status(500).json({ error: 'БД' });

  try {
    const postRef = db.collection('posts').doc(req.params.id);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Не найден' });
    const current = postDoc.data().pinned || false;
    await postRef.update({ pinned: !current });
    res.json({ success: true, pinned: !current });
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
});

app.post('/api/posts/:id/replies', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!db) return res.status(500).json({ error: 'БД' });

  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Пусто' });
  if (content.length > 2000) return res.status(400).json({ error: 'Длинно' });

  try {
    const postDoc = await db.collection('posts').doc(req.params.id).get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Пост не найден' });

    const uDoc = await db.collection('users').doc(req.session.user.id).get();
    const ud = uDoc.data() || {};
    const roles = ud.roles || (ud.role ? [ud.role] : []);

    const replyRef = await db.collection('replies').add({
      postId: req.params.id,
      authorId: req.session.user.id,
      authorUsername: req.session.user.username,
      authorAvatar: req.session.user.avatar,
      authorRoles: roles,
      authorActiveFrame: ud.activeFrame || null,
      authorActiveColor: ud.activeColor || null,
      authorActiveTitle: ud.activeTitle || null,
      content,
      likes: [],
      createdAt: FieldValue.serverTimestamp()
    });

    await db.collection('posts').doc(req.params.id).update({ replyCount: FieldValue.increment(1) });

    const postData = postDoc.data();
    if (postData.authorId !== req.session.user.id) {
      await db.collection('notifications').add({
        userId: postData.authorId,
        type: 'reply',
        fromUserId: req.session.user.id,
        fromUsername: req.session.user.username,
        fromAvatar: req.session.user.avatar,
        postId: req.params.id,
        replyId: replyRef.id,
        text: 'ответил на твой пост «' + postData.title + '»',
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
    }

    await processMentions(content, req.session.user, req.params.id, replyRef.id);
    res.json({ success: true, id: replyRef.id });
  } catch (err) {
    console.error('Reply error:', err);
    res.status(500).json({ error: 'Ошибка' });
  }
});

app.post('/api/replies/:id/edit', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!db) return res.status(500).json({ error: 'БД' });

  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Пусто' });

  try {
    const replyRef = db.collection('replies').doc(req.params.id);
    const replyDoc = await replyRef.get();
    if (!replyDoc.exists) return res.status(404).json({ error: 'Не найден' });

    const isAuthor = replyDoc.data().authorId === req.session.user.id;
    if (!isAuthor && !canModerate(req.session.user)) return res.status(403).json({ error: 'Нет прав' });

    await replyRef.update({ content, editedAt: FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
});

app.post('/api/posts/:id/like', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!db) return res.status(500).json({ error: 'БД' });
  try {
    const postRef = db.collection('posts').doc(req.params.id);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Не найден' });
    const likes = postDoc.data().likes || [];
    const userId = req.session.user.id;
    const postData = postDoc.data();
    if (likes.indexOf(userId) !== -1) {
      await postRef.update({ likes: FieldValue.arrayRemove(userId) });
      res.json({ success: true, liked: false, count: likes.length - 1 });
    } else {
      await postRef.update({ likes: FieldValue.arrayUnion(userId) });
      if (postData.authorId !== userId) {
        await db.collection('notifications').add({
          userId: postData.authorId, type: 'like_post',
          fromUserId: userId, fromUsername: req.session.user.username, fromAvatar: req.session.user.avatar,
          postId: req.params.id, text: 'лайкнул твой пост «' + postData.title + '»',
          read: false, createdAt: FieldValue.serverTimestamp()
        });
      }
      res.json({ success: true, liked: true, count: likes.length + 1 });
    }
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
});

app.post('/api/replies/:id/like', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!db) return res.status(500).json({ error: 'БД' });
  try {
    const replyRef = db.collection('replies').doc(req.params.id);
    const replyDoc = await replyRef.get();
    if (!replyDoc.exists) return res.status(404).json({ error: 'Не найден' });
    const likes = replyDoc.data().likes || [];
    const userId = req.session.user.id;
    const replyData = replyDoc.data();
    if (likes.indexOf(userId) !== -1) {
      await replyRef.update({ likes: FieldValue.arrayRemove(userId) });
      res.json({ success: true, liked: false, count: likes.length - 1 });
    } else {
      await replyRef.update({ likes: FieldValue.arrayUnion(userId) });
      if (replyData.authorId !== userId) {
        await db.collection('notifications').add({
          userId: replyData.authorId, type: 'like_reply',
          fromUserId: userId, fromUsername: req.session.user.username, fromAvatar: req.session.user.avatar,
          postId: replyData.postId, replyId: req.params.id, text: 'лайкнул твой ответ',
          read: false, createdAt: FieldValue.serverTimestamp()
        });
      }
      res.json({ success: true, liked: true, count: likes.length + 1 });
    }
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
});

app.delete('/api/posts/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!db) return res.status(500).json({ error: 'БД' });
  try {
    const postRef = db.collection('posts').doc(req.params.id);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Не найден' });
    const isAuthor = postDoc.data().authorId === req.session.user.id;
    if (!isAuthor && !canModerate(req.session.user)) return res.status(403).json({ error: 'Нет прав' });

    const repliesSnap = await db.collection('replies').where('postId', '==', req.params.id).get();
    const batch = db.batch();
    repliesSnap.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(postRef);
    await batch.commit();

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
});

app.delete('/api/replies/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!db) return res.status(500).json({ error: 'БД' });
  try {
    const replyRef = db.collection('replies').doc(req.params.id);
    const replyDoc = await replyRef.get();
    if (!replyDoc.exists) return res.status(404).json({ error: 'Не найден' });
    const isAuthor = replyDoc.data().authorId === req.session.user.id;
    if (!isAuthor && !canModerate(req.session.user)) return res.status(403).json({ error: 'Нет прав' });
    const postId = replyDoc.data().postId;
    await replyRef.delete();
    await db.collection('posts').doc(postId).update({ replyCount: FieldValue.increment(-1) });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
});

/* УВЕДОМЛЕНИЯ */
app.get('/api/notifications', async (req, res) => {
  if (!req.session.user) return res.json({ notifications: [], unread: 0 });
  if (!db) return res.json({ notifications: [], unread: 0 });
  try {
    const snap = await db.collection('notifications').where('userId', '==', req.session.user.id).limit(50).get();
    const notifications = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id, type: d.type, fromUserId: d.fromUserId, fromUsername: d.fromUsername,
        fromAvatar: d.fromAvatar, postId: d.postId, replyId: d.replyId || null,
        text: d.text, read: d.read || false, createdAt: d.createdAt
      };
    }).sort((a, b) => (b.createdAt && b.createdAt._seconds || 0) - (a.createdAt && a.createdAt._seconds || 0));
    const unread = notifications.filter(n => !n.read).length;
    res.json({ notifications, unread });
  } catch (err) { res.json({ notifications: [], unread: 0 }); }
});

app.post('/api/notifications/read', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!db) return res.status(500).json({ error: 'БД' });
  try {
    const snap = await db.collection('notifications')
      .where('userId', '==', req.session.user.id)
      .where('read', '==', false)
      .get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.update(doc.ref, { read: true }));
    await batch.commit();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
});

/* WEBHOOK */
async function sendWebhook(content) {
  if (!process.env.DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
  } catch (err) {}
}

/* FALLBACK */
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('═══════════════════════════════════════');
    console.log(`🚀 ExecChecker на порту ${PORT}`);
    console.log('═══════════════════════════════════════');
  });
}

module.exports = app;