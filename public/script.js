const API = '/api';

let inventoryData = [];
let movementData = [];


// ======================================
// PAGE NAVIGATION
// ======================================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    document.querySelectorAll('.nav-link').forEach(button => {
        button.classList.remove('active');
    });

    document.getElementById(pageId).classList.add('active');

    const selectedButton = document.querySelector(
        `.nav-link[data-page="${pageId}"]`
    );

    if (selectedButton) {
        selectedButton.classList.add('active');
    }

    const titles = {
        dashboard: 'Dashboard Overview',
        inventory: 'Inventory Management',
        movements: 'Stock Movements',
        warehouses: 'Warehouse Overview',
        reports: 'Reports & Summary'
    };

    document.getElementById('pageTitle').textContent = titles[pageId];
    document.getElementById('breadcrumb').textContent = titles[pageId];
}

document.querySelectorAll('.nav-link').forEach(button => {
    button.addEventListener('click', () => {
        showPage(button.dataset.page);
    });
});


// ======================================
// NOTIFICATION
// ======================================

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    if (isError) {
        toast.style.background = '#d94b43';
        toast.style.color = '#ffffff';
    } else {
        toast.style.background = '#56351f';
        toast.style.color = '#ffffff';
    }
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}


// ======================================
// POPUP FORMS
// ======================================

function openForm(formId) {
    document.getElementById(formId).classList.add('show');
}

function closeForm(formId) {
    document.getElementById(formId).classList.remove('show');
}

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', event => {
        if (event.target === modal) {
            modal.classList.remove('show');
        }
    });
});


// ======================================
// DATABASE FETCH
// ======================================

async function fetchData(endpoint) {
    const response = await fetch(`${API}/${endpoint}`);

    if (!response.ok) {
        throw new Error(`Unable to load ${endpoint}`);
    }

    return response.json();
}


// ======================================
// LOAD INVENTORY
// ======================================

async function loadInventory() {
    try {
        inventoryData = await fetchData('inventory');

        renderInventory();
        renderDashboard();
        renderWarehouses();
        renderReports();

    } catch (error) {
        console.error(error);
        showToast('Could not load inventory. Check database connection.');
    }
}


// ======================================
// LOAD STOCK MOVEMENTS
// ======================================

async function loadMovements() {
    try {
        movementData = await fetchData('movements');

        renderMovements();
        renderDashboard();
        renderReports();

    } catch (error) {
        console.error(error);
        showToast('Could not load stock movements.');
    }
}


// ======================================
// INVENTORY STATUS
// ======================================

function getStockStatus(quantity) {
    quantity = Number(quantity);

    if (quantity === 0) {
        return '<span class="badge badge-empty">Out of Stock</span>';
    }

    if (quantity < 50) {
        return '<span class="badge badge-low">Low Stock</span>';
    }

    return '<span class="badge badge-good">Available</span>';
}


// ======================================
// RENDER INVENTORY TABLE
// ======================================

function renderInventory() {
    const body = document.getElementById('inventoryBody');

    if (!body) return;

    const search = (
        document.getElementById('inventorySearch')?.value || ''
    ).toLowerCase();

    const filter =
        document.getElementById('stockFilter')?.value || 'all';

    const filtered = inventoryData.filter(item => {
        const matchesSearch =
            String(item.batch_id).includes(search) ||
            String(item.warehouse_id).includes(search);

        const quantity = Number(item.quantity);

        let matchesFilter = true;

        if (filter === 'low') {
            matchesFilter = quantity > 0 && quantity < 50;
        }

        if (filter === 'available') {
            matchesFilter = quantity >= 50;
        }

        if (filter === 'empty') {
            matchesFilter = quantity === 0;
        }

        return matchesSearch && matchesFilter;
    });

    body.innerHTML = '';

    if (filtered.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="6" class="empty-message">
                    No matching inventory records found.
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(item => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>#${item.inventory_id}</td>
            <td>${item.batch_id}</td>
            <td>${item.warehouse_id}</td>
            <td><strong>${item.quantity}</strong></td>
            <td>${formatDate(item.last_updated)}</td>
            <td>${getStockStatus(item.quantity)}</td>
        `;

        body.appendChild(row);
    });
}


// ======================================
// RENDER MOVEMENTS TABLE
// ======================================

function renderMovements() {
    const body = document.getElementById('movementBody');

    if (!body) return;

    const search = (
        document.getElementById('movementSearch')?.value || ''
    ).toLowerCase();

    const filter =
        document.getElementById('movementFilter')?.value || 'all';

    const filtered = movementData.filter(item => {
        const matchesSearch =
            String(item.movement_id).includes(search) ||
            String(item.batch_id).includes(search);

        const matchesFilter =
            filter === 'all' || item.movement_type === filter;

        return matchesSearch && matchesFilter;
    });

    body.innerHTML = '';

    if (filtered.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="7" class="empty-message">
                    No stock movements found.
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(item => {
        const type = item.movement_type;

        let badgeClass = 'badge-in';

        if (type === 'OUT') badgeClass = 'badge-out';
        if (type === 'TRANSFER') badgeClass = 'badge-transfer';

        const row = document.createElement('tr');

        row.innerHTML = `
            <td>#${item.movement_id}</td>
            <td>${item.batch_id}</td>
            <td>${item.from_warehouse ?? '-'}</td>
            <td>${item.to_warehouse ?? '-'}</td>
            <td><strong>${item.quantity}</strong></td>
            <td><span class="badge ${badgeClass}">${type}</span></td>
            <td>${formatDate(item.movement_date)}</td>
        `;

        body.appendChild(row);
    });
}


// ======================================
// DASHBOARD
// ======================================

function renderDashboard() {
    const totalStock = inventoryData.reduce(
        (sum, item) => sum + Number(item.quantity), 0
    );

    const lowStock = inventoryData.filter(
        item => Number(item.quantity) > 0 &&
                Number(item.quantity) < 50
    ).length;

    document.getElementById('totalStock').textContent =
        totalStock.toLocaleString();

    document.getElementById('recordCount').textContent =
        inventoryData.length;

    document.getElementById('lowStock').textContent =
        lowStock;

    document.getElementById('movementCount').textContent =
        movementData.length;


    // Recent inventory

    const inventoryBody =
        document.getElementById('dashboardInventory');

    inventoryBody.innerHTML = '';

    inventoryData.slice(0, 5).forEach(item => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>#${item.inventory_id}</td>
            <td>${item.batch_id}</td>
            <td>${item.warehouse_id}</td>
            <td>${item.quantity}</td>
            <td>${getStockStatus(item.quantity)}</td>
        `;

        inventoryBody.appendChild(row);
    });


    // Recent movements

    const movementBody =
        document.getElementById('dashboardMovements');

    movementBody.innerHTML = '';

    movementData.slice(0, 5).forEach(item => {
        let badgeClass = 'badge-in';

        if (item.movement_type === 'OUT') {
            badgeClass = 'badge-out';
        }

        if (item.movement_type === 'TRANSFER') {
            badgeClass = 'badge-transfer';
        }

        const row = document.createElement('tr');

        row.innerHTML = `
            <td>#${item.movement_id}</td>
            <td>${item.batch_id}</td>
            <td><span class="badge ${badgeClass}">
                ${item.movement_type}
            </span></td>
            <td>${item.quantity}</td>
            <td>${formatDate(item.movement_date)}</td>
        `;

        movementBody.appendChild(row);
    });
}


// ======================================
// WAREHOUSE OVERVIEW
// ======================================

function renderWarehouses() {
    const grid = document.getElementById('warehouseGrid');

    const warehouses = {};

    inventoryData.forEach(item => {
        const id = item.warehouse_id;

        if (!warehouses[id]) {
            warehouses[id] = {
                records: 0,
                quantity: 0
            };
        }

        warehouses[id].records++;
        warehouses[id].quantity += Number(item.quantity);
    });

    grid.innerHTML = '';

    const ids = Object.keys(warehouses);

    if (ids.length === 0) {
        grid.innerHTML = '<p>No warehouse records available.</p>';
        return;
    }

    ids.forEach(id => {
        const warehouse = warehouses[id];

        const card = document.createElement('div');

        card.className = 'warehouse-card';

        card.innerHTML = `
            <div class="warehouse-symbol">🏭</div>
            <h3>Warehouse ${id}</h3>
            <p>${warehouse.records} inventory records</p>
            <strong>${warehouse.quantity.toLocaleString()} units</strong>
        `;

        grid.appendChild(card);
    });
}


// ======================================
// REPORTS
// ======================================

async function renderReports() {
    const total = inventoryData.reduce(
        (sum, item) => sum + Number(item.quantity), 0
    );

    const low = inventoryData.filter(
        item => Number(item.quantity) > 0 &&
                Number(item.quantity) < 50
    ).length;

    document.getElementById('reportStock').textContent =
        total.toLocaleString();

    document.getElementById('reportRecords').textContent =
        inventoryData.length;

    document.getElementById('reportLow').textContent = low;

    document.getElementById('reportMovements').textContent =
        movementData.length;


    const summary = {};

    inventoryData.forEach(item => {
        const id = item.warehouse_id;

        if (!summary[id]) {
            summary[id] = {
                records: 0,
                quantity: 0
            };
        }

        summary[id].records++;
        summary[id].quantity += Number(item.quantity);
    });

    const body = document.getElementById('reportBody');
    if (body) {
        body.innerHTML = '';
        Object.entries(summary).forEach(([id, data]) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>Warehouse ${id}</td>
                <td>${data.records}</td>
                <td><strong>${data.quantity}</strong></td>
            `;
            body.appendChild(row);
        });
    }

    // Populate Low Stock Report table directly from stored procedure GetLowStock
    const lowStockTable = document.getElementById('lowStockReportTable');
    if (lowStockTable) {
        try {
            const lowItems = await fetchData('inventory/low-stock?threshold=50');
            lowStockTable.innerHTML = '';
            if (!lowItems || lowItems.length === 0) {
                lowStockTable.innerHTML = '<tr><td colspan="5" class="empty-message">No low stock items currently detected.</td></tr>';
            } else {
                lowItems.forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>#${item.inventory_id}</td>
                        <td>${item.batch_id}</td>
                        <td>${item.warehouse_id}</td>
                        <td><strong>${item.quantity}</strong></td>
                        <td>${getStockStatus(item.quantity)}</td>
                    `;
                    lowStockTable.appendChild(row);
                });
            }
        } catch (e) {
            console.error('Could not load low stock report', e);
        }
    }
}


// ======================================
// DATE FORMATTING
// ======================================

function formatDate(date) {
    if (!date) return '-';

    const parsed = new Date(date);

    if (isNaN(parsed.getTime())) return date;

    return parsed.toLocaleString();
}


// ======================================
// REFRESH ALL DATA
// ======================================

async function refreshData() {
    await Promise.all([
        loadInventory(),
        loadMovements()
    ]);

    showToast('Data refreshed successfully!');
}


// ======================================
// AUTOMATIC REFRESH
// ======================================

refreshData();

setInterval(() => {
    loadInventory();
    loadMovements();
}, 10000);


// ======================================
// ADD STOCK FORM
// ======================================

document.getElementById('addStockForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const batch_id = document.getElementById('addBatch').value;
    const warehouse_id = document.getElementById('addWarehouse').value;
    const quantity = document.getElementById('addQuantity').value;

    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
        const response = await fetch('/api/stock/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch_id, warehouse_id, quantity })
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            showToast(data.error || 'Failed to add stock.', true);
            return;
        }

        showToast(data.message || 'Stock added successfully!');
        this.reset();
        closeForm('stockForm');
        await refreshData();
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Network error.', true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});


// ======================================
// NEW MOVEMENT FORM
// ======================================

// Helper: dynamic field hints based on movement type
const movementTypeSelect = document.getElementById('newMovementType');
if (movementTypeSelect) {
    movementTypeSelect.addEventListener('change', function() {
        const moveFromInput = document.getElementById('moveFrom');
        const moveToInput = document.getElementById('moveTo');
        if (this.value === 'IN') {
            moveFromInput.placeholder = 'Optional / External';
            moveToInput.placeholder = 'Warehouse ID (Destination)';
            moveToInput.required = true;
            moveFromInput.required = false;
        } else if (this.value === 'OUT') {
            moveFromInput.placeholder = 'Warehouse ID (Source)';
            moveToInput.placeholder = 'Optional / Customer';
            moveFromInput.required = true;
            moveToInput.required = false;
        } else if (this.value === 'TRANSFER') {
            moveFromInput.placeholder = 'Source Warehouse ID';
            moveToInput.placeholder = 'Destination Warehouse ID';
            moveFromInput.required = true;
            moveToInput.required = true;
        }
    });
}

document.getElementById('newMovementForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const movement_type = document.getElementById('newMovementType').value;
    const batch_id = document.getElementById('moveBatch').value;
    const quantity = document.getElementById('moveQuantity').value;
    const from_warehouse = document.getElementById('moveFrom').value || null;
    const to_warehouse = document.getElementById('moveTo').value || null;

    if (movement_type === 'IN' && !to_warehouse && !from_warehouse) {
        showToast('Please specify a warehouse ID.', true);
        return;
    }
    if (movement_type === 'OUT' && !from_warehouse && !to_warehouse) {
        showToast('Please specify a warehouse ID.', true);
        return;
    }
    if (movement_type === 'TRANSFER' && (!from_warehouse || !to_warehouse)) {
        showToast('Both source and destination warehouses are required for transfer.', true);
        return;
    }

    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    try {
        const response = await fetch('/api/movements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                movement_type,
                batch_id,
                quantity,
                from_warehouse,
                to_warehouse
            })
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            showToast(data.error || 'Failed to record movement.', true);
            return;
        }

        showToast(data.message || 'Movement recorded successfully!');
        this.reset();
        closeForm('movementForm');
        await refreshData();
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Network error.', true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});



// ======================================
// REMOVE STOCK FORM
// ======================================

const removeStockFormEl = document.getElementById('removeStockForm');
if (removeStockFormEl) {
    removeStockFormEl.addEventListener('submit', async function(event) {
        event.preventDefault();

        const batch_id = document.getElementById('removeBatch').value;
        const warehouse_id = document.getElementById('removeWarehouse').value;
        const quantity = document.getElementById('removeQuantity').value;

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Removing...';

        try {
            const response = await fetch('/api/stock/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch_id, warehouse_id, quantity })
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                showToast(data.error || 'Failed to remove stock.', true);
                return;
            }

            showToast(data.message || 'Stock removed successfully!');
            this.reset();
            closeForm('removeStockModal');
            await refreshData();
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Network error.', true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}
