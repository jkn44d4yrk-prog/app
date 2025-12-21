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
const BLOCK_SIZE = 30;

let currentBlock = 0;
let blockQuestions = [];
let failedQuestions = [];
let currentIndex = 0;

let correctCount = 0;
let answered = false;

const questionEl = document.getElementById("question");
const optionsEl = document.getElementById("options");
const nextBtn = document.getElementById("nextBtn");
const correctCountEl = document.getElementById("correctCount");

function loadBlock() {
  const start = currentBlock * BLOCK_SIZE;
  const end = start + BLOCK_SIZE;

  blockQuestions = questions.slice(start, end);
  failedQuestions = [];
  currentIndex = 0;

  if (blockQuestions.length === 0) {
    questionEl.textContent = "Cuestionario finalizado 🎉";
    questionEl.style.color = "black";
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
  if (answered) return;      // 🔒 BLOQUEO REAL
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

function endBlock() {
  if (failedQuestions.length > 0) {
    blockQuestions = [...failedQuestions];
    failedQuestions = [];
    currentIndex = 0;
    loadQuestion();
  } else {
    currentBlock++;
    loadBlock();
  }
}

loadBlock();
auth.onAuthStateChanged(user => {
  if (!user) return;

  document.getElementById("login").style.display = "none";
  document.getElementById("test").style.display = "block";
});
