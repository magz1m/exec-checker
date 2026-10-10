require('dotenv').config();
const express = require('express');
const session = require('express-session');
const fetch = require('node-fetch');
const path = require('path');

/* ============================================================
   FIREBASE INIT (через отдельные переменные окружения)
============================================================ */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
};

initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

const app = express();
const PORT = process.env.PORT || 3000;
const OWNER_ID = process.env.OWNER_DISCORD_ID;

/* ============================================================
   MIDDLEWARE
============================================================ */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Раздаём статику из public
app.use(express.static(path.join(__dirname, 'public')));

/* ============================================================
   AUTH — Discord OAuth
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
    if (!tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      throw new Error('No access token');
    }

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const discordUser = await userRes.json();

    const userRef = db.collection('users').doc(discordUser.id);
    const userDoc = await userRef.get();

    let userData;
    if (userDoc.exists) {
      userData = userDoc.data();
      await userRef.update({
        username: discordUser.username,
        avatar: discordUser.avatar
      });
    } else {
      const isOwner = discordUser.id === OWNER_ID;
      userData = {
        discordId: discordUser.id,
        username: discordUser.username,
        avatar: discordUser.avatar,
        role: isOwner ? 'OWNER' : 'USER',
        coins: isOwner ? 999999 : 0,
        purchasedFrames: [],
        purchasedColors: [],
        usedPromos: [],
        createdAt: FieldValue.serverTimestamp()
      };
      await userRef.set(userData);
      sendWebhook(`🎉 Новый пользователь: **${discordUser.username}** (\`${discordUser.id}\`)`);
    }

    req.session.userId = discordUser.id;
    req.session.user = {
      id: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,
      role: userData.role,
      coins: userData.coins || 0
    };

    res.redirect('/');
  } catch (err) {
    console.error('OAuth error:', err);
    res.redirect('/?error=oauth_failed');
  }
});

app.get('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.user) return res.json({ loggedIn: false });

  try {
    const userDoc = await db.collection('users').doc(req.session.user.id).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      req.session.user.coins = data.coins || 0;
      req.session.user.role = data.role || 'USER';
      req.session.user.purchasedFrames = data.purchasedFrames || [];
      req.session.user.purchasedColors = data.purchasedColors || [];
    }
  } catch (err) {
    console.error('Me error:', err);
  }

  res.json({ loggedIn: true, user: req.session.user });
});

/* ============================================================
   ПРОМОКОДЫ
============================================================ */
app.post('/api/promo/activate', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Сначала войди через Discord' });
  }

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
      if (userData.usedPromos && userData.usedPromos.includes(code)) {
        throw new Error('ALREADY_USED');
      }

      const promo = promoDoc.data();
      if (promo.used) throw new Error('USED');

      t.update(promoRef, {
        used: true,
        usedBy: req.session.user.id,
        usedAt: FieldValue.serverTimestamp()
      });
      t.update(userRef, {
        coins: FieldValue.increment(promo.coins),
        usedPromos: FieldValue.arrayUnion(code)
      });

      return {
        coins: promo.coins,
        newBalance: (userData.coins || 0) + promo.coins
      };
    });

    req.session.user.coins = result.newBalance;
    sendWebhook(`🎁 **${req.session.user.username}** активировал промокод \`${code}\` и получил **${result.coins} монет**!`);

    res.json({ success: true, coins: result.coins, newBalance: result.newBalance });
  } catch (err) {
    const map = {
      'INVALID': { code: 404, msg: 'Неверный код' },
      'ALREADY_USED': { code: 400, msg: 'Ты уже использовал этот код' },
      'USED': { code: 400, msg: 'Код уже использован' }
    };
    const e = map[err.message];
    if (e) return res.status(e.code).json({ error: e.msg });
    console.error('Promo error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ============================================================
   СТАТИСТИКА
============================================================ */
app.get('/api/stats', async (req, res) => {
  try {
    const usersSnap = await db.collection('users').count().get();
    res.json({
      users: usersSnap.data().count,
      online: Math.floor(Math.random() * 30) + 15
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.json({ users: 0, online: 20 });
  }
});

/* ============================================================
   ПРОФИЛЬ
============================================================ */
app.get('/api/user/:id', async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.params.id).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Пользователь не найден' });

    const data = userDoc.data();
    res.json({
      discordId: data.discordId,
      username: data.username,
      avatar: data.avatar,
      role: data.role,
      coins: data.coins,
      purchasedFrames: data.purchasedFrames || [],
      purchasedColors: data.purchasedColors || [],
      createdAt: data.createdAt
    });
  } catch (err) {
    console.error('User error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ============================================================
   ХЕЛПЕР: WEBHOOK
============================================================ */
async function sendWebhook(content) {
  if (!process.env.DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
  } catch (err) {
    console.error('Webhook error:', err);
  }
}

/* ============================================================
   FALLBACK — отдаём index.html для всех остальных путей
============================================================ */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ============================================================
   СТАРТ (локально)
============================================================ */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('═══════════════════════════════════════');
    console.log(`🚀 ExecChecker запущен!`);
    console.log(`🌐 Открой: http://localhost:${PORT}`);
    console.log(`👑 Владелец: ${OWNER_ID}`);
    console.log(`🔧 Режим: ${process.env.NODE_ENV || 'development'}`);
    console.log('═══════════════════════════════════════');
  });
}

module.exports = app;