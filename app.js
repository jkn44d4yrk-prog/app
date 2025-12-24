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
    phase: "BLOCK",       // "BLOCK" | "RETRY" | "FINISHED"
    block: 0,
    index: 0,
    failed: [],           // Preguntas falladas para repasar
    attempts: {},         // { questionId: nIntentos }
    history: []           // [{questionId, selected, correct, date}]
  };

  let answered = false;

  // ================= DOM =================
  const questionEl = document.getElementById("question");
  const optionsEl = document.getElementById("options");
  const nextBtn = document.getElementById("nextBtn");

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

  // ================= STATE HELPERS =================
  function getQuestionsForState() {
    if (state.phase === "BLOCK") {
      const start = state.block * BLOCK_SIZE;
      const end = start + BLOCK_SIZE;
      return questions.slice(start, end);
    }

    if (state.phase === "RETRY") {
      // Priorizar preguntas con más intentos
      return state.failed.sort((a, b) => {
        return (state.attempts[b.id] || 0) - (state.attempts[a.id] || 0);
      }).slice(0, BLOCK_SIZE);
    }

    return [];
  }

  // ================= RENDER =================
  function loadQuestion() {
    if (state.phase === "FINISHED") {
      questionEl.textContent = "Cuestionario finalizado 🎉";
      optionsEl.innerHTML = "";
      nextBtn.style.display = "none";
      return;
    }

    const currentQuestions = getQuestionsForState();
    const q = currentQuestions[state.index];

    if (!q) {
      advanceState();
      return;
    }

    answered = false;
    nextBtn.disabled = true;
    optionsEl.innerHTML = "";

    questionEl.textContent = q.question;
    questionEl.style.color = q.__failed ? "red" : "black";

    Object.entries(q.options).forEach(([letter, text]) => {
      const btn = document.createElement("button");
      btn.textContent = `${letter}) ${text}`;
      btn.onclick = (e) => answer(e, letter, q.correct, q.id);
      optionsEl.appendChild(btn);
    });
  }

  // ================= ANSWER =================
  function answer(event, selected, correct, qId) {
    if (answered) return;
    answered = true;

    const buttons = optionsEl.querySelectorAll("button");
    buttons.forEach(btn => {
      btn.disabled = true;
      if (btn.textContent.startsWith(correct + ")")) {
        btn.classList.add("correct");
      }
    });

    if (selected !== correct) {
      event.target.classList.add("incorrect");

      // Añadir a failed si no está ya
      const currentQuestions = getQuestionsForState();
      const q = currentQuestions[state.index];
      if (!state.failed.find(f => f.id === q.id)) {
        state.failed.push({ ...q, __failed: true });
      }
    }

    // Registrar intentos
    state.attempts[qId] = (state.attempts[qId] || 0) + 1;

    // Registrar historial
    state.history.push({
      questionId: qId,
      selected,
      correct,
      date: new Date().toISOString()
    });

    nextBtn.disabled = false;
  }

  // ================= STATE MACHINE =================
  function advanceState() {
    const currentQuestions = getQuestionsForState();
    state.index++;

    // Aún quedan preguntas en este estado
    if (state.index < currentQuestions.length) {
      loadQuestion();
      return;
    }

    // Fin del estado actual
    if (state.phase === "BLOCK") {
      if (state.failed.length > 0) {
        state.phase = "RETRY";
        state.index = 0;
      } else {
        state.block++;
        state.index = 0;
      }
    } else if (state.phase === "RETRY") {
      state.phase = "BLOCK";
      state.block++;
      state.index = 0;
      state.failed = [];
    }

    // Comprobar si quedan bloques
    const nextBlock = questions.slice(
      state.block * BLOCK_SIZE,
      (state.block + 1) * BLOCK_SIZE
    );

    if (nextBlock.length === 0 && state.failed.length === 0) {
      state.phase = "FINISHED";
    }

    loadQuestion();
  }

  nextBtn.onclick = async () => {
    advanceState();
    const user = auth.currentUser;
    if (user) await saveProgress(user);
  };

  // ================= SAVE ON CLOSE =================
  window.addEventListener("beforeunload", () => {
    const user = auth.currentUser;
    if (user) saveProgress(user);
  });

  // ================= AUTH STATE =================
  auth.onAuthStateChanged(async user => {
    if (!user) {
      document.getElementById("login").style.display = "block";
      document.getElementById("test").style.display = "none";
      return;
    }

    document.getElementById("login").style.display = "none";
    document.getElementById("test").style.display = "block";

    await loadProgress(user);
    loadQuestion();
  });

});
