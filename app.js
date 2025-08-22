// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyCTW1DbRaD0AruIRQ_Tn-e-bB8paTV4NNs",
  authDomain: "locateit-612c0.firebaseapp.com",
  projectId: "locateit-612c0",
  storageBucket: "locateit-612c0.firebasestorage.app",
  messagingSenderId: "1054365620372",
  appId: "1:1054365620372:web:401c55c834cbd9d4bdfc81",
  measurementId: "G-2CXE0EZ940"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// --- Login ---
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    alert("Error en login: " + err.message);
  }
}

function logout() {
  auth.signOut();
}

// --- Auth State ---
auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById("login-container").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    loadItems();
  } else {
    document.getElementById("login-container").classList.remove("hidden");
    document.getElementById("app").classList.add("hidden");
  }
});

// --- Cargar Items ---
async function loadItems() {
  const snapshot = await db.collection("items").get();
  const itemsContainer = document.getElementById("items");
  itemsContainer.innerHTML = "";
  snapshot.forEach(doc => {
    const item = doc.data();
    renderItem({ id: doc.id, ...item });
  });
}

// --- Agregar Item ---
async function addItem() {
  const name = document.getElementById("name").value;
  const desc = document.getElementById("desc").value;
  const stock = Number(document.getElementById("stock").value);
  const location = document.getElementById("location").value;
  const file = document.getElementById("image").files[0];

  let imageUrl = "";
  if (file) {
    const storageRef = storage.ref("images/" + file.name);
    await storageRef.put(file);
    imageUrl = await storageRef.getDownloadURL();
  }

  const docRef = await db.collection("items").add({ name, desc, stock, location, imageUrl });
  renderItem({ id: docRef.id, name, desc, stock, location, imageUrl });

  document.getElementById("name").value = "";
  document.getElementById("desc").value = "";
  document.getElementById("stock").value = "";
  document.getElementById("location").value = "";
  document.getElementById("image").value = "";
}

// --- Renderizar Item ---
function renderItem(item) {
  const container = document.getElementById("items");
  const card = document.createElement("div");
  card.className = "card";

  card.innerHTML = `
    <h2>${item.name}</h2>
    <p>${item.desc}</p>
    <p><b>Stock:</b> ${item.stock}</p>
    <p><b>Ubicación:</b> ${item.location}</p>
    ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}">` : ""}
    <canvas id="qr-${item.id}"></canvas>
    <svg id="barcode-${item.id}"></svg>
    ${item.stock < 5 ? `<p class='stock-low'>⚠ Stock bajo</p>` : ""}
    <button onclick="deleteItem('${item.id}', this)">Eliminar</button>
  `;

  container.appendChild(card);

  // Generar QR
  QRCode.toCanvas(document.getElementById(`qr-${item.id}`), item.id, { width: 100 });

  // Generar Código de barras
  JsBarcode(`#barcode-${item.id}`, item.id, { format: "CODE128", width: 1, height: 50 });
}

// --- Eliminar Item ---
async function deleteItem(id, btn) {
  await db.collection("items").doc(id).delete();
  btn.parentElement.remove();
}
