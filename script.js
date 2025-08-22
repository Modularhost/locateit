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

let currentView = 'mapa';
let currentPage = 1;
let currentCatalogPage = 1;
const itemsPerPage = 10;
const maxItemsPerCasilla = 20;
let allItems = [];
let filteredItems = [];
let allCatalog = [];
let filteredCatalog = [];
let currentModal = null;
let selectedItems = new Set();
let sortField = 'code';
let sortDirection = 'asc';
let catalogSortField = 'code';
let catalogSortDirection = 'asc';
let warehouseConfig = {
    pasillos: 4,
    aisleConfigs: Array(4).fill().map(() => ({ estantes: 4, casillas: 6 }))
};

document.addEventListener('DOMContentLoaded', async function() {
    await loadWarehouseConfig();
    updateAisleConfigs();
    await loadItems();
    await loadCatalog();
    generateWarehouse();
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
}

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
    }
}

function generateWarehouse() {
    const grid = document.getElementById('warehouseGrid');
    grid.innerHTML = '';

    console.log('Generando almacén con configuración:', warehouseConfig);

    for (let p = 1; p <= warehouseConfig.pasillos; p++) {
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
            casillasGrid.style.gridTemplateColumns = `repeat(${config.casillas}, 60px)`; // Dynamically set columns based on config

            for (let c = 1; c <= config.casillas; c++) {
                const casilla = document.createElement('div');
                casilla.className = 'casilla';
                const location = `${p}-${estanteLabels[e]}-C${c}`;
                casilla.dataset.location = location;
                casilla.addEventListener('click', () => openCasillModal(location));
                
                const itemsInCasilla = allItems.filter(item => item.location === location);
                if (itemsInCasilla.length > 0) {
                    casilla.classList.add('occupied');
                    const badge = document.createElement('span');
                    badge.className = 'item-count-badge';
                    badge.textContent = itemsInCasilla.length;
                    casilla.appendChild(badge);
                    casilla.title = itemsInCasilla.map(item => `${item.code} - ${item.description}`).join('\n');
                }
                casilla.textContent = `C${c}`;

                casillasGrid.appendChild(casilla);
            }

            estanteDiv.appendChild(casillasGrid);
            estantesDiv.appendChild(estanteDiv);
        }

        pasilloDiv.appendChild(estantesDiv);
        grid.appendChild(pasilloDiv);
    }
}

function updateLocationSelectors() {
    const pasilloSelect = document.getElementById('pasilloSelect');
    pasilloSelect.innerHTML = '<option value="">Seleccionar pasillo</option>';
    
    for (let p = 1; p <= warehouseConfig.pasillos; p++) {
        const option = document.createElement('option');
        option.value = p;
        option.textContent = `Pasillo ${p}`;
        pasilloSelect.appendChild(option);
    }
}

function updateEstanteSelect() {
    const pasilloSelect = document.getElementById('pasilloSelect');
    const estanteSelect = document.getElementById('estanteSelect');
    const casillaSelect = document.getElementById('casillaSelect');
    
    estanteSelect.innerHTML = '<option value="">Seleccionar estante</option>';
    casillaSelect.innerHTML = '<option value="">Seleccionar casilla</option>';
    casillaSelect.disabled = true;
    
    const pasillo = parseInt(pasilloSelect.value);
    if (pasillo) {
        estanteSelect.disabled = false;
        const config = warehouseConfig.aisleConfigs[pasillo - 1] || { estantes: 4, casillas: 6 };
        const estanteLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        
        for (let e = 0; e < config.estantes; e++) {
            const option = document.createElement('option');
            option.value = estanteLabels[e];
            option.textContent = `Estante ${estanteLabels[e]}`;
            estanteSelect.appendChild(option);
        }
    } else {
        estanteSelect.disabled = true;
    }
}

function updateCasillaSelect() {
    const pasilloSelect = document.getElementById('pasilloSelect');
    const estanteSelect = document.getElementById('estanteSelect');
    const casillaSelect = document.getElementById('casillaSelect');
    
    casillaSelect.innerHTML = '<option value="">Seleccionar casilla</option>';
    
    const pasillo = parseInt(pasilloSelect.value);
    const estante = estanteSelect.value;
    if (pasillo && estante) {
        casillaSelect.disabled = false;
        const config = warehouseConfig.aisleConfigs[pasillo - 1] || { estantes: 4, casillas: 6 };
        
        for (let c = 1; c <= config.casillas; c++) {
            const location = `${pasillo}-${estante}-C${c}`;
            const itemsInCasilla = allItems.filter(item => item.location === location);
            if (itemsInCasilla.length < maxItemsPerCasilla) {
                const option = document.createElement('option');
                option.value = `C${c}`;
                option.textContent = `Casilla ${c} (${itemsInCasilla.length}/${maxItemsPerCasilla})`;
                casillaSelect.appendChild(option);
            }
        }
        
        if (casillaSelect.children.length === 1) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No hay casillas disponibles';
            option.disabled = true;
            casillaSelect.appendChild(option);
        }
    } else {
        casillaSelect.disabled = true;
    }
}

function sortItems(field) {
    if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortDirection = 'asc';
    }

    document.querySelectorAll('[id^="sort-"]').forEach(span => {
        span.textContent = '↕️';
    });
    
    const indicator = document.getElementById(`sort-${field}`);
    if (indicator) {
        indicator.textContent = sortDirection === 'asc' ? '↑' : '↓';
    }

    filteredItems.sort((a, b) => {
        let aVal = a[field] || '';
        let bVal = b[field] || '';
        
        if (field === 'timestamp') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        }
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    updateItemsTable();
}

function sortCatalog(field) {
    if (catalogSortField === field) {
        catalogSortDirection = catalogSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        catalogSortField = field;
        catalogSortDirection = 'asc';
    }

    document.querySelectorAll('[id^="sort-catalog-"]').forEach(span => {
        span.textContent = '↕️';
    });
    
    const indicator = document.getElementById(`sort-catalog-${field}`);
    if (indicator) {
        indicator.textContent = catalogSortDirection === 'asc' ? '↑' : '↓';
    }

    filteredCatalog.sort((a, b) => {
        let aVal = a[field] || '';
        let bVal = b[field] || '';
        
        if (aVal < bVal) return catalogSortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return catalogSortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    updateCatalogTable();
}

function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const itemCheckboxes = document.querySelectorAll('input[name="itemSelect"]');
    
    itemCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
        if (selectAllCheckbox.checked) {
            selectedItems.add(checkbox.value);
        } else {
            selectedItems.delete(checkbox.value);
        }
    });
    
    toggleBulkActions();
}

function toggleItemSelection(itemId, checked) {
    if (checked) {
        selectedItems.add(itemId);
    } else {
        selectedItems.delete(itemId);
    }
    
    const totalItems = document.querySelectorAll('input[name="itemSelect"]').length;
    const selectedCount = selectedItems.size;
    const selectAllCheckbox = document.getElementById('selectAll');
    
    selectAllCheckbox.checked = selectedCount === totalItems && totalItems > 0;
    selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalItems;
    
    toggleBulkActions();
}

function toggleBulkActions() {
    const bulkActions = document.getElementById('bulkActions');
    bulkActions.style.display = selectedItems.size > 0 ? 'block' : 'none';
}

async function bulkDelete() {
    if (selectedItems.size === 0) return;
    
    if (confirm(`¿Estás seguro de eliminar ${selectedItems.size} ítems?`)) {
        const deletePromises = Array.from(selectedItems).map(itemId => {
            const [location, code] = itemId.split('|');
            return updateDoc(doc(db, 'items', location), {
                items: arrayRemove({ code, timestamp: allItems.find(item => item.id === itemId).timestamp })
            });
        });
        
        try {
            await Promise.all(deletePromises);
            selectedItems.clear();
            await loadItems();
            generateWarehouse();
            updateItemsTable();
            updateLocationSelectors();
            showNotification(`${deletePromises.length} ítems eliminados`);
        } catch (error) {
            console.error('Error en eliminación masiva:', error);
            alert('Error al eliminar algunos ítems');
        }
    }
}

function bulkExport() {
    if (selectedItems.size === 0) return;
    
    const selectedItemsData = allItems.filter(item => selectedItems.has(item.id));
    const data = {
        items: selectedItemsData,
        exportDate: new Date().toISOString(),
        count: selectedItemsData.length
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `items_seleccionados_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification(`${selectedItemsData.length} ítems exportados`);
}

function openCasillModal(location) {
    currentModal = location;
    const modal = document.getElementById('casillModal');
    const title = document.getElementById('modalTitle');
    title.textContent = `Gestionar Casilla ${location}`;

    const itemsList = document.getElementById('modalItemsList');
    itemsList.innerHTML = '';

    const itemsInCasilla = allItems.filter(item => item.location === location);
    if (itemsInCasilla.length > 0) {
        const ul = document.createElement('ul');
        ul.style.listStyle = 'none';
        ul.style.padding = '0';
        itemsInCasilla.forEach(item => {
            const li = document.createElement('li');
            li.style.marginBottom = '0.5rem';
            li.innerHTML = `
                <strong>${item.code}</strong> - ${item.description}
                <button class="btn btn-secondary" onclick="removeItemFromModal('${item.id}')" 
                        style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background: #dc3545; color: white; margin-left: 0.5rem;">🗑️</button>
            `;
            ul.appendChild(li);
        });
        itemsList.appendChild(ul);
    } else {
        itemsList.textContent = 'No hay ítems en esta casilla.';
    }

    document.getElementById('modalItemCode').value = '';
    document.getElementById('modalItemDescription').value = '';
    modal.style.display = 'block';
}

function closeCasillModal() {
    document.getElementById('casillModal').style.display = 'none';
    currentModal = null;
}

async function saveItemToModal() {
    if (!currentModal) return;

    const code = document.getElementById('modalItemCode').value.trim().toUpperCase();
    const description = document.getElementById('modalItemDescription').value.trim();

    if (!code) {
        alert('El código del ítem es requerido');
        return;
    }

    const catalogItem = allCatalog.find(item => item.code === code);
    if (!catalogItem) {
        alert('Este código no existe en el catálogo. Agrégalo primero al catálogo.');
        return;
    }

    const itemsInCasilla = allItems.filter(item => item.location === currentModal);
    if (itemsInCasilla.length >= maxItemsPerCasilla) {
        alert(`No se pueden agregar más ítems. Límite de ${maxItemsPerCasilla} ítems por casilla alcanzado.`);
        return;
    }

    const itemData = {
        code: code,
        description: catalogItem.description,
        timestamp: new Date().toISOString()
    };

    try {
        const docRef = doc(db, 'items', currentModal);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            await updateDoc(docRef, {
                items: arrayUnion(itemData)
            });
        } else {
            await setDoc(docRef, {
                location: currentModal,
                items: [itemData]
            });
        }
        await loadItems();
        generateWarehouse();
        updateItemsTable();
        updateLocationSelectors();
        closeCasillModal();
        showNotification('Ítem guardado correctamente');
    } catch (error) {
        console.error('Error al guardar:', error);
        alert('Error al guardar el ítem');
    }
}

async function removeItemFromModal(itemId) {
    if (!currentModal) return;

    const [location, code] = itemId.split('|');
    const itemToRemove = allItems.find(item => item.id === itemId);

    try {
        await updateDoc(doc(db, 'items', currentModal), {
            items: arrayRemove({ code: itemToRemove.code, timestamp: itemToRemove.timestamp })
        });
        await loadItems();
        generateWarehouse();
        updateItemsTable();
        updateLocationSelectors();
        openCasillModal(currentModal);
        showNotification('Ítem eliminado correctamente');
    } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Error al eliminar el ítem');
    }
}

function openItemModal(item) {
    document.getElementById('itemCodeView').textContent = item.code;
    document.getElementById('itemDescriptionView').textContent = item.description;
    const [pasillo, estante, casilla] = item.location.split('-');
    document.getElementById('itemLocationView').textContent = `Pasillo ${pasillo}, Estante ${estante}, Casilla ${casilla.replace('C', '')}`;
    document.getElementById('itemModal').style.display = 'block';
}

function closeItemModal() {
    document.getElementById('itemModal').style.display = 'none';
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
    
    const pasillo = document.getElementById('pasilloSelect').value;
    const estante = document.getElementById('estanteSelect').value;
    const casilla = document.getElementById('casillaSelect').value;

    if (!code) {
        alert('El código del ítem es requerido');
        return;
    }

    if (!pasillo || !estante || !casilla) {
        alert('Selecciona una ubicación completa (pasillo, estante y casilla)');
        return;
    }

    const catalogItem = allCatalog.find(item => item.code === code);
    if (!catalogItem) {
        alert('Este código no existe en el catálogo. Agrégalo primero al catálogo.');
        return;
    }

    const location = `${pasillo}-${estante}-${casilla}`;
    const itemsInCasilla = allItems.filter(item => item.location === location);
    if (itemsInCasilla.length >= maxItemsPerCasilla) {
        alert(`No se pueden agregar más ítems. Límite de ${maxItemsPerCasilla} ítems por casilla alcanzado.`);
        return;
    }

    const itemData = {
        code: code,
        description: catalogItem.description,
        timestamp: new Date().toISOString()
    };

    try {
        const docRef = doc(db, 'items', location);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            await updateDoc(docRef, {
                items: arrayUnion(itemData)
            });
        } else {
            await setDoc(docRef, {
                location: location,
                items: [itemData]
            });
        }
        await loadItems();
        generateWarehouse();
        updateItemsTable();
        updateCatalogTable();
        updateLocationSelectors();
        
        document.getElementById('itemCode').value = '';
        document.getElementById('itemDescription').value = '';
        document.getElementById('pasilloSelect').value = '';
        document.getElementById('estanteSelect').value = '';
        document.getElementById('casillaSelect').value = '';
        document.getElementById('estanteSelect').disabled = true;
        document.getElementById('casillaSelect').disabled = true;
        
        showNotification('Ítem ubicado correctamente');
    } catch (error) {
        console.error('Error al ubicar ítem:', error);
        alert('Error al ubicar el ítem');
    }
}

async function removeItem(itemId) {
    if (confirm('¿Estás seguro de que quieres eliminar este ítem?')) {
        const [location, code] = itemId.split('|');
        const itemToRemove = allItems.find(item => item.id === itemId);
        
        try {
            await updateDoc(doc(db, 'items', location), {
                items: arrayRemove({ code: itemToRemove.code, timestamp: itemToRemove.timestamp })
            });
            selectedItems.delete(itemId);
            await loadItems();
            generateWarehouse();
            updateItemsTable();
            updateLocationSelectors();
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

function updateAisleConfigs() {
    const pasillos = parseInt(document.getElementById('pasillosInput').value) || 4;
    const configsDiv = document.getElementById('aisleConfigs');
    configsDiv.innerHTML = '';

    warehouseConfig.pasillos = pasillos;
    if (!Array.isArray(warehouseConfig.aisleConfigs)) {
        warehouseConfig.aisleConfigs = Array(pasillos).fill().map(() => ({ estantes: 4, casillas: 6 }));
    } else if (warehouseConfig.aisleConfigs.length > pasillos) {
        warehouseConfig.aisleConfigs = warehouseConfig.aisleConfigs.slice(0, pasillos);
    } else {
        while (warehouseConfig.aisleConfigs.length < pasillos) {
            warehouseConfig.aisleConfigs.push({ estantes: 4, casillas: 6 });
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
        await loadWarehouseConfig();
        updateAisleConfigs();
        generateWarehouse();
        updateLocationSelectors();
        showNotification('Configuración aplicada correctamente');
    } catch (error) {
        console.error('Error al aplicar cambios:', error);
        alert('Error al aplicar los cambios');
    }
}

function revertChanges() {
    loadWarehouseConfig().then(() => {
        updateAisleConfigs();
        generateWarehouse();
        updateLocationSelectors();
        showNotification('Cambios revertidos');
    });
}

function exportData() {
    const data = {
        config: warehouseConfig,
        items: allItems,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bodega_backup_${new Date().toISOString().split('T')[0]}.json`;
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
            let data;
            
            if (file.name.endsWith('.json')) {
                data = JSON.parse(e.target.result);
                await importFromJSON(data);
            } else if (file.name.endsWith('.csv')) {
                await importFromCSV(e.target.result);
            }
            
            showNotification('Datos importados correctamente');
        } catch (error) {
            console.error('Error al importar:', error);
            alert('Error al importar los datos. Verifica el formato del archivo.');
        }
    };
    
    reader.readAsText(file);
}

async function importFromJSON(data) {
    if (data.config) {
        warehouseConfig = data.config;
        if (!Array.isArray(warehouseConfig.aisleConfigs)) {
            warehouseConfig.aisleConfigs = Array(warehouseConfig.pasillos || 4).fill().map(() => ({ estantes: 4, casillas: 6 }));
        }
        await saveWarehouseConfig();
        document.getElementById('pasillosInput').value = warehouseConfig.pasillos;
        updateAisleConfigs();
    }

    if (data.items && Array.isArray(data.items)) {
        const groupedByLocation = data.items.reduce((acc, item) => {
            if (!acc[item.location]) acc[item.location] = [];
            acc[item.location].push({
                code: item.code,
                description: item.description || '',
                timestamp: item.timestamp || new Date().toISOString()
            });
            return acc;
        }, {});

        const importPromises = Object.entries(groupedByLocation).map(([location, items]) => {
            return setDoc(doc(db, 'items', location), {
                location,
                items: items.slice(0, maxItemsPerCasilla)
            });
        });
        
        await Promise.all(importPromises);
    }

    await loadItems();
    generateWarehouse();
    updateItemsTable();
    updateLocationSelectors();
}

async function importFromCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const requiredColumns = ['code', 'location'];
    const hasRequired = requiredColumns.every(col => headers.includes(col));
    
    if (!hasRequired) {
        alert('El CSV debe contener al menos las columnas: code, location');
        return;
    }

    const groupedByLocation = {};
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1'));
        const item = {};
        
        headers.forEach((header, index) => {
            item[header] = values[index] || '';
        });

        if (item.code && item.location) {
            if (!groupedByLocation[item.location]) groupedByLocation[item.location] = [];
            groupedByLocation[item.location].push({
                code: item.code,
                description: item.description || '',
                timestamp: new Date().toISOString()
            });
        }
    }

    const importPromises = Object.entries(groupedByLocation).map(([location, items]) => {
        return setDoc(doc(db, 'items', location), {
            location,
            items: items.slice(0, maxItemsPerCasilla)
        });
    });

    await Promise.all(importPromises);
    await loadItems();
    generateWarehouse();
    updateItemsTable();
    updateLocationSelectors();
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

function showNotification(message) {
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

window.addEventListener('click', function(event) {
    const casillModal = document.getElementById('casillModal');
    if (event.target === casillModal) {
        closeCasillModal();
    }
    const itemModal = document.getElementById('itemModal');
    if (event.target === itemModal) {
        closeItemModal();
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeCasillModal();
        closeItemModal();
    }
    
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const searchInput = currentView === 'items' ? 
            document.getElementById('itemsSearchInput') : 
            document.getElementById('searchInput');
        searchInput.focus();
    }

    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        exportData();
    }
});

window.addItem = addItem;
window.removeItem = removeItem;
window.clearAllItems = clearAllItems;
window.openCasillModal = openCasillModal;
window.closeCasillModal = closeCasillModal;
window.saveItemToModal = saveItemToModal;
window.removeItemFromModal = removeItemFromModal;
window.applyChanges = applyChanges;
window.revertChanges = revertChanges;
window.exportData = exportData;
window.importData = importData;
window.previousPage = previousPage;
window.nextPage = nextPage;
window.updateEstanteSelect = updateEstanteSelect;
window.updateCasillaSelect = updateCasillaSelect;
window.toggleSelectAll = toggleSelectAll;
window.toggleItemSelection = toggleItemSelection;
window.bulkDelete = bulkDelete;
window.bulkExport = bulkExport;
window.sortItems = sortItems;
window.editItemInline = editItemInline;
window.autoFillDescription = autoFillDescription;
window.autoFillModalDescription = autoFillModalDescription;
window.addToCatalog = addToCatalog;
window.removeCatalogItem = removeCatalogItem;
window.quickLocateItem = quickLocateItem;
window.clearCatalog = clearCatalog;
window.exportCatalog = exportCatalog;
window.importCatalogCSV = importCatalogCSV;
window.sortCatalog = sortCatalog;
window.previousCatalogPage = previousCatalogPage;
window.nextCatalogPage = nextCatalogPage;
window.closeItemModal = closeItemModal;
window.updateAisleConfigs = updateAisleConfigs;