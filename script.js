// ---------- storage (Firestore) ----------
// db and WRITE_PASSCODE come from firebase-config.js, loaded before this file.

function isOwner() {
  return localStorage.getItem('drafts-owner') === 'yes';
}

function applyOwnerUI() {
  const writeLink = document.getElementById('write-nav-link');
  const inboxLink = document.getElementById('inbox-nav-link');
  if (writeLink) writeLink.style.display = isOwner() ? 'inline-block' : 'none';
  if (inboxLink) inboxLink.style.display = isOwner() ? 'inline-block' : 'none';
}

async function getPosts() {
  try {
    const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error('Could not load posts', e);
    return [];
  }
}

async function getPostById(id) {
  try {
    const doc = await db.collection('posts').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch (e) {
    console.error('Could not load entry', e);
    return null;
  }
}

async function addPost(post) {
  const docRef = await db.collection('posts').add(post);
  return docRef.id;
}

async function updatePost(id, data) {
  await db.collection('posts').doc(id).update(data);
}

async function deletePost(id) {
  await db.collection('posts').doc(id).delete();
}

async function getSubmissions() {
  try {
    const snapshot = await db.collection('submissions').orderBy('submittedAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error('Could not load submissions', e);
    return [];
  }
}

async function addSubmission(sub) {
  await db.collection('submissions').add(sub);
}

async function deleteSubmission(id) {
  await db.collection('submissions').doc(id).delete();
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
    const authorLine = post.author
      ? `<p class="card-author">by ${escapeHtml(post.author)}</p>`
      : '';
    const previewText = post.description && post.description.trim()
      ? post.description
      : post.excerpt;

    card.innerHTML = `
      ${deleteBtn}
      <div class="call-number">Entry No. ${String(posts.length - i).padStart(3, '0')}</div>
      <h3>${escapeHtml(post.title)}</h3>
      ${authorLine}
      <p class="excerpt">${escapeHtml(previewText)}</p>
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

  const post = await getPostById(id);

  if (!post) {
    container.innerHTML = `
      <p class="post-meta">Not in the catalog</p>
      <h1>This entry wandered off</h1>
      <p style="margin-top:16px;">Nothing's filed under that number. It may have been deleted, or the link's off.</p>
      <a href="index.html" class="btn btn-outline-ink" style="margin-top:20px;">Back to the drawer</a>
    `;
    return;
  }

  const authorLine = post.author
    ? `<p class="post-author">by ${escapeHtml(post.author)}</p>`
    : '';
  const editBtn = isOwner()
    ? `<a href="write.html?id=${post.id}" class="btn btn-outline-ink">Edit</a>`
    : '';
  const deleteBtn = isOwner()
    ? `<button class="btn btn-outline-danger" id="delete-post">Delete entry</button>`
    : '';

  container.innerHTML = `
    <p class="post-meta">Entry filed ${formatDate(post.createdAt)}</p>
    <h1>${escapeHtml(post.title)}</h1>
    ${authorLine}
    <div class="post-body">${post.content}</div>
    <div style="margin-top:34px; display:flex; gap:12px; flex-wrap:wrap;">
      <a href="index.html" class="btn btn-outline-ink">Back to the drawer</a>
      ${editBtn}
      ${deleteBtn}
    </div>
  `;

  if (isOwner()) {
    const delBtn = document.getElementById('delete-post');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (confirm('Delete this entry for good? There\'s no undo.')) {
          await deletePost(id);
          window.location.href = 'index.html';
        }
      });
    }
  }
}

// ---------- passcode gate (shared by write.html and inbox.html) ----------
function initWriteGate() {
  const gate = document.getElementById('write-gate');
  if (!gate) return;

  const notebookWrap = document.getElementById('notebook-wrap');
  const inboxList = document.getElementById('inbox-list');

  function reveal() {
    gate.style.display = 'none';
    applyOwnerUI();
    if (notebookWrap) { notebookWrap.style.display = 'block'; initEditor(); }
    if (inboxList) { inboxList.style.display = 'block'; loadInbox(); }
  }

  if (isOwner()) {
    reveal();
    return;
  }

  const input = document.getElementById('gate-input');
  const btn = document.getElementById('gate-btn');
  const error = document.getElementById('gate-error');

  function tryUnlock() {
    if (input.value === WRITE_PASSCODE) {
      localStorage.setItem('drafts-owner', 'yes');
      reveal();
    } else {
      error.textContent = "That's not it. Try again.";
      input.value = '';
      input.focus();
    }
  }

  btn.addEventListener('click', tryUnlock);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
}

// ---------- inbox (owner-only review of public submissions) ----------
async function loadInbox() {
  const list = document.getElementById('inbox-list');
  if (!list) return;

  list.innerHTML = '<p class="inbox-empty">Checking the box&hellip;</p>';
  const subs = await getSubmissions();

  if (subs.length === 0) {
    list.innerHTML = '<p class="inbox-empty">Nothing waiting right now.</p>';
    return;
  }

  list.innerHTML = '';
  subs.forEach(sub => {
    const item = document.createElement('div');
    item.className = 'inbox-item';
    const authorLine = sub.authorName
      ? `<p class="post-author">from ${escapeHtml(sub.authorName)}</p>`
      : `<p class="post-author">from Anonymous</p>`;
    item.innerHTML = `
      <p class="post-meta">Sent in ${formatDate(sub.submittedAt)}</p>
      <h3>${escapeHtml(sub.title)}</h3>
      ${authorLine}
      <div class="inbox-body">${sub.content}</div>
      <div style="display:flex; gap:12px;">
        <button class="btn btn-primary" data-action="publish" data-id="${sub.id}">Publish to the drawer</button>
        <button class="btn btn-outline-danger" data-action="discard" data-id="${sub.id}">Discard</button>
      </div>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('button[data-action="publish"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sub = subs.find(s => s.id === btn.getAttribute('data-id'));
      if (!sub) return;
      const post = {
        title: sub.title,
        content: sub.content,
        author: sub.authorName ? sub.authorName : 'Anonymous',
        description: '',
        excerpt: excerptFromHtml(sub.content),
        createdAt: new Date().toISOString()
      };
      await addPost(post);
      await deleteSubmission(sub.id);
      loadInbox();
    });
  });

  list.querySelectorAll('button[data-action="discard"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Discard this submission for good?')) {
        await deleteSubmission(btn.getAttribute('data-id'));
        loadInbox();
      }
    });
  });
}

// ---------- editor (shared by write.html and submit.html) ----------
const PROMPTS = [
  "What tangent did this send you down?",
  "Would you have believed this fact a week ago?",
  "Who would you tell about this, and why them?"
];

const ENCOURAGEMENTS = [
  "that's a start.",
  "keep going, you're onto something.",
  "this is shaping up.",
  "good, don't stop to fix it yet.",
  "the tangent is allowed. lean into it."
];

async function initEditor() {
  const editor = document.getElementById('editor');
  if (!editor || editor.dataset.initialized) return;
  editor.dataset.initialized = 'true';

  const titleInput = document.getElementById('title-input');
  const authorInput = document.getElementById('author-input');
  const descriptionInput = document.getElementById('description-input');
  const promptLine = document.getElementById('prompt-line');
  const wordCount = document.getElementById('word-count');
  const encourage = document.getElementById('encourage');
  const stamp = document.getElementById('stamp');
  const publishBtn = document.getElementById('publish-btn');
  const submitBtn = document.getElementById('submit-btn');
  const actionBtn = publishBtn || submitBtn;
  const isSubmissionPage = !!submitBtn;

  if (promptLine && !promptLine.textContent.includes('hidden box')) {
    promptLine.textContent = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  }

  // ---- edit mode: if a post id is in the URL, load it for editing ----
  let editingPostId = null;
  if (!isSubmissionPage) {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      const existing = await getPostById(id);
      if (existing) {
        editingPostId = id;
        titleInput.value = existing.title || '';
        if (authorInput) authorInput.value = existing.author || '';
        if (descriptionInput) descriptionInput.value = existing.description || '';
        editor.innerHTML = existing.content || '';
        if (actionBtn) actionBtn.textContent = 'Save changes';
        if (stamp) { stamp.textContent = 'Filed'; stamp.classList.add('filed'); }
      }
    }
  }

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

  actionBtn.addEventListener('click', async () => {
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

    actionBtn.disabled = true;

    if (isSubmissionPage) {
      actionBtn.textContent = 'Sending...';
      const sub = {
        title,
        authorName: authorInput ? authorInput.value.trim() : '',
        content,
        submittedAt: new Date().toISOString()
      };
      try {
        await addSubmission(sub);
        if (stamp) { stamp.textContent = 'Sent'; stamp.classList.add('filed'); }
        titleInput.value = '';
        if (authorInput) authorInput.value = '';
        editor.innerHTML = '';
        updateWordCount();
        actionBtn.textContent = 'Sent — send another?';
        actionBtn.disabled = false;
      } catch (e) {
        console.error('Could not submit', e);
        actionBtn.disabled = false;
        actionBtn.textContent = 'Send it in';
        alert("Couldn't send this in -- check the Firebase setup.");
      }
      return;
    }

    actionBtn.textContent = editingPostId ? 'Saving...' : 'Filing...';

    const postData = {
      title,
      content,
      author: authorInput ? authorInput.value.trim() : '',
      description: descriptionInput ? descriptionInput.value.trim() : '',
      excerpt: excerptFromHtml(content)
    };

    try {
      let id = editingPostId;
      if (editingPostId) {
        await updatePost(editingPostId, postData);
      } else {
        postData.createdAt = new Date().toISOString();
        id = await addPost(postData);
      }
      if (stamp) { stamp.textContent = editingPostId ? 'Updated' : 'Filed'; stamp.classList.add('filed'); }
      setTimeout(() => {
        window.location.href = `post.html?id=${id}`;
      }, 550);
    } catch (e) {
      console.error('Could not save', e);
      actionBtn.disabled = false;
      actionBtn.textContent = editingPostId ? 'Save changes' : 'File this entry';
      alert("Couldn't save this entry. Check your Firebase setup in firebase-config.js.");
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyOwnerUI();
  renderDrawer();
  renderPostView();
  initWriteGate();

  // submit.html has no gate, so the editor initializes right away
  if (document.getElementById('submit-btn')) {
    initEditor();
  }
});
