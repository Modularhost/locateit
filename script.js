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
let isDragging = false;
let draggedAisle = null;
let dragStartX = 0;
let dragStartY = 0;
let clickTimeout = null;
let clickCount = 0;

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
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('click', handleCanvasClick);

    const pasillosInput = document.getElementById('pasillosInput');
    if (pasillosInput) {
        pasillosInput.addEventListener('change', updateAisleConfigs);
    }

    const applyBtn = document.getElementById('applyBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', applyChanges);
    }

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }

    const importBtn = document.getElementById('importBtn');
    if (importBtn) {
        importBtn.addEventListener('click', () => document.getElementById('importFile').click());
    }

    const pasilloSelect = document.getElementById('pasilloSelect');
    if (pasilloSelect) {
        pasilloSelect.addEventListener('change', updateEstanteSelect);
    }

    const estanteSelect = document.getElementById('estanteSelect');
    if (estanteSelect) {
        estanteSelect.addEventListener('change', updateCasillaSelect);
    }
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
            } else {
                layoutConfig.aisles.forEach(aisle => {
                    if (!['vertical', 'horizontal'].includes(aisle.orientation)) {
                        aisle.orientation = 'vertical';
                    }
                });
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

    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = 600 * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    layoutConfig.aisles.forEach(aisle => {
        const itemCount = allItems.filter(item => item.location.startsWith(`${aisle.id}-`)).length;
        ctx.fillStyle = itemCount > 0 ? '#e3f2fd' : '#ffffff';
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;

        const width = aisle.width;
        const height = aisle.height;

        if (isDragging && draggedAisle && draggedAisle.id === aisle.id) {
            ctx.fillStyle = 'rgba(0, 123, 255, 0.3)';
        }

        ctx.fillRect(aisle.x, aisle.y, width, height);
        ctx.strokeRect(aisle.x, aisle.y, width, height);

        ctx.fillStyle = '#2c3e50';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textX = aisle.x + width / 2;
        const textY = aisle.y + height / 2;

        // Texto siempre horizontal, sin rotación
        ctx.fillText(`Pasillo ${aisle.id} (${itemCount})`, textX, textY);
    });
}

function getMousePosition(event) {
    const canvas = document.getElementById('warehouseCanvas');
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width) / window.devicePixelRatio;
    const y = (event.clientY - rect.top) * (canvas.height / rect.height) / window.devicePixelRatio;
    return { x, y };
}

function handleCanvasMouseDown(event) {
    if (currentView !== 'croquis') return;

    const { x, y } = getMousePosition(event);
    draggedAisle = layoutConfig.aisles.find(aisle => {
        const width = aisle.width;
        const height = aisle.height;
        return x >= aisle.x && x <= aisle.x + width &&
               y >= aisle.y && y <= aisle.y + height;
    });

    if (draggedAisle) {
        isDragging = true;
        dragStartX = x - draggedAisle.x;
        dragStartY = y - draggedAisle.y;
        document.getElementById('warehouseCanvas').style.cursor = 'move';
    }
}

function handleCanvasMouseMove(event) {
    const canvas = document.getElementById('warehouseCanvas');
    const { x, y } = getMousePosition(event);

    if (isDragging && draggedAisle) {
        const width = draggedAisle.width;
        const height = draggedAisle.height;

        draggedAisle.x = Math.max(0, Math.min(x - dragStartX, canvas.width / window.devicePixelRatio - width));
        draggedAisle.y = Math.max(0, Math.min(y - dragStartY, canvas.height / window.devicePixelRatio - height));

        drawWarehouseLayout();
        updateLayoutConfigs();
        return;
    }

    const hoveredAisle = layoutConfig.aisles.find(aisle => {
        const width = aisle.width;
        const height = aisle.height;
        return x >= aisle.x && x <= aisle.x + width &&
               y >= aisle.y && y <= aisle.y + height;
    });

    canvas.style.cursor = hoveredAisle ? 'pointer' : 'default';
    drawWarehouseLayout();
    if (hoveredAisle) {
        const ctx = canvas.getContext('2d');
        const width = hoveredAisle.width;
        const height = hoveredAisle.height;
        ctx.fillStyle = 'rgba(0, 123, 255, 0.2)';
        ctx.fillRect(hoveredAisle.x, hoveredAisle.y, width, height);
        ctx.fillStyle = '#2c3e50';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textX = hoveredAisle.x + width / 2;
        const textY = hoveredAisle.y + height / 2;
        // Texto siempre horizontal, sin rotación
        ctx.fillText(`Pasillo ${hoveredAisle.id} (${allItems.filter(item => item.location.startsWith(`${hoveredAisle.id}-`)).length})`, textX, textY);
    }
}

async function handleCanvasMouseUp() {
    if (isDragging && draggedAisle) {
        isDragging = false;
        await saveLayoutConfig();
        showNotification('Posición del pasillo guardada');
        draggedAisle = null;
        document.getElementById('warehouseCanvas').style.cursor = 'default';
        drawWarehouseLayout();
        updateLayoutConfigs();
    }
}

function handleCanvasClick(event) {
    if (isDragging) return;

    const { x, y } = getMousePosition(event);
    const clickedAisle = layoutConfig.aisles.find(aisle => {
        const width = aisle.width;
        const height = aisle.height;
        return x >= aisle.x && x <= aisle.x + width &&
               y >= aisle.y && y <= aisle.y + height;
    });

    if (clickedAisle) {
        clickCount++;
        
        if (clickCount === 1) {
            clickTimeout = setTimeout(() => {
                clickCount = 0;
                clickTimeout = null;
            }, 300);
        } else if (clickCount === 2) {
            clearTimeout(clickTimeout);
            clickCount = 0;
            clickTimeout = null;
            selectedAisle = clickedAisle.id;
            switchView({ target: { dataset: { view: 'mapa' } } });
            generateWarehouse();
        }
    } else {
        clickCount = 0;
        if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;
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
            orientation: 'vertical'
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
                orientation: 'vertical'
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
        xInput.max = 1000;
        xInput.addEventListener('change', () => {
            layoutConfig.aisles[p-1].x = parseInt(xInput.value) || 50;
            drawWarehouseLayout();
            saveLayoutConfig();
        });
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
        yInput.max = 600;
        yInput.addEventListener('change', () => {
            layoutConfig.aisles[p-1].y = parseInt(yInput.value) || 50;
            drawWarehouseLayout();
            saveLayoutConfig();
        });
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
        widthInput.addEventListener('change', () => {
            layoutConfig.aisles[p-1].width = parseInt(widthInput.value) || 50;
            drawWarehouseLayout();
            saveLayoutConfig();
        });
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
        heightInput.addEventListener('change', () => {
            layoutConfig.aisles[p-1].height = parseInt(heightInput.value) || 200;
            drawWarehouseLayout();
            saveLayoutConfig();
        });
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
        orientationSelect.addEventListener('change', () => {
            console.log(`Cambiando orientación del pasillo ${p} a: ${orientationSelect.value}`);
            layoutConfig.aisles[p-1].orientation = orientationSelect.value;
            const temp = layoutConfig.aisles[p-1].width;
            layoutConfig.aisles[p-1].width = layoutConfig.aisles[p-1].height;
            layoutConfig.aisles[p-1].height = temp;
            widthInput.value = layoutConfig.aisles[p-1].width;
            heightInput.value = layoutConfig.aisles[p-1].height;
            drawWarehouseLayout();
            saveLayoutConfig();
        });
        orientationGroup.appendChild(orientationLabel);
        orientationGroup.appendChild(orientationSelect);
        layoutDiv.appendChild(orientationGroup);

        layoutConfigsDiv.appendChild(layoutDiv);
    }
}

function switchView(e) {
    const view = e.target.dataset.view;
    currentView = view;

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    document.querySelectorAll('.section').forEach(viewEl => {
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
                orientation: 'vertical'
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
        estantesInput.addEventListener('change', () => {
            warehouseConfig.aisleConfigs[p-1].estantes = parseInt(estantesInput.value) || 4;
        });
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
        casillasInput.addEventListener('change', () => {
            warehouseConfig.aisleConfigs[p-1].casillas = parseInt(casillasInput.value) || 6;
        });
        casillasGroup.appendChild(casillasLabel);
        casillasGroup.appendChild(casillasInput);
        configDiv.appendChild(casillasGroup);

        configsDiv.appendChild(configDiv);
    }

    updateLayoutConfigs();
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
        showNotification('Error al aplicar los cambios', 'error');
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
            showNotification('Error al eliminar el ítem', 'error');
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
            showNotification('Error al eliminar los ítems', 'error');
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
            showNotification('Error al eliminar los ítems', 'error');
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

async function loadCatalog() {
    try {
        const querySnapshot = await getDocs(collection(db, 'catalog'));
        allCatalog = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            allCatalog.push({
                id: doc.id,
                code: data.code,
                description: data.description
            });
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
        showNotification('Por favor, completa todos los campos.', 'error');
        return;
    }

    if (allCatalog.some(item => item.code.toLowerCase() === code.toLowerCase())) {
        showNotification('El código ya existe en el catálogo.', 'error');
        return;
    }

    try {
        await setDoc(doc(db, 'catalog', code), {
            code,
            description
        });
        await loadCatalog();
        updateCatalogTable();
        document.getElementById('catalogCode').value = '';
        document.getElementById('catalogDescription').value = '';
        showNotification('Producto añadido al catálogo correctamente.');
    } catch (error) {
        console.error('Error al añadir al catálogo:', error);
        showNotification('Error al añadir al catálogo.', 'error');
    }
}

function updateCatalogTable() {
    const tbody = document.getElementById('catalogTableBody');
    tbody.innerHTML = '';

    const startIndex = (currentCatalogPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredCatalog.slice(startIndex, endIndex);

    pageItems.forEach(item => {
        const itemsInWarehouse = allItems.filter(i => i.code.toLowerCase() === item.code.toLowerCase()).length;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong style="font-family: monospace; background: #f8f9fa; padding: 0.2rem 0.4rem; border-radius: 4px;">${item.code}</strong></td>
            <td>${item.description}</td>
            <td>${itemsInWarehouse}</td>
            <td>
                <button class="btn btn-secondary" onclick="removeFromCatalog('${item.id}')" 
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

async function removeFromCatalog(itemId) {
    if (confirm('¿Estás seguro de que quieres eliminar este producto del catálogo?')) {
        try {
            await deleteDoc(doc(db, 'catalog', itemId));
            await loadCatalog();
            updateCatalogTable();
            showNotification('Producto eliminado del catálogo.');
        } catch (error) {
            console.error('Error al eliminar del catálogo:', error);
            showNotification('Error al eliminar del catálogo.', 'error');
        }
    }
}

async function clearCatalog() {
    if (confirm('¿Estás seguro de que quieres eliminar TODOS los productos del catálogo?')) {
        try {
            const querySnapshot = await getDocs(collection(db, 'catalog'));
            const deletePromises = [];
            querySnapshot.forEach((docSnapshot) => {
                deletePromises.push(deleteDoc(doc(db, 'catalog', docSnapshot.id)));
            });
            await Promise.all(deletePromises);
            await loadCatalog();
            updateCatalogTable();
            showNotification('Catálogo limpiado correctamente.');
        } catch (error) {
            console.error('Error al limpiar catálogo:', error);
            showNotification('Error al limpiar el catálogo.', 'error');
        }
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

function openCasillModal(location) {
    currentCasilla = location;
    const modal = document.getElementById('casillModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalItemsList = document.getElementById('modalItemsList');
    modalTitle.textContent = `Gestionar Casilla ${location}`;
    modalItemsList.innerHTML = '';

    const itemsInCasilla = allItems.filter(item => item.location === location);
    const ul = document.createElement('ul');
    itemsInCasilla.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${item.code} - ${item.description}</span>
            <button class="btn btn-secondary" onclick="removeItem('${item.id}')" 
                    style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background: #dc3545; color: white;">🗑️</button>
        `;
        ul.appendChild(li);
    });
    modalItemsList.appendChild(ul);

    document.getElementById('modalItemCode').value = '';
    document.getElementById('modalItemDescription').value = '';
    modal.style.display = 'block';
}

function closeCasillModal() {
    document.getElementById('casillModal').style.display = 'none';
    currentCasilla = null;
}

function openItemModal(item) {
    const modal = document.getElementById('itemModal');
    document.getElementById('itemCodeView').textContent = item.code;
    document.getElementById('itemDescriptionView').textContent = item.description || '';
    document.getElementById('itemLocationView').textContent = item.location;
    modal.style.display = 'block';
}

function closeItemModal() {
    document.getElementById('itemModal').style.display = 'none';
}

function autoFillDescription() {
    const code = document.getElementById('itemCode').value.trim().toUpperCase();
    const descriptionInput = document.getElementById('itemDescription');
    const catalogItem = allCatalog.find(item => item.code.toLowerCase() === code.toLowerCase());
    descriptionInput.value = catalogItem ? catalogItem.description : '';
}

function autoFillModalDescription() {
    const code = document.getElementById('modalItemCode').value.trim().toUpperCase();
    const descriptionInput = document.getElementById('modalItemDescription');
    const catalogItem = allCatalog.find(item => item.code.toLowerCase() === code.toLowerCase());
    descriptionInput.value = catalogItem ? catalogItem.description : '';
}

async function exportData() {
    const data = {
        items: allItems,
        config: warehouseConfig,
        layout: layoutConfig,
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warehouse_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Datos exportados correctamente');
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (data.items && Array.isArray(data.items)) {
            const writePromises = [];
            const locations = new Set(data.items.map(item => item.location));
            locations.forEach(location => {
                const itemsInLocation = data.items.filter(item => item.location === location);
                writePromises.push(setDoc(doc(db, 'items', location), {
                    location,
                    items: itemsInLocation.map(item => ({
                        code: item.code,
                        description: item.description,
                        timestamp: item.timestamp || new Date().toISOString()
                    }))
                }));
            });
            await Promise.all(writePromises);
        }

        if (data.config) {
            warehouseConfig = data.config;
            await saveWarehouseConfig();
        }

        if (data.layout) {
            layoutConfig = data.layout;
            await saveLayoutConfig();
        }

        await loadItems();
        await loadWarehouseConfig();
        await loadLayoutConfig();
        updateAisleConfigs();
        updateLayoutConfigs();
        generateWarehouse();
        drawWarehouseLayout();
        updateItemsTable();
        updateLocationSelectors();
        showNotification('Datos importados correctamente');
    } catch (error) {
        console.error('Error al importar datos:', error);
        showNotification('Error al importar datos.', 'error');
    }
}

async function exportCatalog() {
    const data = {
        catalog: allCatalog,
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalog_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Catálogo exportado correctamente');
}

async function importCatalogCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const writePromises = [];
        
        for (let i = 1; i < lines.length; i++) {
            const [code, description] = lines[i].split(',').map(item => item.trim());
            if (code && description && !allCatalog.some(item => item.code.toLowerCase() === code.toLowerCase())) {
                writePromises.push(setDoc(doc(db, 'catalog', code), {
                    code,
                    description
                }));
            }
        }
        
        await Promise.all(writePromises);
        await loadCatalog();
        updateCatalogTable();
        showNotification('Catálogo importado correctamente');
    } catch (error) {
        console.error('Error al importar catálogo:', error);
        showNotification('Error al importar el catálogo.', 'error');
    }
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }, 100);
}

function sortItems(field) {
    if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortDirection = 'asc';
    }

    filteredItems.sort((a, b) => {
        const valA = a[field] || '';
        const valB = b[field] || '';
        if (field === 'timestamp') {
            return sortDirection === 'asc' 
                ? new Date(valA) - new Date(valB) 
                : new Date(valB) - new Date(valA);
        }
        return sortDirection === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
    });

    document.querySelectorAll('.items-table th span').forEach(span => {
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
        const valA = a[field] || '';
        const valB = b[field] || '';
        return catalogSortDirection === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
    });

    document.querySelectorAll('#catalogTableBody th span').forEach(span => {
        span.textContent = '↕️';
    });
    document.getElementById(`sort-catalog-${field}`).textContent = catalogSortDirection === 'asc' ? '↑' : '↓';
    currentCatalogPage = 1;
    updateCatalogTable();
}

// Exponer funciones al ámbito global
window.applyChanges = applyChanges;
window.updateAisleConfigs = updateAisleConfigs;
window.updateEstanteSelect = updateEstanteSelect;
window.updateCasillaSelect = updateCasillaSelect;
window.addItem = addItem;
window.saveItemToModal = saveItemToModal;
window.removeItem = removeItem;
window.clearAllItems = clearAllItems;
window.bulkDelete = bulkDelete;
window.bulkExport = bulkExport;
window.editItemInline = editItemInline;
window.closeCasillModal = closeCasillModal;
window.closeItemModal = closeItemModal;
window.autoFillDescription = autoFillDescription;
window.autoFillModalDescription = autoFillModalDescription;
window.exportData = exportData;
window.importData = importData;
window.addToCatalog = addToCatalog;
window.removeFromCatalog = removeFromCatalog;
window.clearCatalog = clearCatalog;
window.exportCatalog = exportCatalog;
window.importCatalogCSV = importCatalogCSV;
window.toggleSelectAll = toggleSelectAll;
window.previousPage = previousPage;
window.nextPage = nextPage;
window.previousCatalogPage = previousCatalogPage;
window.nextCatalogPage = nextCatalogPage;
window.sortItems = sortItems;
window.sortCatalog = sortCatalog;