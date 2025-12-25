// Inicialización de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBg6x6x0BS1m9ysIsk-ADAn0QM_8z0dddI",
  authDomain: "test-2026-d2d80.firebaseapp.com",
  projectId: "test-2026-d2d80",
  storageBucket: "test-2026-d2d80.firebasestorage.app",
  messagingSenderId: "711197555818",
  appId: "1:711197555818:web:76cc8993337e1085b09e13"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Variables para el control de la interfaz
const loginForm = document.getElementById("login"); // Formulario de login
const menu = document.getElementById("menu");
const test = document.getElementById("test");
const questionElement = document.getElementById("question");
const optionsElement = document.getElementById("options");
const nextButton = document.getElementById("nextBtn");
const backToMenuBtn = document.getElementById("backToMenuBtn");
const logoutBtnTest = document.getElementById("logoutBtnTest");
const logoutBtn = document.getElementById("logoutBtn");

// Variables globales para manejar las preguntas
let currentQuestion = 0;
let questions = []; // Aquí solo se declara una vez la variable `questions`

// Función para manejar el login
function handleLogin() {  // Cambié el nombre de la función a handleLogin para evitar conflicto
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  // Verificar que los campos de email y password no estén vacíos
  if (!email || !password) {
    alert("Por favor ingrese su correo electrónico y contraseña.");
    return;
  }

  // Iniciar sesión con Firebase
  auth.signInWithEmailAndPassword(email, password).then(() => {
    loginForm.style.display = "none";
    menu.style.display = "block";
    loadQuestions(); // Cargar preguntas al iniciar sesión
  }).catch((error) => {
    // Manejo de errores
    const errorMessage = error.message;
    document.getElementById("loginError").textContent = errorMessage;
    document.getElementById("loginError").style.display = "block";
  });
}

// Función para cargar las preguntas
function loadQuestions() {
  // Limpiar las preguntas previas y asegurarse de que el bloque de preguntas se muestre
  questions = [];
  test.style.display = "block";  // Asegurarnos de mostrar el bloque de preguntas

  db.collection("questions").get().then(snapshot => {
    snapshot.forEach(doc => {
      questions.push(doc.data()); // Guardar las preguntas en la variable `questions`
    });
    
    // Verificar si las preguntas fueron cargadas
    if (questions.length > 0) {
      showQuestion();  // Mostrar la primera pregunta si las preguntas existen
    } else {
      console.log("No se han cargado preguntas.");
    }
  }).catch(error => {
    console.error("Error al cargar las preguntas: ", error);
  });
}

// Función para mostrar la pregunta actual
function showQuestion() {
  if (currentQuestion < questions.length) {
    const question = questions[currentQuestion];
    questionElement.textContent = question.question;
    optionsElement.innerHTML = ''; // Limpiar las opciones previas

    question.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.textContent = option;
      button.classList.add('option');
      button.setAttribute('data-index', index);

      // Marcar la respuesta correcta
      if (index === question.correctAnswerIndex) {
        button.classList.add('correct');
      } else {
        button.classList.add('incorrect');
      }

      // Añadir el evento de selección de respuesta
      button.addEventListener('click', selectAnswer);
      optionsElement.appendChild(button);
    });
  }
}

// Función para manejar la selección de respuestas
function selectAnswer(event) {
  const selectedButton = event.target;
  const buttons = optionsElement.querySelectorAll('button');

  // Deshabilitar todos los botones
  buttons.forEach(button => button.disabled = true);

  // Si es la respuesta correcta, resaltar en blanco
  if (selectedButton.classList.contains('correct')) {
    selectedButton.style.color = '#FFFFFF'; // Cambiar el color a blanco puro
    selectedButton.style.borderColor = 'rgba(34, 193, 195, 1)'; // Cambiar borde a verde neón
    selectedButton.style.backgroundColor = 'rgba(59, 130, 246, 0.6)'; // Fondo azul brillante
    selectedButton.style.boxShadow = '0 0 8px rgba(34, 193, 195, 0.6)'; // Sombra verde
  }
  // Si es incorrecta, hacer lo mismo con el color rojo
  else {
    selectedButton.style.color = '#FFFFFF'; // Cambiar el color a blanco
    selectedButton.style.borderColor = 'rgba(239, 68, 68, 1)'; // Rojo intenso
    selectedButton.style.backgroundColor = 'rgba(239, 68, 68, 0.6)'; // Fondo rojo
    selectedButton.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.6)'; // Sombra roja
  }

  // Habilitar el botón siguiente
  nextButton.disabled = false;
}

// Función para avanzar a la siguiente pregunta
function nextQuestion() {
  currentQuestion++;
  if (currentQuestion < questions.length) {
    showQuestion();
  } else {
    test.style.display = "none";
    menu.style.display = "block";
    currentQuestion = 0;
  }
  nextButton.disabled = true; // Deshabilitar el siguiente botón hasta que se seleccione una respuesta
}

// Función para regresar al menú
function backToMenu() {
  test.style.display = "none";
  menu.style.display = "block";
  currentQuestion = 0;
}

// Función para cerrar sesión
function logout() {
  auth.signOut().then(() => {
    menu.style.display = "none";
    loginForm.style.display = "block";
  }).catch(error => {
    console.error("Error closing session: ", error);
  });
}

// Configurar eventos
backToMenuBtn.addEventListener('click', backToMenu);
logoutBtnTest.addEventListener('click', logout);
logoutBtn.addEventListener('click', logout);
nextButton.addEventListener('click', nextQuestion);

// Iniciar la app
auth.onAuthStateChanged(user => {
  if (user) {
    menu.style.display = "block";
    loginForm.style.display = "none";
    loadQuestions(); // Cargar preguntas cuando el usuario haya iniciado sesión
  } else {
    menu.style.display = "none";
    loginForm.style.display = "block";
  }
});
