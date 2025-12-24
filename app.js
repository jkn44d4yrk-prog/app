document.addEventListener("DOMContentLoaded", () => {

  // ================= AUTH =================
  async function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      await auth.signInWithEmailAndPassword(email, password);
    } catch (e) {
      alert(e.message);
    }
  }

  async function register() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      await auth.createUserWithEmailAndPassword(email, password);
    } catch (e) {
      alert(e.message);
    }
  }

  window.login = login;
  window.register = register;

  // ================= CONFIG =================
  const BLOCK_SIZE = 10;

  // ================= STATE =================
  let state = {
    history: [],        // {questionId, selected, correct, date}
    attempts: {},       // {questionId: nIntentos}
  };

  let currentBlock = [];
  let currentIndex = 0;
  let currentMode = null;  // "NORMAL" | "FAILED" | "FIRST_OK"

  // ================= DOM =================
  const loginEl = document.getElementById("login");
  const menuEl = document.getElementById("menu");
  const testEl = document.getElementById("test");
  const questionEl = document.getElementById("question");
  const optionsEl = document.getElementById("options");
  const nextBtn = document.getElementById("nextBtn");
  const blockMsgEl = document.getElementById("blockMsg");

  // ================= HELPERS =================
  function normalizeState(loaded) {
    const safe = loaded && typeof loaded === "object" ? loaded : {};
    return {
      history: Array.isArray(safe.history) ? safe.history : [],
      attempts: safe.attempts && typeof safe.attempts === "object" ? safe.attempts : {},
    };
  }

  // Primer intento por pregunta (para % y para “acertadas a la primera” de verdad)
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

  // ================= FIRESTORE =================
  async function saveProgress(user) {
    try {
      await db.collection("progress").doc(user.uid).set(state);
    } catch (e) {
      console.error("Error saving progress:", e);
    }
  }

  async function loadProgress(user) {
    try {
      const doc = await db.collection("progress").doc(user.uid).get();
      if (doc.exists) {
        state = normalizeState(doc.data());
      } else {
        state = normalizeState(state);
      }
    } catch (e) {
      console.error("Error loading progress:", e);
      state = normalizeState(state);
    }
  }

  // ================= MENU =================
  function showMenu() {
    loginEl.style.display = "none";
    testEl.style.display = "none";
    blockMsgEl.style.display = "none";
    menuEl.style.display = "block";

    menuEl.innerHTML = "<h2>Selecciona un bloque</h2>";

    const numBlocks = Math.ceil(questions.length / BLOCK_SIZE);
    const first = getFirstAttemptsMap();

    for (let i = 0; i < numBlocks; i++) {
      const startIndex = i * BLOCK_SIZE;
      const start = startIndex + 1;
      const end = Math.min(startIndex + BLOCK_SIZE, questions.length);

      const blockQuestions = getBlockQuestions(startIndex);

      let correctCount = 0;     // correctas en el primer intento
      let failedCount = 0;       // falladas en el primer intento
      let firstOkCount = 0;      // igual que correctCount, pero lo dejamos explícito

      for (const q of blockQuestions) {
        const a = first.get(q.id);
        if (!a) continue;

        if (a.selected === a.correct) {
          correctCount++;
          firstOkCount++;
        } else {
          failedCount++;
        }
      }

      const percent = Math.round((correctCount / blockQuestions.length) * 100);

      const row = document.createElement("div");
      row.className = "block-row";

      // Botón principal del bloque
      const mainBtn = document.createElement("button");
      mainBtn.className = "block-main";
      mainBtn.textContent = `${start}-${end}`;
      mainBtn.onclick = () => startBlock(startIndex, "NORMAL");

      // Texto % + ratio
      const percentEl = document.createElement("span");
      percentEl.className = "block-percent";
      percentEl.textContent = `${correctCount}/${blockQuestions.length} (${percent}%)`;

      // Botón rehacer falladas del bloque
      const failedBtn = document.createElement("button");
      failedBtn.className = "block-mini";
      failedBtn.textContent = `Rehacer falladas (${failedCount})`;
      failedBtn.disabled = failedCount === 0;
      failedBtn.onclick = () => startBlock(startIndex, "FAILED");

      // Botón rehacer acertadas a la primera del bloque
      const firstOkBtn = document.createElement("button");
      firstOkBtn.className = "block-mini";
      firstOkBtn.textContent = `Rehacer acertadas (${firstOkCount})`;
      firstOkBtn.disabled = firstOkCount === 0;
      firstOkBtn.onclick = () => startBlock(startIndex, "FIRST_OK");

      row.appendChild(mainBtn);
      row.appendChild(percentEl);
      row.appendChild(failedBtn);
      row.appendChild(firstOkBtn);

      menuEl.appendChild(row);
    }
  }

  // ================= BLOQUE =================
  function startBlock(startIndex, mode) {
    menuEl.style.display = "none";
    testEl.style.display = "block";
    blockMsgEl.style.display = "none";
    currentIndex = 0;
    currentMode = mode;

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
      btn.textContent = `${letter}) ${text}`;
      btn.onclick = (e) => answer(e, letter, q.correct, q.id);
      optionsEl.appendChild(btn);
    });
  }

  function answer(event, selected, correct, qId) {
    optionsEl.querySelectorAll("button").forEach(btn => btn.disabled = true);

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

  // ================= AVANZAR =================
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

    loginEl.style.display = "none";
    await loadProgress(user);
    showMenu();
  });

});
