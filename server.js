const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from public/
app.use(express.static(path.join(__dirname, 'public')));

// MySQL Connection Pool Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'warehouse_app',
  password: process.env.DB_PASSWORD || 'WhApp_2026!Secure',
  database: process.env.DB_NAME || 'warehouse_tracking',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

const pool = mysql.createPool(dbConfig);

// Helper to extract clean error messages from MySQL exceptions / triggers
function getMySQLErrorMessage(err) {
  if (err.sqlMessage) {
    return err.sqlMessage;
  }
  if (err.message) {
    return err.message;
  }
  return 'Database operation failed';
}

// -------------------------------------------------------------
// GET /api/health - Test Database Connection
// -------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT VERSION() AS version, DATABASE() AS database_name, CURRENT_USER() AS db_user');
    connection.release();

    res.json({
      status: 'connected',
      database: rows[0].database_name,
      user: rows[0].db_user,
      version: rows[0].version
    });
  } catch (err) {
    res.status(500).json({
      status: 'disconnected',
      error: getMySQLErrorMessage(err)
    });
  }
});

// -------------------------------------------------------------
// GET /api/inventory - Retrieve all inventory via stored procedure GetInventory()
// -------------------------------------------------------------
app.get('/api/inventory', async (req, res) => {
  try {
    // Calling user's existing stored procedure: GetInventory
    const [procedureResult] = await pool.query('CALL GetInventory()');
    const inventory = procedureResult[0] || [];
    res.json(inventory);
  } catch (err) {
    console.error('Error in GET /api/inventory:', err);
    res.status(500).json({ error: getMySQLErrorMessage(err) });
  }
});

// -------------------------------------------------------------
// GET /api/movements - Retrieve stock movement history
// -------------------------------------------------------------
app.get('/api/movements', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT movement_id, batch_id, from_warehouse, to_warehouse, quantity, movement_type, movement_date, remarks FROM Stock_Movements ORDER BY movement_date DESC, movement_id DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error in GET /api/movements:', err);
    res.status(500).json({ error: getMySQLErrorMessage(err) });
  }
});

// -------------------------------------------------------------
// GET /api/inventory/low-stock - Retrieve low stock via stored procedure GetLowStock(?)
// -------------------------------------------------------------
app.get('/api/inventory/low-stock', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || req.query.threshold || process.env.LOW_STOCK_DEFAULT_LIMIT || '50', 10);
    // Calling user's existing stored procedure: GetLowStock
    const [procedureResult] = await pool.query('CALL GetLowStock(?)', [limit]);
    const lowStock = procedureResult[0] || [];
    res.json(lowStock);
  } catch (err) {
    console.error('Error in GET /api/inventory/low-stock:', err);
    res.status(500).json({ error: getMySQLErrorMessage(err) });
  }
});

// -------------------------------------------------------------
// GET /api/dashboard - Summary statistics for dashboard cards & widgets
// -------------------------------------------------------------
app.get('/api/dashboard', async (req, res) => {
  try {
    const [invRows] = await pool.query('SELECT COALESCE(SUM(quantity), 0) AS total_stock, COUNT(*) AS record_count FROM Inventory');
    const [lowStockRows] = await pool.query('SELECT COUNT(*) AS low_stock FROM Inventory WHERE quantity < 50 AND quantity > 0');
    const [movementRows] = await pool.query('SELECT COUNT(*) AS movement_count FROM Stock_Movements');
    const [recentInv] = await pool.query('SELECT * FROM Inventory ORDER BY last_updated DESC LIMIT 5');
    const [recentMoves] = await pool.query('SELECT * FROM Stock_Movements ORDER BY movement_date DESC, movement_id DESC LIMIT 5');

    res.json({
      totalStock: Number(invRows[0].total_stock),
      recordCount: Number(invRows[0].record_count),
      lowStock: Number(lowStockRows[0].low_stock),
      movementCount: Number(movementRows[0].movement_count),
      recentInventory: recentInv,
      recentMovements: recentMoves
    });
  } catch (err) {
    console.error('Error in GET /api/dashboard:', err);
    res.status(500).json({ error: getMySQLErrorMessage(err) });
  }
});

// -------------------------------------------------------------
// GET /api/warehouses - Real-time warehouse summary from database
// -------------------------------------------------------------
app.get('/api/warehouses', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        warehouse_id,
        COUNT(inventory_id) AS records,
        COALESCE(SUM(quantity), 0) AS quantity
      FROM Inventory
      GROUP BY warehouse_id
      ORDER BY warehouse_id ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error in GET /api/warehouses:', err);
    res.status(500).json({ error: getMySQLErrorMessage(err) });
  }
});

// -------------------------------------------------------------
// POST /api/stock/add - Add stock via stored procedure AddStock(batch, warehouse, quantity)
// -------------------------------------------------------------
app.post('/api/stock/add', async (req, res) => {
  try {
    const batchId = parseInt(req.body.batch_id, 10);
    const warehouseId = parseInt(req.body.warehouse_id, 10);
    const quantity = parseInt(req.body.quantity, 10);

    if (isNaN(batchId) || batchId <= 0) {
      return res.status(400).json({ error: 'Valid positive Batch ID is required.' });
    }
    if (isNaN(warehouseId) || warehouseId <= 0) {
      return res.status(400).json({ error: 'Valid positive Warehouse ID is required.' });
    }
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number greater than zero.' });
    }

    // Call stored procedure AddStock
    await pool.query('CALL AddStock(?, ?, ?)', [batchId, warehouseId, quantity]);

    res.json({
      success: true,
      message: `Stock added successfully: ${quantity} units added to Batch #${batchId} in Warehouse #${warehouseId}.`
    });
  } catch (err) {
    console.error('Error in POST /api/stock/add:', err);
    res.status(400).json({ error: getMySQLErrorMessage(err) });
  }
});

// -------------------------------------------------------------
// POST /api/stock/remove - Remove stock via stored procedure RemoveStock(batch, warehouse, quantity)
// -------------------------------------------------------------
app.post('/api/stock/remove', async (req, res) => {
  try {
    const batchId = parseInt(req.body.batch_id, 10);
    const warehouseId = parseInt(req.body.warehouse_id, 10);
    const quantity = parseInt(req.body.quantity, 10);

    if (isNaN(batchId) || batchId <= 0) {
      return res.status(400).json({ error: 'Valid positive Batch ID is required.' });
    }
    if (isNaN(warehouseId) || warehouseId <= 0) {
      return res.status(400).json({ error: 'Valid positive Warehouse ID is required.' });
    }
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number greater than zero.' });
    }

    // Call stored procedure RemoveStock
    await pool.query('CALL RemoveStock(?, ?, ?)', [batchId, warehouseId, quantity]);

    res.json({
      success: true,
      message: `Stock removed successfully: ${quantity} units removed from Batch #${batchId} in Warehouse #${warehouseId}.`
    });
  } catch (err) {
    console.error('Error in POST /api/stock/remove:', err);
    res.status(400).json({ error: getMySQLErrorMessage(err) });
  }
});

// -------------------------------------------------------------
// POST /api/stock/transfer - Transfer stock via stored procedure TransferStock(batch, from, to, quantity)
// -------------------------------------------------------------
app.post('/api/stock/transfer', async (req, res) => {
  try {
    const batchId = parseInt(req.body.batch_id, 10);
    const fromWarehouse = parseInt(req.body.from_warehouse, 10);
    const toWarehouse = parseInt(req.body.to_warehouse, 10);
    const quantity = parseInt(req.body.quantity, 10);

    if (isNaN(batchId) || batchId <= 0) {
      return res.status(400).json({ error: 'Valid positive Batch ID is required.' });
    }
    if (isNaN(fromWarehouse) || fromWarehouse <= 0) {
      return res.status(400).json({ error: 'Valid source Warehouse ID is required.' });
    }
    if (isNaN(toWarehouse) || toWarehouse <= 0) {
      return res.status(400).json({ error: 'Valid destination Warehouse ID is required.' });
    }
    if (fromWarehouse === toWarehouse) {
      return res.status(400).json({ error: 'Source and destination warehouses cannot be the same.' });
    }
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number greater than zero.' });
    }

    // Call stored procedure TransferStock
    await pool.query('CALL TransferStock(?, ?, ?, ?)', [batchId, fromWarehouse, toWarehouse, quantity]);

    res.json({
      success: true,
      message: `Stock transferred successfully: ${quantity} units of Batch #${batchId} transferred from Warehouse #${fromWarehouse} to Warehouse #${toWarehouse}.`
    });
  } catch (err) {
    console.error('Error in POST /api/stock/transfer:', err);
    res.status(400).json({ error: getMySQLErrorMessage(err) });
  }
});

// -------------------------------------------------------------
// POST /api/movements - Unified endpoint for IN, OUT, and TRANSFER operations
// -------------------------------------------------------------
app.post('/api/movements', async (req, res) => {
  try {
    const type = (req.body.movement_type || '').toUpperCase();
    const batchId = parseInt(req.body.batch_id, 10);
    const quantity = parseInt(req.body.quantity, 10);
    const fromWarehouse = req.body.from_warehouse ? parseInt(req.body.from_warehouse, 10) : null;
    const toWarehouse = req.body.to_warehouse ? parseInt(req.body.to_warehouse, 10) : null;

    if (isNaN(batchId) || batchId <= 0) {
      return res.status(400).json({ error: 'Valid positive Batch ID is required.' });
    }
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number greater than zero.' });
    }

    if (type === 'IN') {
      const warehouseId = toWarehouse || fromWarehouse;
      if (!warehouseId || isNaN(warehouseId)) {
        return res.status(400).json({ error: 'Valid Warehouse ID is required for Stock In.' });
      }
      await pool.query('CALL AddStock(?, ?, ?)', [batchId, warehouseId, quantity]);
      return res.json({
        success: true,
        message: `Stock In recorded: ${quantity} units added to Batch #${batchId} in Warehouse #${warehouseId}.`
      });
    }

    if (type === 'OUT') {
      const warehouseId = fromWarehouse || toWarehouse;
      if (!warehouseId || isNaN(warehouseId)) {
        return res.status(400).json({ error: 'Valid Warehouse ID is required for Stock Out.' });
      }
      await pool.query('CALL RemoveStock(?, ?, ?)', [batchId, warehouseId, quantity]);
      return res.json({
        success: true,
        message: `Stock Out recorded: ${quantity} units removed from Batch #${batchId} in Warehouse #${warehouseId}.`
      });
    }

    if (type === 'TRANSFER') {
      if (!fromWarehouse || isNaN(fromWarehouse)) {
        return res.status(400).json({ error: 'Source Warehouse ID is required for Transfer.' });
      }
      if (!toWarehouse || isNaN(toWarehouse)) {
        return res.status(400).json({ error: 'Destination Warehouse ID is required for Transfer.' });
      }
      if (fromWarehouse === toWarehouse) {
        return res.status(400).json({ error: 'Source and destination warehouses cannot be the same.' });
      }
      await pool.query('CALL TransferStock(?, ?, ?, ?)', [batchId, fromWarehouse, toWarehouse, quantity]);
      return res.json({
        success: true,
        message: `Transfer recorded: ${quantity} units of Batch #${batchId} transferred from Warehouse #${fromWarehouse} to Warehouse #${toWarehouse}.`
      });
    }

    return res.status(400).json({ error: 'Invalid movement type. Must be IN, OUT, or TRANSFER.' });
  } catch (err) {
    console.error('Error in POST /api/movements:', err);
    res.status(400).json({ error: getMySQLErrorMessage(err) });
  }
});

// Serve frontend for all page navigations
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(` StockMate Warehouse Tracking System Server`);
  console.log(` Running on: http://localhost:${PORT}`);
  console.log(` Connected to MySQL Database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
  console.log(` Active Stored Procedures: GetInventory, GetLowStock, AddStock, RemoveStock, TransferStock`);
  console.log(`========================================================`);
});
