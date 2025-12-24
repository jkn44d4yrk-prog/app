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

  let currentBlock = [];  // preguntas actuales del bloque
  let currentIndex = 0;
  let currentMode = null;  // "NORMAL" | "FAILED" | "FIRST_OK"

  // ================= DOM =================
  const loginEl = document.getElementById("login");
  const menuEl = document.getElementById("menu");
  const testEl = document.getElementById("test");
  const questionEl = document.getElementById("question");
  const optionsEl = document.getElementById("options");
  const nextBtn = document.getElementById("nextBtn");
  const blockMsgEl = document.getElementById("blockMsg"); // pantalla "BLOQUE SUPERADO"

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
        state = doc.data();
      }
    } catch (e) {
      console.error("Error loading progress:", e);
    }
  }

  // ================= MENU =================
  function showMenu() {
    loginEl.style.display = "none";
    testEl.style.display = "none";
    blockMsgEl.style.display = "none";
    menuEl.style.display = "block";
    menuEl.innerHTML = "<h2>Selecciona un bloque</h2>";

    // Generar botones de bloques
    const numBlocks = Math.ceil(questions.length / BLOCK_SIZE);
    for (let i = 0; i < numBlocks; i++) {
      const start = i * BLOCK_SIZE + 1;
      const end = Math.min((i + 1) * BLOCK_SIZE, questions.length);

      // Calcular porcentaje acertado en el bloque (primera respuesta correcta)
      const blockQuestions = questions.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE);
      let correctCount = 0;
      blockQuestions.forEach(q => {
        const firstAttempt = state.history.find(h => h.questionId === q.id);
        if (firstAttempt && firstAttempt.selected === firstAttempt.correct) {
          correctCount++;
        }
      });
      const percent = Math.round((correctCount / blockQuestions.length) * 100);

      const btn = document.createElement("button");
      btn.textContent = `${start}-${end} (${percent}%)`;
      btn.onclick = () => startBlock(i * BLOCK_SIZE, "NORMAL");
      menuEl.appendChild(btn);
    }

    menuEl.appendChild(document.createElement("br"));

    // Botón de repaso de falladas
    const failedBtn = document.createElement("button");
    failedBtn.textContent = "Responder preguntas falladas";
    failedBtn.onclick = () => startBlock(0, "FAILED");
    menuEl.appendChild(failedBtn);

    menuEl.appendChild(document.createElement("br"));

    // Botón de repaso de aciertos a la primera
    const firstOkBtn = document.createElement("button");
    firstOkBtn.textContent = "Responder preguntas acertadas a la primera";
    firstOkBtn.onclick = () => startBlock(0, "FIRST_OK");
    menuEl.appendChild(firstOkBtn);
  }

  // ================= BLOQUE =================
  function startBlock(startIndex, mode) {
    menuEl.style.display = "none";
    testEl.style.display = "block";
    blockMsgEl.style.display = "none";
    currentIndex = 0;
    currentMode = mode;

    if (mode === "NORMAL") {
      currentBlock = questions.slice(startIndex, startIndex + BLOCK_SIZE);
    } else if (mode === "FAILED") {
      const failedQuestions = state.history
        .filter(h => h.selected !== h.correct)
        .map(h => questions.find(q => q.id === h.questionId))
        .filter(q => q != null);
      currentBlock = failedQuestions.slice(0, BLOCK_SIZE);
    } else if (mode === "FIRST_OK") {
      const okQuestions = state.history
        .filter(h => h.selected === h.correct)
        .map(h => questions.find(q => q.id === h.questionId))
        .filter(q => q != null);
      currentBlock = okQuestions.slice(0, BLOCK_SIZE);
    }

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
    // Deshabilitar botones
    optionsEl.querySelectorAll("button").forEach(btn => btn.disabled = true);

    // Colores
    if (selected === correct) event.target.classList.add("correct");
    else event.target.classList.add("incorrect");

    // Registrar historial
    state.history.push({
      questionId: qId,
      selected,
      correct,
      date: new Date().toISOString()
    });

    // Registrar intentos
    state.attempts[qId] = (state.attempts[qId] || 0) + 1;

    nextBtn.disabled = false;
  }

  // ================= AVANZAR =================
  nextBtn.onclick = async () => {
    currentIndex++;
    if (currentIndex >= currentBlock.length) {
      // BLOQUE SUPERADO
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
