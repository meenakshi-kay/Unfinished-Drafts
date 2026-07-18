function isOwner() {
  return localStorage.getItem('drafts-owner') === 'yes';
}

function applyOwnerUI() {
  const link = document.getElementById('write-nav-link');
  if (link) link.style.display = isOwner() ? 'inline-block' : 'none';
}

// ---------- storage (Firestore) ----------
// db and WRITE_PASSCODE come from firebase-config.js, loaded before this file.

async function getPosts() {
  try {
    const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error('Could not load posts', e);
    return [];
  }
}

async function addPost(post) {
  const docRef = await db.collection('posts').add(post);
  return docRef.id;
}

async function deletePost(id) {
  await db.collection('posts').doc(id).delete();
}

function excerptFromHtml(html, maxLen = 160) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = (div.textContent || '').trim();
  return text.length > maxLen ? text.slice(0, maxLen).trim() + '\u2026' : text;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ---------- homepage ----------
async function renderDrawer() {
  const drawer = document.getElementById('drawer');
  const empty = document.getElementById('empty-state');
  if (!drawer) return;

  drawer.innerHTML = '<p style="color:rgba(243,238,226,0.5); font-family:\'Space Mono\',monospace; font-size:13px;">Loading the drawer&hellip;</p>';

  const posts = await getPosts();

  if (posts.length === 0) {
    drawer.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';
  drawer.style.display = 'grid';
  drawer.innerHTML = '';

  posts.forEach((post, i) => {
    const tilt = (i % 2 === 0 ? -1 : 1) * (1 + (i % 3));
    const card = document.createElement('a');
    card.href = `post.html?id=${post.id}`;
    card.className = 'card';
    card.style.setProperty('--tilt', `${tilt}deg`);
    const deleteBtn = isOwner()
      ? `<button type="button" class="card-delete" data-id="${post.id}" title="Delete entry" aria-label="Delete entry">&times;</button>`
      : '';
    card.innerHTML = `
      ${deleteBtn}
      <div class="call-number">Entry No. ${String(posts.length - i).padStart(3, '0')}</div>
      <h3>${escapeHtml(post.title)}</h3>
      <p class="excerpt">${escapeHtml(post.excerpt)}</p>
      <div class="stamp-mini">Filed ${formatDate(post.createdAt)}</div>
    `;
    drawer.appendChild(card);
  });

  if (isOwner()) {
    drawer.querySelectorAll('.card-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (confirm('Delete this entry for good? There\'s no undo.')) {
          await deletePost(id);
          renderDrawer();
        }
      });
    });
  }
}

// ---------- post view ----------
async function renderPostView() {
  const container = document.getElementById('post-view');
  if (!container) return;
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  container.innerHTML = '<p class="post-meta">Loading&hellip;</p>';

  let post = null;
  try {
    const doc = await db.collection('posts').doc(id).get();
    if (doc.exists) post = { id: doc.id, ...doc.data() };
  } catch (e) {
    console.error('Could not load entry', e);
  }

  if (!post) {
    container.innerHTML = `
      <p class="post-meta">Not in the catalog</p>
      <h1>This entry wandered off</h1>
      <p style="margin-top:16px;">Nothing's filed under that number. It may have been deleted, or the link's off.</p>
      <a href="index.html" class="btn btn-ghost" style="margin-top:20px;">Back to the drawer</a>
    `;
    return;
  }

  const deleteBtn = isOwner()
    ? `<button class="btn btn-ghost" id="delete-post">Delete entry</button>`
    : '';

  container.innerHTML = `
    <p class="post-meta">Entry filed ${formatDate(post.createdAt)}</p>
    <h1>${escapeHtml(post.title)}</h1>
    <div class="post-body">${post.content}</div>
    <div style="margin-top:34px; display:flex; gap:12px;">
      <a href="index.html" class="btn btn-ghost">Back to the drawer</a>
      ${deleteBtn}
    </div>
  `;

  if (isOwner()) {
    document.getElementById('delete-post').addEventListener('click', async () => {
      if (confirm('Delete this entry for good? There\'s no undo.')) {
        await deletePost(id);
        window.location.href = 'index.html';
      }
    });
  }
}

// ---------- write page passcode gate ----------
function initWriteGate() {
  const gate = document.getElementById('write-gate');
  const notebookWrap = document.getElementById('notebook-wrap');
  if (!gate || !notebookWrap) return;

  if (isOwner()) {
    gate.style.display = 'none';
    notebookWrap.style.display = 'block';
    initEditor();
    return;
  }

  const input = document.getElementById('gate-input');
  const btn = document.getElementById('gate-btn');
  const error = document.getElementById('gate-error');

  function tryUnlock() {
    if (input.value === WRITE_PASSCODE) {
      localStorage.setItem('drafts-owner', 'yes');
      gate.style.display = 'none';
      notebookWrap.style.display = 'block';
      applyOwnerUI();
      initEditor();
    } else {
      error.textContent = "That's not it. Try again.";
      input.value = '';
      input.focus();
    }
  }

  btn.addEventListener('click', tryUnlock);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
}

// ---------- editor ----------
const PROMPTS = [
  "What's the first sentence of the article that snagged you?",
  "What tangent did this send you down?",
  "Would you have believed this fact a week ago?",
  "Who would you tell about this, and why them?",
  "What does this have nothing to do with, that you're about to connect it to anyway?"
];

const ENCOURAGEMENTS = [
  "that's a start.",
  "keep going, you're onto something.",
  "this is shaping up.",
  "good, don't stop to fix it yet.",
  "the tangent is allowed. lean into it.",
  "this is more than most people write in a week."
];

function initEditor() {
  const editor = document.getElementById('editor');
  if (!editor || editor.dataset.initialized) return;
  editor.dataset.initialized = 'true';

  const titleInput = document.getElementById('title-input');
  const promptLine = document.getElementById('prompt-line');
  const wordCount = document.getElementById('word-count');
  const encourage = document.getElementById('encourage');
  const stamp = document.getElementById('stamp');
  const publishBtn = document.getElementById('publish-btn');

  promptLine.textContent = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];

  let lastMilestone = 0;

  function updateWordCount() {
    const text = editor.textContent.trim();
    const words = text.length ? text.split(/\s+/).length : 0;
    wordCount.textContent = `${words} word${words === 1 ? '' : 's'}`;

    const milestones = [30, 75, 150, 300, 500];
    const hit = milestones.filter(m => words >= m).pop();
    if (hit && hit !== lastMilestone) {
      lastMilestone = hit;
      encourage.textContent = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    } else if (words === 0) {
      encourage.textContent = '';
    }
  }

  editor.addEventListener('input', updateWordCount);
  updateWordCount();

  document.querySelectorAll('.toolbar button[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      const value = btn.getAttribute('data-value') || undefined;
      editor.focus();
      document.execCommand(cmd, false, value);
    });
  });

  publishBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const content = editor.innerHTML.trim();
    const plainText = editor.textContent.trim();

    if (!title) {
      titleInput.focus();
      titleInput.style.borderBottomColor = '#a8442f';
      return;
    }
    if (!plainText) {
      editor.focus();
      return;
    }

    publishBtn.disabled = true;
    publishBtn.textContent = 'Filing...';

    const post = {
      title,
      content,
      excerpt: excerptFromHtml(content),
      createdAt: new Date().toISOString()
    };

    try {
      const id = await addPost(post);
      stamp.textContent = 'Filed';
      stamp.classList.add('filed');
      setTimeout(() => {
        window.location.href = `post.html?id=${id}`;
      }, 550);
    } catch (e) {
      console.error('Could not publish', e);
      publishBtn.disabled = false;
      publishBtn.textContent = 'File this entry';
      alert("Couldn't file this entry -- check your Firebase setup in firebase-config.js.");
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyOwnerUI();
  renderDrawer();
  renderPostView();
  initWriteGate();
});
