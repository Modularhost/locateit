import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, connectFirestoreEmulator, updateDoc, arrayUnion, arrayRemove } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyCTW1DbRaD0AruIRQ_Tn-e-bB8paTV4NNs",
    authDomain: "locateit-612c0.firebaseapp.com",
    projectId: "locateit-612c0",
    storageBucket: "locateit-612c0.firebasestorage.app",
    messagingSenderId: "1054365620372",
    appId: "1:1054365620372:web:401c55c834cbd9d4bdfc81",
    measurementId: "G-2CXE0EZ940"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

if (location.hostname === 'localhost') {
    try {
        connectFirestoreEmulator(db, 'localhost', 8080);
    } catch (error) {
        console.log('Emulador no disponible, usando Firebase en producción');
    }
}

window.db = db;
window.setDoc = setDoc;
window.getDoc = getDoc;
window.getDocs = getDocs;
window.deleteDoc = deleteDoc;
window.collection = collection;
window.doc = doc;
window.onSnapshot = onSnapshot;

console.log('Firebase inicializado correctamente');

let currentView = 'croquis';
let currentPage = 1;
let currentCatalogPage = 1;
const itemsPerPage = 10;
const maxItemsPerCasilla = 20;
let allItems = [];
let filteredItems = [];
let allCatalog = [];
let filteredCatalog = [];
let currentCasilla = null;
let selectedItems = new Set();
let sortField = 'code';
let sortDirection = 'asc';
let catalogSortField = 'code';
let catalogSortDirection = 'asc';
let warehouseConfig = {
    pasillos: 4,
    aisleConfigs: Array(4).fill().map(() => ({ estantes: 4, casillas: 6 }))
};
let layoutConfig = {
    aisles: []
};
let selectedAisle = null;

document.addEventListener('DOMContentLoaded', async function() {
    await loadWarehouseConfig();
    await loadLayoutConfig();
    updateAisleConfigs();
    updateLayoutConfigs();
    await loadItems();
    await loadCatalog();
    generateWarehouse();
    drawWarehouseLayout();
    updateItemsTable();
    updateCatalogTable();
    updateLocationSelectors();
    setupEventListeners();
    showNotification('Sistema iniciado correctamente');
});

function setupEventListeners() {
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', switchView);
    });

    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('itemsSearchInput').addEventListener('input', handleItemsSearch);
    document.getElementById('catalogSearchInput').addEventListener('input', handleCatalogSearch);
    
    document.addEventListener('click', function(event) {
        const searchContainer = document.querySelector('.search-container');
        const suggestions = document.getElementById('searchSuggestions');
        if (searchContainer && suggestions && !searchContainer.contains(event.target)) {
            suggestions.classList.add('hidden');
        }
    });

    const canvas = document.getElementById('warehouseCanvas');
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousemove', handleCanvasHover);
}

async function loadLayoutConfig() {
    try {
        const layoutDoc = await getDoc(doc(db, 'config', 'layout'));
        if (layoutDoc.exists()) {
            layoutConfig = layoutDoc.data();
            if (!Array.isArray(layoutConfig.aisles)) {
                layoutConfig.aisles = Array(warehouseConfig.pasillos).fill().map((_, index) => ({
                    id: index + 1,
                    x: 50 + index * 120,
                    y: 50,
                    width: 50,
                    height: 200,
                    orientation: 'vertical'
                }));
                await saveLayoutConfig();
            }
        } else {
            layoutConfig = {
                aisles: Array(warehouseConfig.pasillos).fill().map((_, index) => ({
                    id: index + 1,
                    x: 50 + index * 120,
                    y: 50,
                    width: 50,
                    height: 200,
                    orientation: index % 2 === 0 ? 'vertical' : 'horizontal'
                }))
            };
            await saveLayoutConfig();
        }
    } catch (error) {
        console.error('Error al cargar configuración de disposición:', error);
        layoutConfig = {
            aisles: Array(warehouseConfig.pasillos).fill().map((_, index) => ({
                id: index + 1,
                x: 50 + index * 120,
                y: 50,
                width: 50,
                height: 200,
                orientation: index % 2 === 0 ? 'vertical' : 'horizontal'
            }))
        };
        await saveLayoutConfig();
    }
}

async function saveLayoutConfig() {
    try {
        await setDoc(doc(db, 'config', 'layout'), layoutConfig);
    } catch (error) {
        console.error('Error al guardar configuración de disposición:', error);
    }
}

function drawWarehouseLayout() {
    const canvas = document.getElementById('warehouseCanvas');
    const ctx = canvas.getContext('2d');

    // Ajustar el tamaño del canvas al contenedor
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = 600 * window.devicePixelRatio; // Aumentamos la altura para más espacio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Limpiar el canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dibujar pasillos
    layoutConfig.aisles.forEach(aisle => {
        const itemCount = allItems.filter(item => item.location.startsWith(`${aisle.id}-`)).length;
        ctx.fillStyle = itemCount > 0 ? '#e3f2fd' : '#ffffff';
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;

        // Ajustar dimensiones según orientación
        const width = aisle.orientation === 'vertical' ? aisle.width : aisle.height;
        const height = aisle.orientation === 'vertical' ? aisle.height : aisle.width;

        // Dibujar rectángulo del pasillo
        ctx.fillRect(aisle.x, aisle.y, width, height);
        ctx.strokeRect(aisle.x, aisle.y, width, height);

        // Texto del pasillo
        ctx.fillStyle = '#2c3e50';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textX = aisle.x + width / 2;
        const textY = aisle.y + height / 2;

        // Rotar texto si es horizontal
        if (aisle.orientation === 'horizontal') {
            ctx.save();
            ctx.translate(textX, textY);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(`Pasillo ${aisle.id} (${itemCount})`, 0, 0);
            ctx.restore();
        } else {
            ctx.fillText(`Pasillo ${aisle.id} (${itemCount})`, textX, textY);
        }
    });
}

function handleCanvasClick(event) {
    const canvas = document.getElementById('warehouseCanvas');
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width) / window.devicePixelRatio;
    const y = (event.clientY - rect.top) * (canvas.height / rect.height) / window.devicePixelRatio;

    const clickedAisle = layoutConfig.aisles.find(aisle => {
        const width = aisle.orientation === 'vertical' ? aisle.width : aisle.height;
        const height = aisle.orientation === 'vertical' ? aisle.height : aisle.width;
        return x >= aisle.x && x <= aisle.x + width &&
               y >= aisle.y && y <= aisle.y + height;
    });

    if (clickedAisle) {
        selectedAisle = clickedAisle.id;
        switchView({ target: { dataset: { view: 'mapa' } } });
        generateWarehouse();
    }
}

function handleCanvasHover(event) {
    const canvas = document.getElementById('warehouseCanvas');
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width) / window.devicePixelRatio;
    const y = (event.clientY - rect.top) * (canvas.height / rect.height) / window.devicePixelRatio;

    const hoveredAisle = layoutConfig.aisles.find(aisle => {
        const width = aisle.orientation === 'vertical' ? aisle.width : aisle.height;
        const height = aisle.orientation === 'vertical' ? aisle.height : aisle.width;
        return x >= aisle.x && x <= aisle.x + width &&
               y >= aisle.y && y <= aisle.y + height;
    });

    canvas.style.cursor = hoveredAisle ? 'pointer' : 'default';
    drawWarehouseLayout();
    if (hoveredAisle) {
        const ctx = canvas.getContext('2d');
        const width = hoveredAisle.orientation === 'vertical' ? hoveredAisle.width : hoveredAisle.height;
        const height = hoveredAisle.orientation === 'vertical' ? hoveredAisle.height : hoveredAisle.width;
        ctx.fillStyle = 'rgba(0, 123, 255, 0.2)';
        ctx.fillRect(hoveredAisle.x, hoveredAisle.y, width, height);
        ctx.fillStyle = '#2c3e50';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textX = hoveredAisle.x + width / 2;
        const textY = hoveredAisle.y + height / 2;
        if (hoveredAisle.orientation === 'horizontal') {
            ctx.save();
            ctx.translate(textX, textY);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(`Pasillo ${hoveredAisle.id} (${allItems.filter(item => item.location.startsWith(`${hoveredAisle.id}-`)).length})`, 0, 0);
            ctx.restore();
        } else {
            ctx.fillText(`Pasillo ${hoveredAisle.id} (${allItems.filter(item => item.location.startsWith(`${hoveredAisle.id}-`)).length})`, textX, textY);
        }
    }
}

function updateLayoutConfigs() {
    const pasillos = parseInt(document.getElementById('pasillosInput').value) || 4;
    const layoutConfigsDiv = document.getElementById('layoutConfigs');
    layoutConfigsDiv.innerHTML = '';

    if (!Array.isArray(layoutConfig.aisles)) {
        layoutConfig.aisles = Array(pasillos).fill().map((_, index) => ({
            id: index + 1,
            x: 50 + index * 120,
            y: 50,
            width: 50,
            height: 200,
            orientation: index % 2 === 0 ? 'vertical' : 'horizontal'
        }));
    } else if (layoutConfig.aisles.length > pasillos) {
        layoutConfig.aisles = layoutConfig.aisles.slice(0, pasillos);
    } else {
        while (layoutConfig.aisles.length < pasillos) {
            layoutConfig.aisles.push({
                id: layoutConfig.aisles.length + 1,
                x: 50 + layoutConfig.aisles.length * 120,
                y: 50,
                width: 50,
                height: 200,
                orientation: layoutConfig.aisles.length % 2 === 0 ? 'vertical' : 'horizontal'
            });
        }
    }

    for (let p = 1; p <= pasillos; p++) {
        const layoutDiv = document.createElement('div');
        layoutDiv.className = 'aisle-config';
        
        const header = document.createElement('h3');
        header.textContent = `Disposición Pasillo ${p}`;
        layoutDiv.appendChild(header);

        const xGroup = document.createElement('div');
        xGroup.className = 'config-group';
        const xLabel = document.createElement('label');
        xLabel.className = 'config-label';
        xLabel.textContent = 'Posición X';
        const xInput = document.createElement('input');
        xInput.type = 'number';
        xInput.className = 'config-input';
        xInput.value = layoutConfig.aisles[p-1].x || 50;
        xInput.min = 0;
        xInput.max = 1000; // Límite para evitar desbordes
        xInput.onchange = () => {
            layoutConfig.aisles[p-1].x = parseInt(xInput.value) || 50;
        };
        xGroup.appendChild(xLabel);
        xGroup.appendChild(xInput);
        layoutDiv.appendChild(xGroup);

        const yGroup = document.createElement('div');
        yGroup.className = 'config-group';
        const yLabel = document.createElement('label');
        yLabel.className = 'config-label';
        yLabel.textContent = 'Posición Y';
        const yInput = document.createElement('input');
        yInput.type = 'number';
        yInput.className = 'config-input';
        yInput.value = layoutConfig.aisles[p-1].y || 50;
        yInput.min = 0;
        yInput.max = 600; // Límite según altura del canvas
        yInput.onchange = () => {
            layoutConfig.aisles[p-1].y = parseInt(yInput.value) || 50;
        };
        yGroup.appendChild(yLabel);
        yGroup.appendChild(yInput);
        layoutDiv.appendChild(yGroup);

        const widthGroup = document.createElement('div');
        widthGroup.className = 'config-group';
        const widthLabel = document.createElement('label');
        widthLabel.className = 'config-label';
        widthLabel.textContent = 'Ancho';
        const widthInput = document.createElement('input');
        widthInput.type = 'number';
        widthInput.className = 'config-input';
        widthInput.value = layoutConfig.aisles[p-1].width || 50;
        widthInput.min = 20;
        widthInput.max = 300;
        widthInput.onchange = () => {
            layoutConfig.aisles[p-1].width = parseInt(widthInput.value) || 50;
        };
        widthGroup.appendChild(widthLabel);
        widthGroup.appendChild(widthInput);
        layoutDiv.appendChild(widthGroup);

        const heightGroup = document.createElement('div');
        heightGroup.className = 'config-group';
        const heightLabel = document.createElement('label');
        heightLabel.className = 'config-label';
        heightLabel.textContent = 'Alto';
        const heightInput = document.createElement('input');
        heightInput.type = 'number';
        heightInput.className = 'config-input';
        heightInput.value = layoutConfig.aisles[p-1].height || 200;
        heightInput.min = 20;
        heightInput.max = 300;
        heightInput.onchange = () => {
            layoutConfig.aisles[p-1].height = parseInt(heightInput.value) || 200;
        };
        heightGroup.appendChild(heightLabel);
        heightGroup.appendChild(heightInput);
        layoutDiv.appendChild(heightGroup);

        const orientationGroup = document.createElement('div');
        orientationGroup.className = 'config-group';
        const orientationLabel = document.createElement('label');
        orientationLabel.className = 'config-label';
        orientationLabel.textContent = 'Orientación';
        const orientationSelect = document.createElement('select');
        orientationSelect.className = 'config-input';
        orientationSelect.innerHTML = `
            <option value="vertical" ${layoutConfig.aisles[p-1].orientation === 'vertical' ? 'selected' : ''}>Vertical</option>
            <option value="horizontal" ${layoutConfig.aisles[p-1].orientation === 'horizontal' ? 'selected' : ''}>Horizontal</option>
        `;
        orientationSelect.onchange = () => {
            layoutConfig.aisles[p-1].orientation = orientationSelect.value;
            // Intercambiar ancho y alto al cambiar orientación
            const temp = layoutConfig.aisles[p-1].width;
            layoutConfig.aisles[p-1].width = layoutConfig.aisles[p-1].height;
            layoutConfig.aisles[p-1].height = temp;
            widthInput.value = layoutConfig.aisles[p-1].width;
            heightInput.value = layoutConfig.aisles[p-1].height;
            drawWarehouseLayout();
        };
        orientationGroup.appendChild(orientationLabel);
        orientationGroup.appendChild(orientationSelect);
        layoutDiv.appendChild(orientationGroup);

        layoutConfigsDiv.appendChild(layoutDiv);
    }
}

// Resto del código permanece igual
function switchView(e) {
    const view = e.target.dataset.view;
    currentView = view;

    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    document.querySelectorAll('[id$="-view"]').forEach(viewEl => {
        viewEl.classList.add('hidden');
    });
    document.getElementById(view + '-view').classList.remove('hidden');

    if (view === 'items') {
        updateItemsTable();
    } else if (view === 'catalogo') {
        updateCatalogTable();
    } else if (view === 'mapa') {
        generateWarehouse();
    } else if (view === 'croquis') {
        drawWarehouseLayout();
    }
}

function generateWarehouse() {
    const grid = document.getElementById('warehouseGrid');
    grid.innerHTML = '';

    console.log('Generando almacén con configuración:', warehouseConfig);

    const pasillosToShow = selectedAisle ? [selectedAisle] : Array.from({ length: warehouseConfig.pasillos }, (_, i) => i + 1);

    for (const p of pasillosToShow) {
        const config = warehouseConfig.aisleConfigs[p-1] || { estantes: 4, casillas: 6 };
        const pasilloDiv = document.createElement('div');
        pasilloDiv.className = 'pasillo';
        
        const header = document.createElement('div');
        header.className = 'pasillo-header';
        header.textContent = `Pasillo ${p}`;
        pasilloDiv.appendChild(header);

        const estantesDiv = document.createElement('div');
        estantesDiv.className = 'estantes';

        const estanteLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        
        for (let e = 0; e < config.estantes; e++) {
            const estanteDiv = document.createElement('div');
            estanteDiv.className = 'estante';
            
            const label = document.createElement('div');
            label.className = 'estante-label';
            label.textContent = `Estante ${estanteLabels[e]}`;
            estanteDiv.appendChild(label);

            const casillasGrid = document.createElement('div');
            casillasGrid.className = 'casillas-grid';
            const casillaWidth = window.innerWidth <= 768 ? '35px' : '40px';
            casillasGrid.style.gridTemplateColumns = `repeat(${config.casillas}, ${casillaWidth})`;

            for (let c = 1; c <= config.casillas; c++) {
                const casilla = document.createElement('div');
                casilla.className = 'casilla';
                const casillaName = `${estanteLabels[e]}-${c}`;
                const location = `${p}-${estanteLabels[e]}-${c}`;
                casilla.dataset.location = location;
                casilla.addEventListener('click', () => openCasillModal(location));
                
                const itemsInCasilla = allItems.filter(item => item.location === location);
                const itemCount = itemsInCasilla.length;
                casilla.textContent = itemCount > 0 ? `${casillaName} (${itemCount})` : casillaName;

                if (itemCount > 0) {
                    casilla.classList.add('occupied');
                    const badge = document.createElement('span');
                    badge.className = 'item-count-badge';
                    badge.textContent = itemCount;
                    casilla.appendChild(badge);
                    casilla.title = itemsInCasilla.map(item => `${item.code} - ${item.description}`).join('\n');
                }

                casillasGrid.appendChild(casilla);
            }

            estanteDiv.appendChild(casillasGrid);
            estantesDiv.appendChild(estanteDiv);
        }

        pasilloDiv.appendChild(estantesDiv);
        grid.appendChild(pasilloDiv);
    }
}

function updateAisleConfigs() {
    const pasillos = parseInt(document.getElementById('pasillosInput').value) || 4;
    const configsDiv = document.getElementById('aisleConfigs');
    configsDiv.innerHTML = '';

    warehouseConfig.pasillos = pasillos;
    if (!Array.isArray(warehouseConfig.aisleConfigs)) {
        warehouseConfig.aisleConfigs = Array(pasillos).fill().map(() => ({ estantes: 4, casillas: 6 }));
    } else if (warehouseConfig.aisleConfigs.length > pasillos) {
        warehouseConfig.aisleConfigs = warehouseConfig.aisleConfigs.slice(0, pasillos);
        layoutConfig.aisles = layoutConfig.aisles.slice(0, pasillos);
    } else {
        while (warehouseConfig.aisleConfigs.length < pasillos) {
            warehouseConfig.aisleConfigs.push({ estantes: 4, casillas: 6 });
            layoutConfig.aisles.push({
                id: warehouseConfig.aisleConfigs.length,
                x: 50 + (warehouseConfig.aisleConfigs.length - 1) * 120,
                y: 50,
                width: 50,
                height: 200,
                orientation: warehouseConfig.aisleConfigs.length % 2 === 0 ? 'vertical' : 'horizontal'
            });
        }
    }

    for (let p = 1; p <= pasillos; p++) {
        const configDiv = document.createElement('div');
        configDiv.className = 'aisle-config';
        
        const header = document.createElement('h3');
        header.textContent = `Pasillo ${p}`;
        configDiv.appendChild(header);

        const estantesGroup = document.createElement('div');
        estantesGroup.className = 'config-group';
        const estantesLabel = document.createElement('label');
        estantesLabel.className = 'config-label';
        estantesLabel.textContent = 'Estantes';
        const estantesInput = document.createElement('input');
        estantesInput.type = 'number';
        estantesInput.className = 'config-input';
        estantesInput.value = warehouseConfig.aisleConfigs[p-1].estantes || 4;
        estantesInput.min = 1;
        estantesInput.max = 8;
        estantesInput.onchange = () => {
            warehouseConfig.aisleConfigs[p-1].estantes = parseInt(estantesInput.value) || 4;
        };
        estantesGroup.appendChild(estantesLabel);
        estantesGroup.appendChild(estantesInput);
        configDiv.appendChild(estantesGroup);

        const casillasGroup = document.createElement('div');
        casillasGroup.className = 'config-group';
        const casillasLabel = document.createElement('label');
        casillasLabel.className = 'config-label';
        casillasLabel.textContent = 'Casillas por estante';
        const casillasInput = document.createElement('input');
        casillasInput.type = 'number';
        casillasInput.className = 'config-input';
        casillasInput.value = warehouseConfig.aisleConfigs[p-1].casillas || 6;
        casillasInput.min = 1;
        casillasInput.max = 10;
        casillasInput.onchange = () => {
            warehouseConfig.aisleConfigs[p-1].casillas = parseInt(casillasInput.value) || 6;
        };
        casillasGroup.appendChild(casillasLabel);
        casillasGroup.appendChild(casillasInput);
        configDiv.appendChild(casillasGroup);

        configsDiv.appendChild(configDiv);
    }
}

async function applyChanges() {
    try {
        await saveWarehouseConfig();
        await saveLayoutConfig();
        await loadWarehouseConfig();
        await loadLayoutConfig();
        updateAisleConfigs();
        updateLayoutConfigs();
        generateWarehouse();
        drawWarehouseLayout();
        updateLocationSelectors();
        showNotification('Configuración aplicada correctamente');
    } catch (error) {
        console.error('Error al aplicar cambios:', error);
        alert('Error al aplicar los cambios');
    }
}

function revertChanges() {
    loadWarehouseConfig().then(() => {
        loadLayoutConfig().then(() => {
            updateAisleConfigs();
            updateLayoutConfigs();
            generateWarehouse();
            drawWarehouseLayout();
            updateLocationSelectors();
            showNotification('Cambios revertidos');
        });
    });
}

async function loadWarehouseConfig() {
    try {
        const configDoc = await getDoc(doc(db, 'config', 'warehouse'));
        if (configDoc.exists()) {
            warehouseConfig = configDoc.data();
            if (!Array.isArray(warehouseConfig.aisleConfigs)) {
                console.warn('aisleConfigs is not an array, initializing with defaults');
                warehouseConfig.aisleConfigs = Array(warehouseConfig.pasillos || 4).fill().map(() => ({ estantes: 4, casillas: 6 }));
                await saveWarehouseConfig();
            }
        } else {
            warehouseConfig = {
                pasillos: 4,
                aisleConfigs: Array(4).fill().map(() => ({ estantes: 4, casillas: 6 }))
            };
            await saveWarehouseConfig();
        }
        document.getElementById('pasillosInput').value = warehouseConfig.pasillos;
    } catch (error) {
        console.error('Error al cargar configuración:', error);
        warehouseConfig = {
            pasillos: 4,
            aisleConfigs: Array(4).fill().map(() => ({ estantes: 4, casillas: 6 }))
        };
        await saveWarehouseConfig();
        document.getElementById('pasillosInput').value = warehouseConfig.pasillos;
    }
}

async function saveWarehouseConfig() {
    try {
        await setDoc(doc(db, 'config', 'warehouse'), {
            pasillos: warehouseConfig.pasillos,
            aisleConfigs: warehouseConfig.aisleConfigs.map(config => ({
                estantes: parseInt(config.estantes) || 4,
                casillas: parseInt(config.casillas) || 6
            }))
        });
    } catch (error) {
        console.error('Error al guardar configuración:', error);
    }
}

async function loadItems() {
    try {
        const querySnapshot = await getDocs(collection(db, 'items'));
        allItems = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.items && Array.isArray(data.items)) {
                data.items.forEach(item => {
                    allItems.push({
                        id: `${data.location}|${item.code}`,
                        location: data.location,
                        code: item.code,
                        description: item.description || '',
                        timestamp: item.timestamp
                    });
                });
            }
        });
        filteredItems = [...allItems];
        document.getElementById('itemsCount').textContent = allItems.length;
    } catch (error) {
        console.error('Error al cargar ítems:', error);
    }
}

async function addItem() {
    const code = document.getElementById('itemCode').value.trim().toUpperCase();
    const description = document.getElementById('itemDescription').value.trim();
    const location = document.getElementById('casillaSelect').value;

    if (!code || !location) {
        showNotification('Por favor, completa todos los campos.', 'error');
        return;
    }

    const catalogItem = allCatalog.find(item => item.code.toLowerCase() === code.toLowerCase());
    if (!catalogItem) {
        showNotification('Código no encontrado en el catálogo.', 'error');
        return;
    }

    const itemsInCasilla = allItems.filter(item => item.location === location);
    if (itemsInCasilla.length >= maxItemsPerCasilla) {
        showNotification(`No se pueden agregar más ítems. Límite de ${maxItemsPerCasilla} ítems por casilla alcanzado.`, 'error');
        return;
    }

    const item = {
        code,
        description: catalogItem.description,
        timestamp: new Date().toISOString()
    };

    try {
        const docRef = doc(db, 'items', location);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            await updateDoc(docRef, {
                items: arrayUnion(item)
            });
        } else {
            await setDoc(docRef, {
                location,
                items: [item]
            });
        }
        await loadItems();
        generateWarehouse();
        updateItemsTable();
        document.getElementById('itemCode').value = '';
        document.getElementById('itemDescription').value = '';
        showNotification('Item añadido correctamente.');
    } catch (error) {
        console.error('Error al añadir item:', error);
        showNotification('Error al añadir item.', 'error');
    }
}

async function saveItemToModal() {
    const code = document.getElementById('modalItemCode').value.trim().toUpperCase();
    if (!code) {
        showNotification('Por favor, ingresa un código de ítem.', 'error');
        return;
    }

    const catalogItem = allCatalog.find(item => item.code.toLowerCase() === code.toLowerCase());
    if (!catalogItem) {
        showNotification('Código no encontrado en el catálogo.', 'error');
        return;
    }

    const itemsInCasilla = allItems.filter(item => item.location === currentCasilla);
    if (itemsInCasilla.length >= maxItemsPerCasilla) {
        showNotification(`No se pueden agregar más ítems. Límite de ${maxItemsPerCasilla} ítems por casilla alcanzado.`, 'error');
        return;
    }

    const item = {
        code,
        description: catalogItem.description,
        timestamp: new Date().toISOString()
    };

    try {
        const docRef = doc(db, 'items', currentCasilla);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            await updateDoc(docRef, {
                items: arrayUnion(item)
            });
        } else {
            await setDoc(docRef, {
                location: currentCasilla,
                items: [item]
            });
        }
        await loadItems();
        generateWarehouse();
        updateItemsTable();
        openCasillModal(currentCasilla);
        showNotification('Ítem añadido a la casilla correctamente.');
    } catch (error) {
        console.error('Error al guardar ítem en casilla:', error);
        showNotification('Error al guardar ítem.', 'error');
    }
}

async function removeItem(itemId) {
    if (confirm('¿Estás seguro de que quieres eliminar este ítem?')) {
        const [location, code] = itemId.split('|');
        const itemToRemove = allItems.find(item => item.id === itemId);
        
        try {
            await updateDoc(doc(db, 'items', location), {
                items: arrayRemove({ code: itemToRemove.code, description: itemToRemove.description, timestamp: itemToRemove.timestamp })
            });
            selectedItems.delete(itemId);
            await loadItems();
            generateWarehouse();
            updateItemsTable();
            updateLocationSelectors();
            if (currentCasilla) openCasillModal(currentCasilla);
            showNotification('Ítem eliminado correctamente');
        } catch (error) {
            console.error('Error al eliminar ítem:', error);
            alert('Error al eliminar el ítem');
        }
    }
}

async function clearAllItems() {
    if (confirm('¿Estás seguro de que quieres eliminar TODOS los ítems? Esta acción no se puede deshacer.')) {
        try {
            const querySnapshot = await getDocs(collection(db, 'items'));
            const deletePromises = [];
            querySnapshot.forEach((docSnapshot) => {
                deletePromises.push(deleteDoc(doc(db, 'items', docSnapshot.id)));
            });
            await Promise.all(deletePromises);
            selectedItems.clear();
            await loadItems();
            generateWarehouse();
            updateItemsTable();
            updateLocationSelectors();
            showNotification('Todos los ítems eliminados');
        } catch (error) {
            console.error('Error al eliminar todos los ítems:', error);
            alert('Error al eliminar los ítems');
        }
    }
}

function updateItemsTable() {
    const tbody = document.getElementById('itemsTableBody');
    tbody.innerHTML = '';

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredItems.slice(startIndex, endIndex);

    pageItems.forEach(item => {
        const row = document.createElement('tr');
        const isSelected = selectedItems.has(item.id);
        const itemsInCasilla = allItems.filter(i => i.location === item.location).length;
        
        const date = new Date(item.timestamp || Date.now());
        const formattedDate = date.toLocaleDateString('es-ES');
        
        row.innerHTML = `
            <td>
                <input type="checkbox" name="itemSelect" value="${item.id}" 
                       ${isSelected ? 'checked' : ''} 
                       onchange="toggleItemSelection('${item.id}', this.checked)">
            </td>
            <td><strong style="font-family: monospace; background: #f8f9fa; padding: 0.2rem 0.4rem; border-radius: 4px;">${item.code}</strong></td>
            <td>${item.description || ''}</td>
            <td>
                <code style="background: #e9ecef; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9rem;">${item.location} (${itemsInCasilla}/${maxItemsPerCasilla})</code>
            </td>
            <td style="font-size: 0.8rem; color: #666;">${formattedDate}</td>
            <td>
                <button class="btn btn-secondary" onclick="editItemInline('${item.id}')" 
                        style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-right: 0.25rem;">✏️</button>
                <button class="btn btn-secondary" onclick="removeItem('${item.id}')" 
                        style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background: #dc3545; color: white;">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    document.getElementById('prevBtn').disabled = currentPage <= 1;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages;
    
    const totalItems = pageItems.length;
    const selectedCount = pageItems.filter(item => selectedItems.has(item.id)).length;
    const selectAllCheckbox = document.getElementById('selectAll');
    
    if (totalItems === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = selectedCount === totalItems;
        selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalItems;
    }

    document.getElementById('bulkActions').style.display = selectedItems.size > 0 ? 'block' : 'none';
}

function toggleItemSelection(itemId, checked) {
    if (checked) {
        selectedItems.add(itemId);
    } else {
        selectedItems.delete(itemId);
    }
    updateItemsTable();
}

function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredItems.slice(startIndex, endIndex);

    if (selectAllCheckbox.checked) {
        pageItems.forEach(item => selectedItems.add(item.id));
    } else {
        pageItems.forEach(item => selectedItems.delete(item.id));
    }
    updateItemsTable();
}

async function bulkDelete() {
    if (confirm(`¿Estás seguro de que quieres eliminar ${selectedItems.size} ítems?`)) {
        try {
            const deletePromises = [];
            selectedItems.forEach(itemId => {
                const [location, code] = itemId.split('|');
                const itemToRemove = allItems.find(item => item.id === itemId);
                if (itemToRemove) {
                    deletePromises.push(
                        updateDoc(doc(db, 'items', location), {
                            items: arrayRemove({ code: itemToRemove.code, description: itemToRemove.description, timestamp: itemToRemove.timestamp })
                        })
                    );
                }
            });
            await Promise.all(deletePromises);
            selectedItems.clear();
            await loadItems();
            generateWarehouse();
            updateItemsTable();
            updateLocationSelectors();
            showNotification('Ítems eliminados correctamente');
        } catch (error) {
            console.error('Error al eliminar ítems:', error);
            alert('Error al eliminar los ítems');
        }
    }
}

function bulkExport() {
    const selectedData = allItems.filter(item => selectedItems.has(item.id));
    const data = {
        items: selectedData,
        exportDate: new Date().toISOString(),
        count: selectedData.length
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `items_selected_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Ítems seleccionados exportados correctamente');
}

function editItemInline(itemId) {
    const [location] = itemId.split('|');
    openCasillModal(location);
}

function handleSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const originalQuery = document.getElementById('searchInput').value;
    showSuggestions(originalQuery);
    handleSearchLogic(query);
}

function handleItemsSearch() {
    const query = document.getElementById('itemsSearchInput').value.toLowerCase();
    handleSearchLogic(query);
}

function handleSearchLogic(query) {
    if (!query) {
        filteredItems = [...allItems];
    } else {
        filteredItems = allItems.filter(item => 
            item.code.toLowerCase().includes(query) ||
            (item.description && item.description.toLowerCase().includes(query)) ||
            item.location.toLowerCase().includes(query)
        );
    }
    currentPage = 1;
    updateItemsTable();
    highlightSearchResults(query);
}

function highlightSearchResults(query) {
    document.querySelectorAll('.casilla').forEach(casilla => {
        casilla.classList.remove('highlighted');
        if (query) {
            const location = casilla.dataset.location;
            const itemsInCasilla = allItems.filter(i => i.location === location);
            if (itemsInCasilla.some(item => 
                item.code.toLowerCase().includes(query.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(query.toLowerCase())) ||
                location.toLowerCase().includes(query.toLowerCase())
            )) {
                casilla.style.background = '#fff3cd';
                casilla.style.borderColor = '#ffc107';
            }
        } else {
            casilla.style.background = '';
            casilla.style.borderColor = '';
        }
    });
}

function showSuggestions(query) {
    const suggestionsDiv = document.getElementById('searchSuggestions');
    suggestionsDiv.innerHTML = '';
    suggestionsDiv.classList.add('hidden');

    if (!query.trim()) return;

    const filtered = allItems.filter(item => 
        item.code.toLowerCase().includes(query.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(query.toLowerCase()))
    );

    if (filtered.length === 0) return;

    const ul = document.createElement('ul');

    filtered.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.code} - ${item.description}`;
        li.addEventListener('click', () => {
            openItemModal(item);
            suggestionsDiv.classList.add('hidden');
        });
        ul.appendChild(li);
    });

    suggestionsDiv.appendChild(ul);
    suggestionsDiv.classList.remove('hidden');
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        updateItemsTable();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        updateItemsTable();
    }
}

function previousCatalogPage() {
    if (currentCatalogPage > 1) {
        currentCatalogPage--;
        updateCatalogTable();
    }
}

function nextCatalogPage() {
    const totalPages = Math.ceil(filteredCatalog.length / itemsPerPage);
    if (currentCatalogPage < totalPages) {
        currentCatalogPage++;
        updateCatalogTable();
    }
}

async function loadCatalog() {
    try {
        const querySnapshot = await getDocs(collection(db, 'catalog'));
        allCatalog = [];
        querySnapshot.forEach((doc) => {
            allCatalog.push({ id: doc.id, ...doc.data() });
        });
        filteredCatalog = [...allCatalog];
        document.getElementById('catalogoCount').textContent = allCatalog.length;
    } catch (error) {
        console.error('Error al cargar catálogo:', error);
    }
}

async function addToCatalog() {
    const code = document.getElementById('catalogCode').value.trim().toUpperCase();
    const description = document.getElementById('catalogDescription').value.trim();

    if (!code || !description) {
        alert('El código y la descripción son requeridos');
        return;
    }

    if (allCatalog.find(item => item.code === code)) {
        alert('Este código ya existe en el catálogo');
        return;
    }

    const catalogData = {
        code: code,
        description: description,
        timestamp: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, 'catalog', code), catalogData);
        await loadCatalog();
        updateCatalogTable();
        document.getElementById('catalogCode').value = '';
        document.getElementById('catalogDescription').value = '';
        showNotification('Producto agregado al catálogo');
    } catch (error) {
        console.error('Error al agregar al catálogo:', error);
        alert('Error al agregar el producto al catálogo');
    }
}

async function removeCatalogItem(code) {
    if (confirm('¿Estás seguro de que quieres eliminar este producto del catálogo?')) {
        try {
            await deleteDoc(doc(db, 'catalog', code));
            await loadCatalog();
            updateCatalogTable();
            showNotification('Producto eliminado del catálogo');
        } catch (error) {
            console.error('Error al eliminar del catálogo:', error);
            alert('Error al eliminar el producto');
        }
    }
}

async function quickLocateItem(code) {
    const catalogItem = allCatalog.find(item => item.code === code);
    if (!catalogItem) return;

    document.getElementById('itemCode').value = code;
    document.getElementById('itemDescription').value = catalogItem.description;
    switchView({ target: { dataset: { view: 'items' } } });
}

function updateCatalogTable() {
    const tbody = document.getElementById('catalogTableBody');
    tbody.innerHTML = '';

    const startIndex = (currentCatalogPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredCatalog.slice(startIndex, endIndex);

    pageItems.forEach(item => {
        const row = document.createElement('tr');
        const inWarehouse = allItems.filter(i => i.code === item.code).length;
        
        row.innerHTML = `
            <td><strong style="font-family: monospace; background: #f8f9fa; padding: 0.2rem 0.4rem; border-radius: 4px;">${item.code}</strong></td>
            <td>${item.description}</td>
            <td>${inWarehouse} unidad${inWarehouse !== 1 ? 'es' : ''}</td>
            <td>
                <button class="btn btn-secondary" onclick="quickLocateItem('${item.code}')" 
                        style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-right: 0.25rem;">📍</button>
                <button class="btn btn-secondary" onclick="removeCatalogItem('${item.code}')" 
                        style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background: #dc3545; color: white;">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    const totalPages = Math.ceil(filteredCatalog.length / itemsPerPage);
    document.getElementById('currentCatalogPage').textContent = currentCatalogPage;
    document.getElementById('totalCatalogPages').textContent = totalPages;
    document.getElementById('prevCatalogBtn').disabled = currentCatalogPage <= 1;
    document.getElementById('nextCatalogBtn').disabled = currentCatalogPage >= totalPages;
}

function handleCatalogSearch() {
    const query = document.getElementById('catalogSearchInput').value.toLowerCase();
    if (!query) {
        filteredCatalog = [...allCatalog];
    } else {
        filteredCatalog = allCatalog.filter(item => 
            item.code.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
        );
    }
    currentCatalogPage = 1;
    updateCatalogTable();
}

function exportCatalog() {
    const data = {
        catalog: allCatalog,
        exportDate: new Date().toISOString(),
        count: allCatalog.length
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalogo_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Catálogo exportado correctamente');
}

async function importCatalogCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const lines = e.target.result.split('\n').filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            
            const requiredColumns = ['code', 'description'];
            const hasRequired = requiredColumns.every(col => headers.includes(col));
            
            if (!hasRequired) {
                alert('El CSV debe contener al menos las columnas: code, description');
                return;
            }

            const importPromises = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1'));
                const item = {};
                
                headers.forEach((header, index) => {
                    item[header] = values[index] || '';
                });

                if (item.code && item.description) {
                    importPromises.push(
                        setDoc(doc(db, 'catalog', item.code), {
                            code: item.code,
                            description: item.description,
                            timestamp: new Date().toISOString()
                        })
                    );
                }
            }

            await Promise.all(importPromises);
            await loadCatalog();
            updateCatalogTable();
            showNotification('Catálogo importado correctamente');
        } catch (error) {
            console.error('Error al importar catálogo:', error);
            alert('Error al importar el catálogo. Verifica el formato del archivo.');
        }
    };
    
    reader.readAsText(file);
}

async function clearCatalog() {
    if (confirm('¿Estás seguro de que quieres eliminar TODOS los productos del catálogo? Esta acción no se puede deshacer.')) {
        try {
            const querySnapshot = await getDocs(collection(db, 'catalog'));
            const deletePromises = [];
            querySnapshot.forEach((docSnapshot) => {
                deletePromises.push(deleteDoc(doc(db, 'catalog', docSnapshot.id)));
            });
            await Promise.all(deletePromises);
            await loadCatalog();
            updateCatalogTable();
            showNotification('Catálogo limpiado');
        } catch (error) {
            console.error('Error al limpiar catálogo:', error);
            alert('Error al limpiar el catálogo');
        }
    }
}

function autoFillDescription() {
    const code = document.getElementById('itemCode').value.trim().toUpperCase();
    const descriptionInput = document.getElementById('itemDescription');
    const catalogItem = allCatalog.find(item => item.code === code);
    descriptionInput.value = catalogItem ? catalogItem.description : '';
}

function autoFillModalDescription() {
    const code = document.getElementById('modalItemCode').value.trim().toUpperCase();
    const descriptionInput = document.getElementById('modalItemDescription');
    const catalogItem = allCatalog.find(item => item.code === code);
    descriptionInput.value = catalogItem ? catalogItem.description : '';
}

function openCasillModal(location) {
    currentCasilla = location;
    document.getElementById('modalTitle').textContent = `Gestionar Casilla ${location.split('-')[1]}-${location.split('-')[2]}`;
    document.getElementById('modalItemCode').value = '';
    document.getElementById('modalItemDescription').value = '';
    const itemsList = document.getElementById('modalItemsList');
    itemsList.innerHTML = '';

    const itemsInCasilla = allItems.filter(item => item.location === location);
    if (itemsInCasilla.length === 0) {
        itemsList.innerHTML = '<p>No hay ítems en esta casilla.</p>';
    } else {
        const ul = document.createElement('ul');
        itemsInCasilla.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                ${item.code} - ${item.description}
                <button class="btn btn-secondary" onclick="removeItem('${item.id}')" 
                        style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background: #dc3545; color: white;">🗑️</button>
            `;
            ul.appendChild(li);
        });
        itemsList.appendChild(ul);
    }

    document.getElementById('casillModal').style.display = 'block';
}

function closeCasillModal() {
    document.getElementById('casillModal').style.display = 'none';
    currentCasilla = null;
}

function openItemModal(item) {
    document.getElementById('itemCodeView').textContent = item.code;
    document.getElementById('itemDescriptionView').textContent = item.description || '';
    document.getElementById('itemLocationView').textContent = item.location;
    document.getElementById('itemModal').style.display = 'block';
}

function closeItemModal() {
    document.getElementById('itemModal').style.display = 'none';
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    if (type === 'error') {
        notification.style.background = '#f8d7da';
        notification.style.color = '#721c24';
        notification.style.borderColor = '#f5c6cb';
    }
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function updateLocationSelectors() {
    const pasilloSelect = document.getElementById('pasilloSelect');
    const estanteSelect = document.getElementById('estanteSelect');
    const casillaSelect = document.getElementById('casillaSelect');

    pasilloSelect.innerHTML = '<option value="">Seleccionar pasillo</option>';
    estanteSelect.innerHTML = '<option value="">Seleccionar estante</option>';
    casillaSelect.innerHTML = '<option value="">Seleccionar casilla</option>';
    estanteSelect.disabled = true;
    casillaSelect.disabled = true;

    for (let p = 1; p <= warehouseConfig.pasillos; p++) {
        const option = document.createElement('option');
        option.value = p;
        option.textContent = `Pasillo ${p}`;
        pasilloSelect.appendChild(option);
    }
}

function updateEstanteSelect() {
    const pasillo = document.getElementById('pasilloSelect').value;
    const estanteSelect = document.getElementById('estanteSelect');
    const casillaSelect = document.getElementById('casillaSelect');
    estanteSelect.innerHTML = '<option value="">Seleccionar estante</option>';
    casillaSelect.innerHTML = '<option value="">Seleccionar casilla</option>';
    estanteSelect.disabled = !pasillo;
    casillaSelect.disabled = true;

    if (pasillo) {
        const config = warehouseConfig.aisleConfigs[parseInt(pasillo) - 1] || { estantes: 4 };
        const estanteLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        for (let e = 0; e < config.estantes; e++) {
            const option = document.createElement('option');
            option.value = estanteLabels[e];
            option.textContent = `Estante ${estanteLabels[e]}`;
            estanteSelect.appendChild(option);
        }
    }
}

function updateCasillaSelect() {
    const pasillo = document.getElementById('pasilloSelect').value;
    const estante = document.getElementById('estanteSelect').value;
    const casillaSelect = document.getElementById('casillaSelect');
    casillaSelect.innerHTML = '<option value="">Seleccionar casilla</option>';
    casillaSelect.disabled = !estante;

    if (pasillo && estante) {
        const config = warehouseConfig.aisleConfigs[parseInt(pasillo) - 1] || { casillas: 6 };
        for (let c = 1; c <= config.casillas; c++) {
            const option = document.createElement('option');
            option.value = `${pasillo}-${estante}-${c}`;
            option.textContent = `Casilla ${estante}-${c}`;
            casillaSelect.appendChild(option);
        }
    }
}

function sortItems(field) {
    if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortDirection = 'asc';
    }

    filteredItems.sort((a, b) => {
        let valA = a[field];
        let valB = b[field];

        if (field === 'timestamp') {
            valA = new Date(valA || Date.now()).getTime();
            valB = new Date(valB || Date.now()).getTime();
        } else {
            valA = (valA || '').toLowerCase();
            valB = (valB || '').toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    document.querySelectorAll('[id^="sort-"]').forEach(span => {
        span.textContent = '↕️';
    });
    document.getElementById(`sort-${field}`).textContent = sortDirection === 'asc' ? '↑' : '↓';

    currentPage = 1;
    updateItemsTable();
}

function sortCatalog(field) {
    if (catalogSortField === field) {
        catalogSortDirection = catalogSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        catalogSortField = field;
        catalogSortDirection = 'asc';
    }

    filteredCatalog.sort((a, b) => {
        let valA = a[field];
        let valB = b[field];

        valA = (valA || '').toLowerCase();
        valB = (valB || '').toLowerCase();

        if (valA < valB) return catalogSortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return catalogSortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    document.querySelectorAll('[id^="sort-catalog-"]').forEach(span => {
        span.textContent = '↕️';
    });
    document.getElementById(`sort-catalog-${field}`).textContent = catalogSortDirection === 'asc' ? '↑' : '↓';

    currentCatalogPage = 1;
    updateCatalogTable();
}

function exportData() {
    const data = {
        items: allItems,
        exportDate: new Date().toISOString(),
        count: allItems.length
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `items_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Datos exportados correctamente');
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.items || !Array.isArray(data.items)) {
                alert('Formato de archivo inválido');
                return;
            }

            const importPromises = [];

            const groupedItems = {};
            data.items.forEach(item => {
                if (!groupedItems[item.location]) {
                    groupedItems[item.location] = [];
                }
                groupedItems[item.location].push({
                    code: item.code,
                    description: item.description,
                    timestamp: item.timestamp || new Date().toISOString()
                });
            });

            for (const location in groupedItems) {
                const items = groupedItems[location];
                const docRef = doc(db, 'items', location);
                importPromises.push(setDoc(docRef, { location, items }));
            }

            await Promise.all(importPromises);
            await loadItems();
            generateWarehouse();
            updateItemsTable();
            updateLocationSelectors();
            showNotification('Datos importados correctamente');
        } catch (error) {
            console.error('Error al importar datos:', error);
            alert('Error al importar los datos. Verifica el formato del archivo.');
        }
    };
    
    reader.readAsText(file);
}