document.addEventListener("DOMContentLoaded", () => {

  // =================== SOLO TÚ ===================
  const ALLOWED_EMAIL = "robertobacallado@gmail.com"; // <-- pon tu email real

  function isAuthorized(user) {
    const userEmail = (user?.email || "").trim().toLowerCase();
    return userEmail !== "" && userEmail === ALLOWED_EMAIL.trim().toLowerCase();
  }
  // ==============================================

  // ================= DOM =================
  const loginEl = document.getElementById("login");
  const menuEl = document.getElementById("menu");
  const testEl = document.getElementById("test");
  const questionEl = document.getElementById("question");
  const optionsEl = document.getElementById("options");
  const nextBtn = document.getElementById("nextBtn");
  const blockMsgEl = document.getElementById("blockMsg");

  const backToMenuBtn = document.getElementById("backToMenuBtn");
  const logoutBtnTest = document.getElementById("logoutBtnTest");

  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const loginErrorEl = document.getElementById("loginError");

  // ================= CONFIG =================
  const BLOCK_SIZE = 10;

  // ================= STATE =================
  let state = { history: [], attempts: {} };
  let currentBlock = [];
  let currentIndex = 0;

  // ================= UI HELPERS =================
  function showLoginError(msg) {
    if (!loginErrorEl) return alert(msg);
    loginErrorEl.style.display = "block";
    loginErrorEl.textContent = msg;
  }
  function clearLoginError() {
    if (!loginErrorEl) return;
    loginErrorEl.style.display = "none";
    loginErrorEl.textContent = "";
  }

  // ================= HELPERS =================
  function normalizeState(loaded) {
    const safe = loaded && typeof loaded === "object" ? loaded : {};
    return {
      history: Array.isArray(safe.history) ? safe.history : [],
      attempts: safe.attempts && typeof safe.attempts === "object" ? safe.attempts : {},
    };
  }

  function getFirstAttemptsMap() {
    const first = new Map();
    for (const h of state.history) {
      if (!first.has(h.questionId)) first.set(h.questionId, h);
    }
    return first;
  }

  function getBlockQuestions(startIndex) {
    return questions.slice(startIndex, startIndex + BLOCK_SIZE);
  }

  function getQuestionsForMode(startIndex, mode) {
    const blockQs = getBlockQuestions(startIndex);
    const first = getFirstAttemptsMap();

    if (mode === "NORMAL") return blockQs;

    if (mode === "FAILED") {
      return blockQs.filter(q => {
        const a = first.get(q.id);
        return a && a.selected !== a.correct;
      });
    }

    if (mode === "FIRST_OK") {
      return blockQs.filter(q => {
        const a = first.get(q.id);
        return a && a.selected === a.correct;
      });
    }

    return [];
  }

  function resetBlockData(startIndex) {
    const blockQuestions = getBlockQuestions(startIndex);
    const ids = new Set(blockQuestions.map(q => q.id));

    state.history = state.history.filter(h => !ids.has(h.questionId));
    for (const id of ids) delete state.attempts[id];
  }

  // ================= FIRESTORE =================
  async function saveProgress(user) {
    try { await db.collection("progress").doc(user.uid).set(state); }
    catch (e) { console.error("Error saving progress:", e); }
  }

  async function loadProgress(user) {
    try {
      const doc = await db.collection("progress").doc(user.uid).get();
      state = doc.exists ? normalizeState(doc.data()) : normalizeState(state);
    } catch (e) {
      console.error("Error loading progress:", e);
      state = normalizeState(state);
    }
  }

  // ================= AUTH =================
  async function ensurePersistence() {
    const tries = [
      firebase.auth.Auth.Persistence.LOCAL,
      firebase.auth.Auth.Persistence.SESSION,
      firebase.auth.Auth.Persistence.NONE,
    ];
    for (const p of tries) {
      try { await auth.setPersistence(p); return; } catch (_) {}
    }
  }

  async function logout() {
    try { await auth.signOut(); } catch (e) { console.error(e); }
  }

  async function login() {
    clearLoginError();

    const email = (emailEl?.value || "").trim();
    const password = (passwordEl?.value || "");

    try {
      await ensurePersistence();
      const cred = await auth.signInWithEmailAndPassword(email, password);

      if (!isAuthorized(cred.user)) {
        console.warn("No autorizado. Email logueado:", cred.user?.email);
        await auth.signOut();
        showLoginError("No autorizado.");
      }
    } catch (e) {
      console.error(e);
      showLoginError(e.message || "No se pudo iniciar sesión.");
    }
  }

  window.login = login;

  if (logoutBtnTest) logoutBtnTest.onclick = logout;

  [emailEl, passwordEl].filter(Boolean).forEach(el => {
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") login();
    });
  });

  // ================= MENU =================
  function renderMenuTopbar() {
    const top = document.createElement("div");
    top.className = "menu-topbar";

    const h2 = document.createElement("h2");
    h2.textContent = "Selecciona un bloque";

    const logoutBtn = document.createElement("button");
    logoutBtn.id = "logoutBtn";
    logoutBtn.type = "button";
    logoutBtn.textContent = "Cerrar sesión";
    logoutBtn.onclick = logout;

    top.appendChild(h2);
    top.appendChild(logoutBtn);
    return top;
  }

  function showMenu() {
    loginEl.style.display = "none";
    testEl.style.display = "none";
    blockMsgEl.style.display = "none";
    menuEl.style.display = "block";

    menuEl.innerHTML = "";
    menuEl.appendChild(renderMenuTopbar());

    const numBlocks = Math.ceil(questions.length / BLOCK_SIZE);
    const first = getFirstAttemptsMap();

    for (let i = 0; i < numBlocks; i++) {
      const startIndex = i * BLOCK_SIZE;
      const start = startIndex + 1;
      const end = Math.min(startIndex + BLOCK_SIZE, questions.length);

      const blockQuestions = getBlockQuestions(startIndex);

      let correctCount = 0;
      let failedCount = 0;
      let answeredCount = 0;

      for (const q of blockQuestions) {
        const a = first.get(q.id);
        if (!a) continue;
        answeredCount++;
        if (a.selected === a.correct) correctCount++;
        else failedCount++;
      }

      const percent = Math.round((correctCount / blockQuestions.length) * 100);

      const row = document.createElement("div");
      row.className = "block-row";

      const mainBtn = document.createElement("button");
      mainBtn.className = "block-main";
      mainBtn.textContent = `${start}-${end}`;
      mainBtn.onclick = () => startBlock(startIndex, "NORMAL");

      const percentEl = document.createElement("span");
      percentEl.className = "block-percent";
      percentEl.textContent = `${correctCount}/${blockQuestions.length} (${percent}%)`;

      if (answeredCount === 0) percentEl.classList.add("pct-none");
      else if (percent >= 80) percentEl.classList.add("pct-good");
      else if (percent >= 50) percentEl.classList.add("pct-mid");
      else percentEl.classList.add("pct-bad");

      const failedBtn = document.createElement("button");
      failedBtn.className = "block-mini";
      failedBtn.textContent = `Rehacer falladas (${failedCount})`;
      failedBtn.disabled = failedCount === 0;
      failedBtn.onclick = () => startBlock(startIndex, "FAILED");

      const firstOkBtn = document.createElement("button");
      firstOkBtn.className = "block-mini";
      firstOkBtn.textContent = `Rehacer acertadas (${correctCount})`;
      firstOkBtn.disabled = correctCount === 0;
      firstOkBtn.onclick = () => startBlock(startIndex, "FIRST_OK");

      const resetBtn = document.createElement("button");
      resetBtn.className = "block-reset";
      resetBtn.textContent = "Reset";
      resetBtn.disabled = answeredCount === 0;
      resetBtn.onclick = async () => {
        const ok = confirm(`¿Resetear el bloque ${start}-${end} a 0 y empezarlo de nuevo?`);
        if (!ok) return;

        resetBlockData(startIndex);

        const u = auth.currentUser;
        if (u) await saveProgress(u);

        startBlock(startIndex, "NORMAL");
      };

      row.appendChild(mainBtn);
      row.appendChild(percentEl);
      row.appendChild(failedBtn);
      row.appendChild(firstOkBtn);
      row.appendChild(resetBtn);

      menuEl.appendChild(row);
    }
  }

  // ================= TEST =================
  function startBlock(startIndex, mode) {
    menuEl.style.display = "none";
    testEl.style.display = "block";
    blockMsgEl.style.display = "none";
    currentIndex = 0;

    currentBlock = getQuestionsForMode(startIndex, mode);

    if (currentBlock.length === 0) {
      alert("No hay preguntas para este bloque.");
      showMenu();
      return;
    }

    loadQuestion();
  }

  function loadQuestion() {
    const q = currentBlock[currentIndex];
    questionEl.textContent = q.question;
    optionsEl.innerHTML = "";
    nextBtn.disabled = true;

    Object.entries(q.options).forEach(([letter, text]) => {
      const btn = document.createElement("button");
      btn.dataset.letter = letter;
      btn.textContent = `${letter}) ${text}`;
      btn.onclick = (e) => answer(e, letter, q.correct, q.id);
      optionsEl.appendChild(btn);
    });
  }

  function answer(event, selected, correct, qId) {
    const buttons = optionsEl.querySelectorAll("button");
    buttons.forEach(btn => btn.disabled = true);

    // Correcta en verde
    buttons.forEach(btn => {
      if (btn.dataset.letter === correct) btn.classList.add("correct");
    });

    // Pulsada: verde si acierta, rojo si falla
    if (selected === correct) event.target.classList.add("correct");
    else event.target.classList.add("incorrect");

    state.history.push({
      questionId: qId,
      selected,
      correct,
      date: new Date().toISOString()
    });

    state.attempts[qId] = (state.attempts[qId] || 0) + 1;

    nextBtn.disabled = false;
  }

  if (backToMenuBtn) {
    backToMenuBtn.onclick = async () => {
      const user = auth.currentUser;
      if (user) await saveProgress(user);
      showMenu();
    };
  }

  nextBtn.onclick = async () => {
    currentIndex++;

    if (currentIndex >= currentBlock.length) {
      testEl.style.display = "none";
      blockMsgEl.style.display = "block";
      blockMsgEl.innerHTML = `
        <h2>BLOQUE SUPERADO 🎉</h2>
        <button id="continueBtn">Continuar</button>
      `;
      document.getElementById("continueBtn").onclick = showMenu;
    } else {
      loadQuestion();
    }

    const user = auth.currentUser;
    if (user) await saveProgress(user);
  };

  // ================= AUTH STATE =================
  auth.onAuthStateChanged(async user => {
    if (!user) {
      loginEl.style.display = "block";
      testEl.style.display = "none";
      menuEl.style.display = "none";
      blockMsgEl.style.display = "none";
      return;
    }

    if (!isAuthorized(user)) {
      console.warn("Sesión no autorizada:", user?.email);
      await auth.signOut();
      showLoginError("No autorizado.");
      return;
    }

    loginEl.style.display = "none";
    await loadProgress(user);
    showMenu();
  });

});
