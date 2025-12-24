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

  // ================= STATE (ÚNICA FUENTE DE VERDAD) =================
  let state = {
    phase: "BLOCK",       // "BLOCK" | "RETRY" | "FINISHED"
    block: 0,
    index: 0,
    failed: [],
    correctCount: 0
  };

  let answered = false;

  // ================= DOM =================
  const questionEl = document.getElementById("question");
  const optionsEl = document.getElementById("options");
  const nextBtn = document.getElementById("nextBtn");
  const correctCountEl = document.getElementById("correctCount");

  // ================= FIRESTORE =================
  function saveProgress(user) {
    return db.collection("progress").doc(user.uid).set(state);
  }

  async function loadProgress(user) {
    const doc = await db.collection("progress").doc(user.uid).get();
    if (doc.exists) {
      state = doc.data();
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
      return state.failed;
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
    correctCountEl.textContent = state.correctCount;

    Object.entries(q.options).forEach(([letter, text]) => {
      const btn = document.createElement("button");
      btn.textContent = `${letter}) ${text}`;
      btn.onclick = (e) => answer(e, letter, q.correct);
      optionsEl.appendChild(btn);
    });
  }

  // ================= ANSWER =================
  function answer(event, selected, correct) {
    if (answered) return;
    answered = true;

    const buttons = optionsEl.querySelectorAll("button");
    buttons.forEach(btn => {
      btn.disabled = true;
      if (btn.textContent.startsWith(correct + ")")) {
        btn.classList.add("correct");
      }
    });

    if (selected === correct) {
      state.correctCount++;
      event.target.classList.add("correct");
    } else {
      event.target.classList.add("incorrect");
      state.failed.push({
        ...getQuestionsForState()[state.index],
        __failed: true
      });
    }

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
    }
    else if (state.phase === "RETRY") {
      state.phase = "BLOCK";
      state.block++;
      state.index = 0;
      state.failed = [];
    }

    // ¿Quedan bloques?
    const nextBlock = questions.slice(
      state.block * BLOCK_SIZE,
      (state.block + 1) * BLOCK_SIZE
    );

    if (nextBlock.length === 0) {
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
