document.addEventListener("DOMContentLoaded", () => {

  // ===== LOGIN =====
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

  // ===== TEST =====
  const BLOCK_SIZE = 30;

  let currentBlock = 0;
  let blockQuestions = [];
  let failedQuestions = [];
  let currentIndex = 0;
  let hasFailed = false;

  let correctCount = 0;
  let answered = false;

  // ===== DOM =====
  const questionEl = document.getElementById("question");
  const optionsEl = document.getElementById("options");
  const nextBtn = document.getElementById("nextBtn");
  const correctCountEl = document.getElementById("correctCount");

  // ===== FIRESTORE =====
  function saveProgress(user) {
    return db.collection("progress").doc(user.uid).set({
      currentBlock,
      currentIndex,
      correctCount,
      hasFailed
    });
  }

  async function loadProgress(user) {
    const doc = await db.collection("progress").doc(user.uid).get();

    if (doc.exists) {
      const data = doc.data();
      currentBlock = data.currentBlock ?? 0;
      currentIndex = data.currentIndex ?? 0;
      correctCount = data.correctCount ?? 0;
      hasFailed = data.hasFailed ?? false;
      correctCountEl.textContent = correctCount;
    }
  }

  // ===== TEST LOGIC =====
  function loadBlock() {
    const start = currentBlock * BLOCK_SIZE;
    const end = start + BLOCK_SIZE;

    blockQuestions = questions.slice(start, end);

    if (!hasFailed) {
      failedQuestions = [];
    }

    if (currentIndex < 0 || currentIndex >= blockQuestions.length) {
      currentIndex = 0;
    }

    if (blockQuestions.length === 0) {
      questionEl.textContent = "Cuestionario finalizado 🎉";
      optionsEl.innerHTML = "";
      nextBtn.style.display = "none";
      return;
    }

    loadQuestion();
  }

  function loadQuestion() {
    const q = blockQuestions[currentIndex];

    if (!q) {
      console.error("Pregunta inválida", currentIndex, blockQuestions);
      currentIndex = 0;
      loadQuestion();
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
      hasFailed = true;
    }

    nextBtn.disabled = false;
  }

  nextBtn.onclick = async () => {
    currentIndex++;

    const user = auth.currentUser;
    if (user) await saveProgress(user);

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
      hasFailed = true;
      loadQuestion();
    } else {
      currentBlock++;
      currentIndex = 0;
      hasFailed = false;

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
    if (!user) {
      document.getElementById("login").style.display = "block";
      document.getElementById("test").style.display = "none";
      return;
    }

    document.getElementById("login").style.display = "none";
    document.getElementById("test").style.display = "block";

    await loadProgress(user);
    loadBlock();
  });

});
