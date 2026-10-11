require('dotenv').config();
const express = require('express');
const session = require('express-session');
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
    console.log('📦 FIREBASE_SERVICE_ACCOUNT_JSON (локальный режим)');
  } catch (e) { console.error('❌ Ошибка парсинга:', e.message); }
}
if (!serviceAccount) {
  serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  };
  console.log('☁️ Отдельные переменные (Vercel)');
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

/* MIDDLEWARE */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

/* ============================================================
   ПРАВА
============================================================ */
function canModerate(role) { return ['OWNER', 'ADMIN', 'SENIOR_MODERATOR', 'MODERATOR'].includes(role); }
function canPostNews(role) { return ['OWNER', 'ADMIN', 'SENIOR_MODERATOR'].includes(role); }
function isAdmin(role) { return ['OWNER', 'ADMIN'].includes(role); }

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
      sendWebhook(`🎉 Новый: **${discordUser.username}** (\`${discordUser.id}\`)`);
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
    if (!db) return res.json({ users: 0, online: 20 });
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
    res.json({
      discordId: data.discordId,
      username: data.username,
      avatar: data.avatar,
      role: data.role,
      coins: data.coins,
      purchasedFrames: data.purchasedFrames || [],
      purchasedColors: data.purchasedColors || []
    });
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
});

/* ============================================================
   @MENTIONS — парсинг и создание уведомлений
============================================================ */
async function processMentions(text, fromUser, postId, replyId = null) {
  if (!db) return [];
  const matches = text.match(/@([a-zA-Z0-9_.]+)/g) || [];
  if (matches.length === 0) return [];
  const usernames = [...new Set(matches.map(m => m.substring(1).toLowerCase()))];
  const mentionedIds = [];

  for (const uname of usernames) {
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
        text: `упомянул тебя в ${replyId ? 'ответе' : 'посте'}`,
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
      mentionedIds.push(targetId);
    } catch (e) { console.error('Mention error:', e); }
  }
  return mentionedIds;
}

/* ============================================================
   ФОРУМ — список постов (с поиском и сортировкой)
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
      return {
        id: doc.id,
        authorId: d.authorId,
        authorUsername: d.authorUsername,
        authorAvatar: d.authorAvatar,
        authorRole: d.authorRole || 'USER',
        category: d.category,
        title: d.title,
        content: d.content,
        likes: (d.likes || []).length,
        likedByMe: req.session.user ? (d.likes || []).includes(req.session.user.id) : false,
        replyCount: d.replyCount || 0,
        views: d.views || 0,
        pinned: d.pinned || false,
        editedAt: d.editedAt || null,
        createdAt: d.createdAt
      };
    });

    // Фильтр категории
    if (category !== 'all') posts = posts.filter(p => p.category === category);

    // Поиск
    if (search) {
      posts = posts.filter(p =>
        (p.title || '').toLowerCase().includes(search) ||
        (p.content || '').toLowerCase().includes(search) ||
        (p.authorUsername || '').toLowerCase().includes(search)
      );
    }

    // Сортировка
    if (sort === 'new') {
      posts.sort((a, b) => (b.createdAt?._seconds || 0) - (a.createdAt?._seconds || 0));
    } else if (sort === 'top') {
      posts.sort((a, b) => b.likes - a.likes);
    } else if (sort === 'discussed') {
      posts.sort((a, b) => b.replyCount - a.replyCount);
    } else if (sort === 'views') {
      posts.sort((a, b) => b.views - a.views);
    }

    // Закреплённые — всегда сверху
    posts.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    res.json({ posts });
  } catch (err) {
    console.error('Posts list error:', err);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/* ============================================================
   ФОРУМ — один пост + ответы (+views++)
============================================================ */
app.get('/api/posts/:id', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'БД' });
  try {
    const postRef = db.collection('posts').doc(req.params.id);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Не найден' });
    const post = postDoc.data();

    // ++ просмотр (не автору)
    if (!req.session.user || req.session.user.id !== post.authorId) {
      try { await postRef.update({ views: FieldValue.increment(1) }); } catch (e) {}
    }

    const repliesSnap = await db.collection('replies').where('postId', '==', req.params.id).limit(500).get();
    const replies = repliesSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        authorId: d.authorId,
        authorUsername: d.authorUsername,
        authorAvatar: d.authorAvatar,
        authorRole: d.authorRole || 'USER',
        content: d.content,
        likes: (d.likes || []).length,
        likedByMe: req.session.user ? (d.likes || []).includes(req.session.user.id) : false,
        editedAt: d.editedAt || null,
        createdAt: d.createdAt
      };
    }).sort((a, b) => (a.createdAt?._seconds || 0) - (b.createdAt?._seconds || 0));

    res.json({
      post: {
        id: postDoc.id,
        authorId: post.authorId,
        authorUsername: post.authorUsername,
        authorAvatar: post.authorAvatar,
        authorRole: post.authorRole || 'USER',
        category: post.category,
        title: post.title,
        content: post.content,
        likes: (post.likes || []).length,
        likedByMe: req.session.user ? (post.likes || []).includes(req.session.user.id) : false,
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

/* ============================================================
   ФОРУМ — создать пост
============================================================ */
app.post('/api/posts', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!db) return res.status(500).json({ error: 'БД' });

  const { title, content, category } = req.body;
  if (!title || !content || !category) return res.status(400).json({ error: 'Заполни всё' });
  if (title.length > 150) return res.status(400).json({ error: 'Заголовок длинный' });
  if (content.length > 5000) return res.status(400).json({ error: 'Текст длинный' });

  const allowed = ['news', 'help', 'discussion', 'bugs'];
  if (!allowed.includes(category)) return res.status(400).json({ error: 'Раздел' });

  if (category === 'news' && !canPostNews(req.session.user.role)) {
    return res.status(403).json({ error: 'Нет прав' });
  }

  try {
    const postRef = await db.collection('posts').add({
      authorId: req.session.user.id,
      authorUsername: req.session.user.username,
      authorAvatar: req.session.user.avatar,
      authorRole: req.session.user.role,
      category,
      title,
      content,
      likes: [],
      replyCount: 0,
      views: 0,
      pinned: false,
      createdAt: FieldValue.serverTimestamp()
    });

    // @mentions
    await processMentions(content, req.session.user, postRef.id);

    sendWebhook(`📝 **${req.session.user.username}** создал пост «${title}» в /${category}`);
    res.json({ success: true, id: postRef.id });
  } catch (err) {
    console.error('Post create error:', err);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/* ============================================================
   ФОРУМ — редактировать пост
============================================================ */
app.post('/api/posts/:id/edit', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!db) return res.status(500).json({ error: 'БД' });

  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Заполни всё' });
  if (title.length > 150) return res.status(400).json({ error: 'Заголовок длинный' });
  if (content.length > 5000) return res.status(400).json({ error: 'Текст длинный' });

  try {
    const postRef = db.collection('posts').doc(req.params.id);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Не найден' });

    const isAuthor = postDoc.data().authorId === req.session.user.id;
    const isMod = canModerate(req.session.user.role);
    if (!isAuthor && !isMod) return res.status(403).json({ error: 'Нет прав' });

    await postRef.update({
      title,
      content,
      editedAt: FieldValue.serverTimestamp()
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Post edit error:', err);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/* ============================================================
   ФОРУМ — закрепить / открепить
============================================================ */
app.post('/api/posts/:id/pin', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!isAdmin(req.session.user.role)) return res.status(403).json({ error: 'Только админ/владелец' });
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

/* ============================================================
   ФОРУМ — ответить
============================================================ */
app.post('/api/posts/:id/replies', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!db) return res.status(500).json({ error: 'БД' });

  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Пусто' });
  if (content.length > 2000) return res.status(400).json({ error: 'Длинно' });

  try {
    const postDoc = await db.collection('posts').doc(req.params.id).get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Пост не найден' });

    const replyRef = await db.collection('replies').add({
      postId: req.params.id,
      authorId: req.session.user.id,
      authorUsername: req.session.user.username,
      authorAvatar: req.session.user.avatar,
      authorRole: req.session.user.role,
      content,
      likes: [],
      createdAt: FieldValue.serverTimestamp()
    });

    await db.collection('posts').doc(req.params.id).update({
      replyCount: FieldValue.increment(1)
    });

    // Уведомление автору поста
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
        text: `ответил на твой пост «${postData.title}»`,
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
    }

    // @mentions
    await processMentions(content, req.session.user, req.params.id, replyRef.id);

    res.json({ success: true, id: replyRef.id });
  } catch (err) {
    console.error('Reply error:', err);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/* ============================================================
   ФОРУМ — редактировать ответ
============================================================ */
app.post('/api/replies/:id/edit', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!db) return res.status(500).json({ error: 'БД' });

  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Пусто' });
  if (content.length > 2000) return res.status(400).json({ error: 'Длинно' });

  try {
    const replyRef = db.collection('replies').doc(req.params.id);
    const replyDoc = await replyRef.get();
    if (!replyDoc.exists) return res.status(404).json({ error: 'Не найден' });

    const isAuthor = replyDoc.data().authorId === req.session.user.id;
    const isMod = canModerate(req.session.user.role);
    if (!isAuthor && !isMod) return res.status(403).json({ error: 'Нет прав' });

    await replyRef.update({ content, editedAt: FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
});

/* ============================================================
   ЛАЙКИ
============================================================ */
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

    if (likes.includes(userId)) {
      await postRef.update({ likes: FieldValue.arrayRemove(userId) });
      res.json({ success: true, liked: false, count: likes.length - 1 });
    } else {
      await postRef.update({ likes: FieldValue.arrayUnion(userId) });
      // Уведомление автору
      if (postData.authorId !== userId) {
        await db.collection('notifications').add({
          userId: postData.authorId,
          type: 'like_post',
          fromUserId: userId,
          fromUsername: req.session.user.username,
          fromAvatar: req.session.user.avatar,
          postId: req.params.id,
          text: `лайкнул твой пост «${postData.title}»`,
          read: false,
          createdAt: FieldValue.serverTimestamp()
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

    if (likes.includes(userId)) {
      await replyRef.update({ likes: FieldValue.arrayRemove(userId) });
      res.json({ success: true, liked: false, count: likes.length - 1 });
    } else {
      await replyRef.update({ likes: FieldValue.arrayUnion(userId) });
      if (replyData.authorId !== userId) {
        await db.collection('notifications').add({
          userId: replyData.authorId,
          type: 'like_reply',
          fromUserId: userId,
          fromUsername: req.session.user.username,
          fromAvatar: req.session.user.avatar,
          postId: replyData.postId,
          replyId: req.params.id,
          text: `лайкнул твой ответ`,
          read: false,
          createdAt: FieldValue.serverTimestamp()
        });
      }
      res.json({ success: true, liked: true, count: likes.length + 1 });
    }
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
});

/* ============================================================
   УДАЛЕНИЕ
============================================================ */
app.delete('/api/posts/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Войди' });
  if (!db) return res.status(500).json({ error: 'БД' });
  try {
    const postRef = db.collection('posts').doc(req.params.id);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Не найден' });

    const isAuthor = postDoc.data().authorId === req.session.user.id;
    const isMod = canModerate(req.session.user.role);
    if (!isAuthor && !isMod) return res.status(403).json({ error: 'Нет прав' });

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
    const isMod = canModerate(req.session.user.role);
    if (!isAuthor && !isMod) return res.status(403).json({ error: 'Нет прав' });

    const postId = replyDoc.data().postId;
    await replyRef.delete();
    await db.collection('posts').doc(postId).update({ replyCount: FieldValue.increment(-1) });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка' }); }
});

/* ============================================================
   УВЕДОМЛЕНИЯ
============================================================ */
app.get('/api/notifications', async (req, res) => {
  if (!req.session.user) return res.json({ notifications: [], unread: 0 });
  if (!db) return res.json({ notifications: [], unread: 0 });
  try {
    const snap = await db.collection('notifications')
      .where('userId', '==', req.session.user.id)
      .limit(50)
      .get();

    let notifications = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        type: d.type,
        fromUserId: d.fromUserId,
        fromUsername: d.fromUsername,
        fromAvatar: d.fromAvatar,
        postId: d.postId,
        replyId: d.replyId || null,
        text: d.text,
        read: d.read || false,
        createdAt: d.createdAt
      };
    }).sort((a, b) => (b.createdAt?._seconds || 0) - (a.createdAt?._seconds || 0));

    const unread = notifications.filter(n => !n.read).length;
    res.json({ notifications, unread });
  } catch (err) {
    console.error('Notifications error:', err);
    res.json({ notifications: [], unread: 0 });
  }
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
    console.log(`🚀 ExecChecker запущен на порту ${PORT}`);
    console.log('═══════════════════════════════════════');
  });
}

module.exports = app;