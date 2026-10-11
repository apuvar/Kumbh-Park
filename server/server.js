const express = require("express");
const path = require("path");
let mysql = null;
try {
  mysql = require("mysql2/promise");
} catch (e) {
  console.error("mysql2 module not found", e);
}
let bcrypt = null;
try {
  bcrypt = require("bcryptjs");
} catch (e) {
  console.error("bcryptjs module not found", e);
}

let cors = null;
try {
  cors = require("cors");
} catch (e) {
  console.warn("cors module not found", e);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Enable Cross-Origin Resource Sharing for API requests (supports VS Code Live Server, Vite, file/custom origins)
if (cors) {
  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-User-Id", "X-User-Role"]
  }));
} else {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id, X-User-Role");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..")));

// MySQL Connection configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "1396",
  database: process.env.DB_NAME || "smart_parking"
};

async function db() {
  if (!mysql) throw new Error("mysql2 driver is not available");
  return mysql.createConnection(dbConfig);
}

async function q(sql, p = []) {
  const c = await db();
  try {
    return await c.execute(sql, p);
  } finally {
    await c.end();
  }
}

/**
 * Resolve authenticated identity from session headers set by the client.
 * Existing flow uses localStorage session; headers mirror that identity so
 * protected APIs do not trust path/body IDs alone.
 */
function getRequestIdentity(req) {
  const id = Number(req.headers["x-user-id"]);
  const role = String(req.headers["x-user-role"] || "").toLowerCase();
  if (!Number.isFinite(id) || id <= 0 || (role !== "customer" && role !== "provider")) {
    return null;
  }
  return { id, role };
}

async function requireIdentity(req, res, expectedRole) {
  const identity = getRequestIdentity(req);
  if (!identity) {
    res.status(401).json({ message: "Authentication required. Please log in." });
    return null;
  }
  if (expectedRole && identity.role !== expectedRole) {
    res.status(403).json({ message: `This action requires a ${expectedRole} account.` });
    return null;
  }

  try {
    const table = identity.role === "provider" ? "providers" : "customers";
    const [rows] = await q(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`, [identity.id]);
    if (!rows.length) {
      res.status(401).json({ message: "Session is invalid. Please log in again." });
      return null;
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
    return null;
  }

  return identity;
}

// Test DB Connection on startup
(async () => {
  try {
    const c = await db();
    console.log("Connected to MySQL database:", dbConfig.database);
    await c.end();
  } catch (err) {
    console.error("WARNING: MySQL connection failed on startup:", err.message);
  }
})();

// Landing page route
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "..", "index.html")));

// ==========================================================================
// Authentication APIs
// ==========================================================================

// Register
app.post("/api/auth/register", async (req, res) => {
  const { role, name, email, mobile, password, organization_name } = req.body;
  if (!role || !name || !email || !mobile || !password) {
    return res.status(400).json({ message: "Please fill in all required fields." });
  }
  if (!/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ message: "Mobile number must contain 10 digits." });
  }

  try {
    const table = role === "provider" ? "providers" : "customers";
    const [existing] = await q(`SELECT id FROM ${table} WHERE email = ? LIMIT 1`, [email]);
    if (existing.length) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const hashedPassword = bcrypt ? await bcrypt.hash(password, 10) : password;

    if (role === "provider") {
      const [result] = await q(
        "INSERT INTO providers(provider_name, email, mobile, password, organization_name) VALUES(?, ?, ?, ?, ?)",
        [name, email, mobile, hashedPassword, organization_name || name]
      );
      const user = {
        id: result.insertId,
        role: "provider",
        name,
        email,
        mobile,
        organization_name: organization_name || name
      };
      return res.status(201).json({ success: true, message: "Provider registered successfully.", user });
    } else {
      const [result] = await q(
        "INSERT INTO customers(name, email, mobile, password) VALUES(?, ?, ?, ?)",
        [name, email, mobile, hashedPassword]
      );
      const user = {
        id: result.insertId,
        role: "customer",
        name,
        email,
        mobile
      };
      return res.status(201).json({ success: true, message: "Customer registered successfully.", user });
    }
  } catch (err) {
    console.error("Register Error:", err);
    return res.status(500).json({ message: "Registration failed: " + err.message });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ message: "Email, password, and role are required." });
  }

  try {
    const table = role === "provider" ? "providers" : "customers";
    const [rows] = await q(
      `SELECT ${role === "provider" ? "id, provider_name AS name, email, mobile, password, organization_name" : "id, name, email, mobile, password"} FROM ${table} WHERE email = ? LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const u = rows[0];
    let match = false;
    if (bcrypt && u.password.startsWith("$2")) {
      match = await bcrypt.compare(password, u.password);
    } else {
      match = password === u.password;
    }

    if (!match) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const user = {
      id: u.id,
      role,
      name: u.name,
      email: u.email,
      mobile: u.mobile,
      organization_name: u.organization_name
    };

    return res.json({ success: true, user });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ message: "Login failed: " + err.message });
  }
});

// Profile — only returns the authenticated user's own record
app.get("/api/auth/profile", async (req, res) => {
  const identity = await requireIdentity(req, res);
  if (!identity) return;

  const requestedId = Number(req.query.id);
  const requestedRole = String(req.query.role || "").toLowerCase();
  if (requestedId && requestedId !== identity.id) {
    return res.status(403).json({ message: "You can only view your own profile." });
  }
  if (requestedRole && requestedRole !== identity.role) {
    return res.status(403).json({ message: "Role mismatch." });
  }

  try {
    const table = identity.role === "provider" ? "providers" : "customers";
    const [rows] = await q(
      `SELECT ${identity.role === "provider" ? "id, provider_name AS name, email, mobile, organization_name" : "id, name, email, mobile"} FROM ${table} WHERE id = ? LIMIT 1`,
      [identity.id]
    );
    if (!rows.length) return res.status(404).json({ message: "User not found" });
    return res.json({ user: { ...rows[0], role: identity.role } });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ==========================================================================
// Parking Zones (Public & Customer-facing)
// ==========================================================================
app.get("/api/parking", async (req, res) => {
  try {
    const [rows] = await q(
      "SELECT id, provider_id, zone_name AS name, zone_name, location, capacity, available_slots AS available, available_slots, rate FROM parking_zones ORDER BY id"
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/parking Error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/parking/:id", async (req, res) => {
  try {
    const [rows] = await q(
      "SELECT id, provider_id, zone_name AS name, zone_name, location, capacity, available_slots AS available, available_slots, rate FROM parking_zones WHERE id = ?",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Parking zone not found." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Slots in a zone (Customer-facing)
app.get("/api/zones/:zoneId/slots", async (req, res) => {
  try {
    const [rows] = await q(
      "SELECT id, zone_id, slot_number, status FROM parking_slots WHERE zone_id = ? ORDER BY slot_number ASC, id ASC",
      [req.params.zoneId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================================================
// Customer Bookings
// ==========================================================================

// Create Booking
app.post("/api/bookings", async (req, res) => {
  const identity = await requireIdentity(req, res, "customer");
  if (!identity) return;

  const b = req.body;
  // Always book as the authenticated customer — never trust a client-supplied customer_id
  const customerId = identity.id;

  if (!b.zone_id || !b.slot_number || !b.vehicle_number || !b.vehicle_type || !b.booking_date || !b.duration) {
    return res.status(400).json({ message: "All booking fields are required." });
  }

  try {
    // 1. Verify slot existence and availability in this zone
    const [slotRows] = await q(
      "SELECT id, status FROM parking_slots WHERE zone_id = ? AND slot_number = ? LIMIT 1",
      [b.zone_id, b.slot_number]
    );

    if (!slotRows.length) {
      return res.status(404).json({ message: `Slot ${b.slot_number} does not exist in this zone.` });
    }

    const slot = slotRows[0];
    if (slot.status !== "available") {
      return res.status(409).json({ message: `Slot ${b.slot_number} is no longer available (currently ${slot.status}). Please pick another slot.` });
    }

    // 2. Insert booking record linking the actual slot_id
    const [result] = await q(
      "INSERT INTO bookings(customer_id, zone_id, slot_id, vehicle_number, vehicle_type, booking_date, duration, status) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
      [customerId, b.zone_id, slot.id, b.vehicle_number, b.vehicle_type, b.booking_date, b.duration, "Confirmed"]
    );

    // 3. Mark slot as occupied
    await q("UPDATE parking_slots SET status = 'occupied' WHERE id = ?", [slot.id]);

    // 4. Decrement available_slots in the zone
    await q("UPDATE parking_zones SET available_slots = GREATEST(0, available_slots - 1) WHERE id = ?", [b.zone_id]);

    return res.status(201).json({ success: true, bookingId: result.insertId });
  } catch (err) {
    console.error("Booking Error:", err);
    return res.status(500).json({ message: "Booking failed: " + err.message });
  }
});

// Get Single Booking (owner customer or zone-owning provider only)
app.get("/api/bookings/:id", async (req, res) => {
  const identity = await requireIdentity(req, res);
  if (!identity) return;

  try {
    const [rows] = await q(
      `SELECT b.id, b.customer_id, b.zone_id, b.slot_id, b.vehicle_number, b.vehicle_type,
              DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS booking_date,
              b.duration, b.status,
              CONCAT('KP', b.id) AS booking_code,
              c.name AS customer_name,
              z.zone_name,
              s.slot_number,
              z.rate,
              z.provider_id,
              ROUND(z.rate * COALESCE(NULLIF(CAST(SUBSTRING_INDEX(b.duration, ' ', 1) AS UNSIGNED), 0), 2), 2) AS amount
       FROM bookings b 
       JOIN customers c ON b.customer_id = c.id 
       JOIN parking_zones z ON b.zone_id = z.id 
       LEFT JOIN parking_slots s ON b.slot_id = s.id 
       WHERE b.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Booking not found." });

    const booking = rows[0];
    const allowed =
      (identity.role === "customer" && Number(booking.customer_id) === identity.id) ||
      (identity.role === "provider" && Number(booking.provider_id) === identity.id);

    if (!allowed) {
      return res.status(403).json({ message: "You do not have access to this booking." });
    }

    delete booking.provider_id;
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cancel Booking
app.put("/api/bookings/:id/cancel", async (req, res) => {
  const identity = await requireIdentity(req, res);
  if (!identity) return;

  try {
    const [rows] = await q("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Booking not found." });
    const b = rows[0];

    if (identity.role === "customer" && Number(b.customer_id) !== identity.id) {
      return res.status(403).json({ message: "You can only cancel your own bookings." });
    }

    if (identity.role === "provider") {
      const [owned] = await q(
        "SELECT z.id FROM parking_zones z WHERE z.id = ? AND z.provider_id = ? LIMIT 1",
        [b.zone_id, identity.id]
      );
      if (!owned.length) {
        return res.status(403).json({ message: "You can only cancel bookings for your own zones." });
      }
    }

    if (b.status === "Cancelled") {
      return res.json({ success: true, message: "Booking is already cancelled." });
    }

    // 1. Update booking status
    await q("UPDATE bookings SET status = 'Cancelled' WHERE id = ?", [b.id]);

    // 2. Free up the slot
    if (b.slot_id) {
      await q("UPDATE parking_slots SET status = 'available' WHERE id = ?", [b.slot_id]);
    }

    // 3. Increment zone availability
    await q("UPDATE parking_zones SET available_slots = LEAST(capacity, available_slots + 1) WHERE id = ?", [b.zone_id]);

    return res.json({ success: true, message: "Booking cancelled successfully." });
  } catch (err) {
    console.error("Cancel Booking Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Customer's own bookings
app.get("/api/customer/:id/bookings", async (req, res) => {
  const identity = await requireIdentity(req, res, "customer");
  if (!identity) return;

  if (Number(req.params.id) !== identity.id) {
    return res.status(403).json({ message: "You can only view your own bookings." });
  }

  try {
    const [rows] = await q(
      `SELECT b.id, b.customer_id, b.zone_id, b.slot_id, b.vehicle_number, b.vehicle_type,
              DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS booking_date,
              b.duration, b.status,
              CONCAT('KP', b.id) AS booking_code,
              z.zone_name,
              s.slot_number,
              z.rate,
              ROUND(z.rate * COALESCE(NULLIF(CAST(SUBSTRING_INDEX(b.duration, ' ', 1) AS UNSIGNED), 0), 2), 2) AS amount
       FROM bookings b 
       JOIN parking_zones z ON b.zone_id = z.id 
       LEFT JOIN parking_slots s ON b.slot_id = s.id 
       WHERE b.customer_id = ? 
       ORDER BY b.id DESC`,
      [identity.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================================================
// Provider Operations (Restricted to Provider's owned zones)
// ==========================================================================

async function requireProviderMatch(req, res) {
  const identity = await requireIdentity(req, res, "provider");
  if (!identity) return null;
  if (Number(req.params.pid) !== identity.id) {
    res.status(403).json({ message: "You can only access your own provider data." });
    return null;
  }
  return identity;
}

// Get provider's zones
app.get("/api/providers/:pid/zones", async (req, res) => {
  const identity = await requireProviderMatch(req, res);
  if (!identity) return;

  try {
    const [rows] = await q(
      "SELECT * FROM parking_zones WHERE provider_id = ? ORDER BY id DESC",
      [identity.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single zone for provider
app.get("/api/providers/:pid/zones/:id", async (req, res) => {
  const identity = await requireProviderMatch(req, res);
  if (!identity) return;

  try {
    const [rows] = await q(
      "SELECT * FROM parking_zones WHERE provider_id = ? AND id = ?",
      [identity.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Zone not found or unauthorized." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create new parking zone
app.post("/api/providers/:pid/zones", async (req, res) => {
  const identity = await requireProviderMatch(req, res);
  if (!identity) return;

  const { zone_name, name, location, capacity, rate } = req.body;
  const finalName = zone_name || name;
  const cap = Number(capacity);
  const r = Number(rate);

  if (!finalName || !location || !cap || !r) {
    return res.status(400).json({ message: "Zone name, location, capacity, and rate are required." });
  }

  try {
    // 1. Insert zone under the authenticated provider only
    const [result] = await q(
      "INSERT INTO parking_zones(provider_id, zone_name, location, capacity, available_slots, rate) VALUES(?, ?, ?, ?, ?, ?)",
      [identity.id, finalName, location, cap, cap, r]
    );
    const newZoneId = result.insertId;

    // 2. Create initial slots (e.g. up to 10 slots or cap)
    const slotCount = Math.min(10, cap);
    for (let i = 1; i <= slotCount; i++) {
      const slotNum = `P${String(i).padStart(2, "0")}`;
      await q("INSERT INTO parking_slots(zone_id, slot_number, status) VALUES(?, ?, 'available')", [newZoneId, slotNum]);
    }

    return res.status(201).json({
      success: true,
      id: newZoneId,
      zone: {
        id: newZoneId,
        provider_id: identity.id,
        zone_name: finalName,
        location,
        capacity: cap,
        available_slots: cap,
        rate: r
      }
    });
  } catch (err) {
    console.error("Create Zone Error:", err);
    res.status(500).json({ message: "Failed to create parking zone: " + err.message });
  }
});

// Edit zone
app.put("/api/providers/:pid/zones/:id", async (req, res) => {
  const identity = await requireProviderMatch(req, res);
  if (!identity) return;

  const { zone_name, name, location, capacity, rate } = req.body;
  const finalName = zone_name || name;

  try {
    const [check] = await q("SELECT id FROM parking_zones WHERE provider_id = ? AND id = ?", [identity.id, req.params.id]);
    if (!check.length) return res.status(404).json({ message: "Zone not found or unauthorized." });

    await q(
      "UPDATE parking_zones SET zone_name = ?, location = ?, capacity = ?, rate = ? WHERE provider_id = ? AND id = ?",
      [finalName, location, capacity, rate, identity.id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete zone
app.delete("/api/providers/:pid/zones/:id", async (req, res) => {
  const identity = await requireProviderMatch(req, res);
  if (!identity) return;

  try {
    const [result] = await q("DELETE FROM parking_zones WHERE provider_id = ? AND id = ?", [identity.id, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: "Zone not found or unauthorized." });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get slots in a zone for provider
app.get("/api/providers/:pid/zones/:zoneId/slots", async (req, res) => {
  const identity = await requireProviderMatch(req, res);
  if (!identity) return;

  try {
    const [zoneCheck] = await q("SELECT id FROM parking_zones WHERE id = ? AND provider_id = ?", [req.params.zoneId, identity.id]);
    if (!zoneCheck.length) return res.status(404).json({ message: "Zone not found or unauthorized." });

    const [rows] = await q(
      "SELECT * FROM parking_slots WHERE zone_id = ? ORDER BY slot_number ASC, id ASC",
      [req.params.zoneId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ADD A NEW PARKING SLOT (End-to-End Add Slot Functionality)
app.post("/api/providers/:pid/zones/:zoneId/slots", async (req, res) => {
  const identity = await requireProviderMatch(req, res);
  if (!identity) return;

  const { slot_number, status } = req.body;
  const zoneId = req.params.zoneId;
  const pid = identity.id;

  if (!slot_number) {
    return res.status(400).json({ message: "Slot identifier (e.g. P11) is required." });
  }

  const cleanSlotNumber = slot_number.trim().toUpperCase();
  const initStatus = status || "available";

  try {
    // 1. Verify provider owns this zone
    const [zoneRows] = await q("SELECT * FROM parking_zones WHERE id = ? AND provider_id = ?", [zoneId, pid]);
    if (!zoneRows.length) {
      return res.status(403).json({ message: "Unauthorized: You do not own this parking zone." });
    }

    // 2. Check for duplicate slot in this zone
    const [dupCheck] = await q("SELECT id FROM parking_slots WHERE zone_id = ? AND slot_number = ?", [zoneId, cleanSlotNumber]);
    if (dupCheck.length) {
      return res.status(409).json({ message: `Slot ${cleanSlotNumber} already exists in this zone.` });
    }

    // 3. Insert slot
    const [result] = await q(
      "INSERT INTO parking_slots(zone_id, slot_number, status) VALUES(?, ?, ?)",
      [zoneId, cleanSlotNumber, initStatus]
    );

    // 4. Update zone capacity and availability
    const availIncrement = initStatus === "available" ? 1 : 0;
    await q(
      "UPDATE parking_zones SET capacity = capacity + 1, available_slots = available_slots + ? WHERE id = ?",
      [availIncrement, zoneId]
    );

    return res.status(201).json({
      success: true,
      message: `Slot ${cleanSlotNumber} created successfully.`,
      slot: {
        id: result.insertId,
        zone_id: Number(zoneId),
        slot_number: cleanSlotNumber,
        status: initStatus
      }
    });
  } catch (err) {
    console.error("Add Slot Error:", err);
    return res.status(500).json({ message: "Failed to add slot: " + err.message });
  }
});

// Update slot status
app.put("/api/providers/:pid/slots/:id", async (req, res) => {
  const identity = await requireProviderMatch(req, res);
  if (!identity) return;

  const { status } = req.body;
  if (!status) return res.status(400).json({ message: "Status is required." });

  try {
    // Verify provider owns the zone of this slot
    const [slotCheck] = await q(
      `SELECT s.id, s.zone_id, s.status AS prev_status FROM parking_slots s 
       JOIN parking_zones z ON s.zone_id = z.id 
       WHERE s.id = ? AND z.provider_id = ?`,
      [req.params.id, identity.id]
    );

    if (!slotCheck.length) {
      return res.status(403).json({ message: "Unauthorized or slot not found." });
    }

    const { zone_id, prev_status } = slotCheck[0];
    await q("UPDATE parking_slots SET status = ? WHERE id = ?", [status, req.params.id]);

    // Adjust zone available count if status changed to/from available
    if (prev_status !== "available" && status === "available") {
      await q("UPDATE parking_zones SET available_slots = LEAST(capacity, available_slots + 1) WHERE id = ?", [zone_id]);
    } else if (prev_status === "available" && status !== "available") {
      await q("UPDATE parking_zones SET available_slots = GREATEST(0, available_slots - 1) WHERE id = ?", [zone_id]);
    }

    res.json({ success: true, message: "Slot status updated." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Provider's bookings (only for zones owned by this provider)
app.get("/api/providers/:pid/bookings", async (req, res) => {
  const identity = await requireProviderMatch(req, res);
  if (!identity) return;

  try {
    const [rows] = await q(
      `SELECT b.id, b.customer_id, b.zone_id, b.slot_id, b.vehicle_number, b.vehicle_type,
              DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS booking_date,
              b.duration, b.status,
              CONCAT('KP', b.id) AS booking_code,
              c.name AS customer_name,
              z.zone_name,
              s.slot_number,
              ROUND(z.rate * COALESCE(NULLIF(CAST(SUBSTRING_INDEX(b.duration, ' ', 1) AS UNSIGNED), 0), 2), 2) AS amount
       FROM bookings b 
       JOIN customers c ON b.customer_id = c.id 
       JOIN parking_zones z ON b.zone_id = z.id 
       LEFT JOIN parking_slots s ON b.slot_id = s.id 
       WHERE z.provider_id = ? 
       ORDER BY b.id DESC`,
      [identity.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`KumbhPark server running at http://localhost:${PORT}`);
});
