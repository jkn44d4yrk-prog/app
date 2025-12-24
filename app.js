document.addEventListener("DOMContentLoaded", () => {

  // 🔐 FORZAR PERSISTENCIA DE SESIÓN
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(err => {
      console.error("Error al establecer persistencia:", err);
    });

  // ===== LOGIN =====
  function register() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    auth.createUserWithEmailAndPassword(email, password)
      .catch(e => alert(e.message));
  }

  function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    auth.signInWithEmailAndPassword(email, password)
      .catch(e => alert(e.message));
  }

  window.register = register;
  window.login = login;

  // ===== TEST =====
  const BLOCK_SIZE = 30;

  let currentBlock = 0;
  let blockQuestions = [];
  let failedQuestions = [];
  let currentIndex = 0;

  let correctCount = 0;
  let answered = false;

  // ===== ELEMENTOS DOM =====
  const questionEl = document.getElementById("question");
  const optionsEl = document.getElementById("options");
  const nextBtn = document.getElementById("nextBtn");
  const correctCountEl = document.getElementById("correctCount");

  // ===== FIRESTORE =====
  function saveProgress(user) {
    return db.collection("progress").doc(user.uid).set({
      currentBlock,
      currentIndex,
      correctCount
    });
  }

  async function loadProgress(user) {
    const doc = await db.collection("progress").doc(user.uid).get();

    if (doc.exists) {
      const data = doc.data();
      currentBlock = data.currentBlock ?? 0;
      currentIndex = data.currentIndex ?? 0;
      correctCount = data.correctCount ?? 0;
      correctCountEl.textContent = correctCount;
    }
  }

  // ===== TEST LOGIC =====
  function loadBlock() {
    const start = currentBlock * BLOCK_SIZE;
    const end = start + BLOCK_SIZE;

    blockQuestions = questions.slice(start, end);
    failedQuestions = [];
    currentIndex = currentIndex || 0;

    if (blockQuestions.length === 0) {
      questionEl.textContent = "Cuestionario finalizado 🎉";
      optionsEl.innerHTML = "";
      nextBtn.style.display = "none";
      return;
    }

    loadQuestion();
  }

  function loadQuestion() {
    answered = false;
    nextBtn.disabled = true;
    optionsEl.innerHTML = "";

    const q = blockQuestions[currentIndex];
    questionEl.textContent = q.question;
    questionEl.style.color = q.__failed ? "red" : "black";

    Object.entries(q.options).forEach(([letter, text]) => {
      const btn = document.createElement("button");
      btn.textContent = `${letter}) ${text}`;
      btn.onclick = (e) => selectAnswer(e, letter, q.correct);
      optionsEl.appendChild(btn);
    });
  }

  function selectAnswer(event, selected, correct) {
    if (answered) return;
    answered = true;

    const clickedButton = event.target;
    const buttons = optionsEl.querySelectorAll("button");

    buttons.forEach(btn => {
      btn.disabled = true;
      if (btn.textContent.startsWith(correct + ")")) {
        btn.classList.add("correct");
      }
    });

    if (selected === correct) {
      clickedButton.classList.add("correct");
      correctCount++;
      correctCountEl.textContent = correctCount;
    } else {
      clickedButton.classList.add("incorrect");
      failedQuestions.push({
        ...blockQuestions[currentIndex],
        __failed: true
      });
    }

    nextBtn.disabled = false;
  }

  nextBtn.onclick = () => {
    currentIndex++;

    if (currentIndex < blockQuestions.length) {
      loadQuestion();
    } else {
      endBlock();
    }
  };

  async function endBlock() {
    const user = auth.currentUser;

    if (failedQuestions.length > 0) {
      blockQuestions = [...failedQuestions];
      failedQuestions = [];
      currentIndex = 0;
      loadQuestion();
    } else {
      currentBlock++;
      currentIndex = 0;

      if (user) await saveProgress(user);

      loadBlock();
    }
  }

  // ===== GUARDAR AL CERRAR =====
  window.addEventListener("beforeunload", () => {
    const user = auth.currentUser;
    if (user) saveProgress(user);
  });

  // ===== AUTH =====
  auth.onAuthStateChanged(async user => {
    if (!user) return;

    document.getElementById("login").style.display = "none";
    document.getElementById("test").style.display = "block";

    await loadProgress(user);
    loadBlock();
  });

});
