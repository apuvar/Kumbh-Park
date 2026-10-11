/**
 * KumbhPark – Smart Parking System for Kumbh Mela, Nashik
 * Core Client Engine: Session Management, Route Guards, Direct API, and UI Shell
 */

// ==========================================================================
// Session & Authentication (Zero fallback to demo user when logged out)
// ==========================================================================

const SESSION_KEY = "kumbh_session";

function getUser() {
  try {
    const val = localStorage.getItem(SESSION_KEY);
    if (!val) return null;
    const user = JSON.parse(val);
    if (!user || !user.id || !user.role) return null;
    // Normalize numeric DB ids (reject fake client-generated timestamps used historically)
    user.id = Number(user.id);
    if (!Number.isFinite(user.id) || user.id <= 0) return null;
    return user;
  } catch (e) {
    return null;
  }
}

function saveUser(user) {
  if (user && user.id && user.role) {
    const normalized = {
      id: Number(user.id),
      role: user.role,
      name: user.name || "",
      email: user.email || "",
      mobile: user.mobile || "",
      organization_name: user.organization_name || undefined,
      vehicle_number: user.vehicle_number || undefined,
      vehicle_type: user.vehicle_type || undefined
    };
    if (!Number.isFinite(normalized.id) || normalized.id <= 0) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function clearUserState() {
  localStorage.removeItem(SESSION_KEY);
  // Clear any legacy / cached account-specific keys so account switches never leak data
  [
    "kumbh_demo_user",
    "demo_user",
    "currentUser",
    "customerId",
    "providerId",
    "selectedZone",
    "bookingDraft"
  ].forEach((key) => localStorage.removeItem(key));
  try {
    sessionStorage.clear();
  } catch (_) {}
}

function logout() {
  clearUserState();
  showToast("Logged out successfully.", "info");
  setTimeout(() => {
    location.href = "index.html";
  }, 350);
}

/**
 * Auth headers derived from the authenticated session.
 * Backend uses these to enforce identity — never trust path IDs alone.
 */
function getAuthHeaders() {
  const user = getUser();
  if (!user) return {};
  return {
    "X-User-Id": String(user.id),
    "X-User-Role": user.role
  };
}

/**
 * Safe redirect target (same-origin relative HTML pages only).
 */
function safeRedirectTarget(raw, fallback) {
  if (!raw || typeof raw !== "string") return fallback;
  const cleaned = raw.trim();
  if (!cleaned || cleaned.startsWith("http") || cleaned.startsWith("//") || cleaned.includes("://")) {
    return fallback;
  }
  if (cleaned.includes("..")) return fallback;
  return cleaned;
}

/**
 * Route Guard
 * Enforces role-based access control.
 * - If unauthenticated: redirects to login selection (or role login).
 * - If user has different role: redirects to that user's own dashboard.
 */
function requireRole(expectedRole) {
  const user = getUser();
  if (!user) {
    const redirect = encodeURIComponent(location.pathname.split("/").pop() + location.search);
    // Use login selection page so the user can choose customer vs provider
    location.replace(`login.html?redirect=${redirect}`);
    return null;
  }

  if (expectedRole && user.role !== expectedRole) {
    if (user.role === "provider") {
      showToast("This page is for customers only. Redirecting to your provider dashboard.", "info");
      location.replace("provider-dashboard.html");
    } else {
      showToast("This page is for parking providers only. Redirecting to your customer dashboard.", "info");
      location.replace("customer-dashboard.html");
    }
    return null;
  }

  return user;
}

// ==========================================================================
// Direct Backend API Client (No mock interception; MySQL is source of truth)
// ==========================================================================

// Determine the backend API base URL automatically:
// - If served directly from Express (port 3000 or production host), use relative paths (empty base)
// - If served from a development web server (e.g. Live Server on 5500, 5501, 8080, etc.), direct to http://localhost:3000
function getApiBaseUrl() {
  if (typeof window === "undefined" || !window.location) return "";
  const port = window.location.port;
  const protocol = window.location.protocol;
  // If opened via file:// protocol or external live dev server on another port
  if (protocol === "file:" || (port && port !== "3000")) {
    return "http://localhost:3000";
  }
  return "";
}

const API_BASE_URL = getApiBaseUrl();

async function api(endpoint, options = {}) {
  const headers = {
    ...(options.headers || {}),
    ...getAuthHeaders()
  };

  const finalUrl = endpoint.startsWith("http://") || endpoint.startsWith("https://")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  let res;
  try {
    res = await fetch(finalUrl, { ...options, headers });
  } catch (networkErr) {
    console.error("KumbhPark API Network Error:", networkErr, "URL:", finalUrl);
    // Provide an informative, actionable message instead of generic browser "Failed to fetch"
    throw new Error(
      "Unable to connect to the KumbhPark backend server at " +
      (API_BASE_URL || "http://localhost:3000") +
      ". Please verify that the Node.js server is started (`npm start` in server/ folder)."
    );
  }

  if (res.ok) {
    return await res.json();
  }

  // Parse server error message
  let errMsg = `Request failed (${res.status})`;
  try {
    const errData = await res.json();
    if (errData && errData.message) {
      errMsg = errData.message;
    }
  } catch (_) {}

  // Clear stale session on unauthorized
  if (res.status === 401 || res.status === 403) {
    const user = getUser();
    if (user) {
      clearUserState();
    }
  }

  throw new Error(errMsg);
}

// ==========================================================================
// Application Shell (Sidebar + Top Navbar)
// ==========================================================================

function renderAppShell(options = {}) {
  const { title = "Dashboard", activeKey = "dashboard", subtitle = "" } = options;
  const user = getUser();
  const isProvider = user && user.role === "provider";

  // Navigation Links
  const customerNav = `
    <div class="nav-section-title">Navigation</div>
    <a href="index.html" class="sidebar-nav-item ${activeKey === 'home' ? 'active' : ''}">
      <span class="nav-icon">🏠</span> <span>Home Portal</span>
    </a>
    <a href="customer-dashboard.html" class="sidebar-nav-item ${activeKey === 'dashboard' ? 'active' : ''}">
      <span class="nav-icon">📊</span> <span>My Dashboard</span>
    </a>
    <a href="parking.html" class="sidebar-nav-item ${activeKey === 'find-parking' ? 'active' : ''}">
      <span class="nav-icon">🔍</span> <span>Find Parking</span>
    </a>
    <a href="slots.html" class="sidebar-nav-item ${activeKey === 'parking-details' ? 'active' : ''}">
      <span class="nav-icon">🅿️</span> <span>Parking Details</span>
    </a>
    <a href="map.html" class="sidebar-nav-item ${activeKey === 'map' ? 'active' : ''}">
      <span class="nav-icon">🗺️</span> <span>Live Map</span>
    </a>
    <div class="nav-section-title">My Account</div>
    <a href="my-bookings.html" class="sidebar-nav-item ${activeKey === 'my-bookings' ? 'active' : ''}">
      <span class="nav-icon">🎫</span> <span>My Bookings</span>
    </a>
    <a href="profile.html" class="sidebar-nav-item ${activeKey === 'profile' ? 'active' : ''}">
      <span class="nav-icon">👤</span> <span>Profile</span>
    </a>
    <a href="help.html" class="sidebar-nav-item ${activeKey === 'help' ? 'active' : ''}">
      <span class="nav-icon">❓</span> <span>Help & Support</span>
    </a>
  `;

  const providerNav = `
    <div class="nav-section-title">Provider Operations</div>
    <a href="provider-dashboard.html" class="sidebar-nav-item ${activeKey === 'provider-dashboard' ? 'active' : ''}">
      <span class="nav-icon">📈</span> <span>Dashboard</span>
    </a>
    <a href="provider-zones.html" class="sidebar-nav-item ${activeKey === 'provider-zones' ? 'active' : ''}">
      <span class="nav-icon">📍</span> <span>Parking Zones</span>
    </a>
    <a href="add-zone.html" class="sidebar-nav-item ${activeKey === 'add-zone' ? 'active' : ''}">
      <span class="nav-icon">➕</span> <span>Add Zone</span>
    </a>
    <a href="manage-slots.html" class="sidebar-nav-item ${activeKey === 'manage-slots' ? 'active' : ''}">
      <span class="nav-icon">🎛️</span> <span>Manage Slots</span>
    </a>
    <a href="provider-bookings.html" class="sidebar-nav-item ${activeKey === 'provider-bookings' ? 'active' : ''}">
      <span class="nav-icon">📋</span> <span>Customer Bookings</span>
    </a>
    <div class="nav-section-title">Account</div>
    <a href="profile.html" class="sidebar-nav-item ${activeKey === 'profile' ? 'active' : ''}">
      <span class="nav-icon">👤</span> <span>Profile</span>
    </a>
    <a href="index.html" class="sidebar-nav-item">
      <span class="nav-icon">🌐</span> <span>Portal Home</span>
    </a>
  `;

  const guestNav = `
    <div class="nav-section-title">Explore</div>
    <a href="index.html" class="sidebar-nav-item ${activeKey === 'home' ? 'active' : ''}">
      <span class="nav-icon">🏠</span> <span>Portal Home</span>
    </a>
    <a href="customer-login.html" class="sidebar-nav-item">
      <span class="nav-icon">🚗</span> <span>Customer Sign In</span>
    </a>
    <a href="provider-login.html" class="sidebar-nav-item">
      <span class="nav-icon">🛡️</span> <span>Provider Portal</span>
    </a>
    <a href="help.html" class="sidebar-nav-item ${activeKey === 'help' ? 'active' : ''}">
      <span class="nav-icon">❓</span> <span>Help & FAQs</span>
    </a>
  `;

  const userInitial = user ? (user.name || "U")[0].toUpperCase() : "?";

  const sidebarHtml = `
    <aside class="app-sidebar" id="appSidebar">
      <div class="sidebar-header">
        <a href="index.html" class="sidebar-brand">
          <div class="brand-icon">🅿</div>
          <div class="brand-info">
            <h2>Kumbh<span>Park</span></h2>
            <p>Smart Parking</p>
          </div>
        </a>
        ${user ? `
          <span class="sidebar-role-badge ${isProvider ? 'provider' : 'customer'}">
            ${isProvider ? '🛡️ Provider' : '🚗 Customer'}
          </span>
        ` : ''}
      </div>
      <nav class="sidebar-nav">
        ${user ? (isProvider ? providerNav : customerNav) : guestNav}
      </nav>
      <div class="sidebar-footer">
        ${user ? `
          <div class="sidebar-user">
            <div class="user-avatar">${userInitial}</div>
            <div class="user-meta">
              <strong>${escapeHtml(user.name)}</strong>
              <span>${escapeHtml(user.email)}</span>
            </div>
            <button onclick="logout()" title="Logout" style="color:#94a3b8;font-size:16px;padding:4px;">🚪</button>
          </div>
        ` : `
          <div style="display:flex;gap:8px">
            <a href="customer-login.html" class="btn-primary" style="font-size:12px;padding:8px 12px;flex:1;justify-content:center">Sign In</a>
            <a href="register.html" class="btn-secondary" style="font-size:12px;padding:8px 12px;flex:1;justify-content:center">Register</a>
          </div>
        `}
      </div>
    </aside>
  `;

  // Top Navbar
  const topNavbarHtml = `
    <header class="top-navbar">
      <div class="nav-left">
        <button class="mobile-menu-toggle" id="mobileMenuBtn" aria-label="Toggle menu">☰</button>
        <div class="page-title-box">
          <h1>${escapeHtml(title)}</h1>
          <div class="breadcrumb">
            <span>KumbhPark</span> <span>/</span>
            <span style="color:var(--text-main);font-weight:600">${escapeHtml(subtitle || title)}</span>
          </div>
        </div>
      </div>
      <div class="nav-right">
        <!-- Notification Bell -->
        <div style="position:relative">
          <button class="nav-action-btn" id="notifBtn" aria-label="Notifications">
            🔔<span class="badge-dot"></span>
          </button>
          <div class="notification-menu" id="notifMenu">
            <div class="notification-header">
              <h4>Kumbh Mela Parking Live Status</h4>
              <span style="font-size:10px;color:var(--primary);font-weight:700">● LIVE</span>
            </div>
            <div class="notification-list">
              <div class="notification-item">
                <span class="notif-icon">🚦</span>
                <div class="notif-text">
                  <strong>Ramkund Ghat Advisory</strong>
                  <p>Heavy pilgrim footfall. Advance booking recommended.</p>
                  <span class="notif-time">Just now</span>
                </div>
              </div>
              <div class="notification-item">
                <span class="notif-icon">🅿️</span>
                <div class="notif-text">
                  <strong>Database Synchronized</strong>
                  <p>Real-time slot availability linked with MySQL.</p>
                  <span class="notif-time">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        ${user ? `
          <a href="profile.html" class="user-menu-pill">
            <div class="avatar-sm">${userInitial}</div>
            <span>${escapeHtml(user.name.split(" ")[0])}</span>
          </a>
        ` : `
          <a href="customer-login.html" class="btn-primary" style="font-size:12px;padding:8px 16px">Sign In</a>
        `}
      </div>
    </header>
  `;

  const shellContainer = document.getElementById("appShell");
  if (shellContainer) {
    shellContainer.insertAdjacentHTML("afterbegin", sidebarHtml);
    const mainWrap = document.getElementById("appMain");
    if (mainWrap) {
      mainWrap.insertAdjacentHTML("afterbegin", topNavbarHtml);
    }
  }

  setupShellEvents();
}

function setupShellEvents() {
  const menuBtn = document.getElementById("mobileMenuBtn");
  const sidebar = document.getElementById("appSidebar");
  if (menuBtn && sidebar) {
    menuBtn.onclick = () => sidebar.classList.toggle("open");
  }

  const notifBtn = document.getElementById("notifBtn");
  const notifMenu = document.getElementById("notifMenu");
  if (notifBtn && notifMenu) {
    notifBtn.onclick = (e) => {
      e.stopPropagation();
      notifMenu.classList.toggle("open");
    };
    document.addEventListener("click", () => notifMenu.classList.remove("open"));
  }
}

// ==========================================================================
// Visual Parking Slot Grid Renderer
// ==========================================================================

function renderVisualParkingDeck(options = {}) {
  const {
    containerId = "visualParkingDeck",
    slots = [],
    selectedSlot = "",
    zoneName = "Zone A",
    onSlotSelect = null
  } = options;

  const container = document.getElementById(containerId);
  if (!container) return;

  const bay1 = slots.slice(0, 5);
  const bay2 = slots.slice(5, 10);

  const counts = {
    available: slots.filter(s => s.status === "available").length,
    booked: slots.filter(s => s.status === "booked" || s.status === "occupied").length,
    reserved: slots.filter(s => s.status === "reserved").length,
    unavailable: slots.filter(s => s.status === "unavailable" || s.status === "maintenance").length
  };

  const getVehicleIcon = (status) => {
    if (status === "booked" || status === "occupied") return "🚗";
    if (status === "reserved") return "🟡";
    if (status === "unavailable" || status === "maintenance") return "🚧";
    return "🅿️";
  };

  const renderSlotCard = (s) => {
    const isSelected = s.slot_number === selectedSlot;
    const normStatus = (s.status === "occupied") ? "booked" : (s.status === "maintenance" ? "unavailable" : s.status);
    return `
      <div class="parking-slot-card ${normStatus} ${isSelected ? 'selected' : ''}" 
           data-slot="${escapeHtml(s.slot_number)}" 
           data-status="${normStatus}"
           role="button"
           tabindex="0"
           title="Slot ${s.slot_number} – ${normStatus.toUpperCase()}">
        <div class="slot-code">${escapeHtml(s.slot_number)}</div>
        <div class="slot-vehicle-icon">${getVehicleIcon(normStatus)}</div>
        <div class="slot-status-pill">${normStatus}</div>
      </div>
    `;
  };

  container.innerHTML = `
    <div class="parking-lot-wrapper">
      <div class="parking-lot-header">
        <div class="lot-title-box">
          <h3><span>🅿️</span> ${escapeHtml(zoneName)} – Visual Parking Bays</h3>
          <p>Real-time slot grid from database. Click an available green slot to reserve.</p>
        </div>
        <div class="slot-legend">
          <div class="legend-item">
            <span class="legend-dot available"></span>
            <span>Available <span class="legend-count">(${counts.available})</span></span>
          </div>
          <div class="legend-item">
            <span class="legend-dot booked"></span>
            <span>Booked <span class="legend-count">(${counts.booked})</span></span>
          </div>
          <div class="legend-item">
            <span class="legend-dot reserved"></span>
            <span>Reserved <span class="legend-count">(${counts.reserved})</span></span>
          </div>
          <div class="legend-item">
            <span class="legend-dot unavailable"></span>
            <span>Maintenance <span class="legend-count">(${counts.unavailable})</span></span>
          </div>
        </div>
      </div>

      <div class="parking-lot-deck">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">
          North Bay • Slots P01 - P05
        </div>
        <div class="parking-bay-row">
          ${bay1.map(renderSlotCard).join("")}
        </div>

        <div class="driving-aisle">
          <span class="aisle-arrow">⬅️ ENTRY GATE</span>
          <span>🛣️ CENTRAL DRIVING AISLE • ONE WAY TRAFFIC 🛣️</span>
          <span class="aisle-arrow">EXIT TO GHATS ➡️</span>
        </div>

        <div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">
          South Bay • Slots P06 - P10
        </div>
        <div class="parking-bay-row">
          ${bay2.map(renderSlotCard).join("")}
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll(".parking-slot-card").forEach(card => {
    card.addEventListener("click", () => {
      const slotNum = card.dataset.slot;
      const status = card.dataset.status;
      if (status === "available") {
        if (typeof onSlotSelect === "function") {
          onSlotSelect(slotNum);
        }
      } else if (status === "booked") {
        showToast(`Slot ${slotNum} is currently booked by another vehicle.`, "error");
      } else if (status === "reserved") {
        showToast(`Slot ${slotNum} is currently reserved.`, "info");
      } else {
        showToast(`Slot ${slotNum} is disabled for maintenance.`, "error");
      }
    });
  });
}

// ==========================================================================
// Toast Notifications
// ==========================================================================

function showToast(message, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "success" ? "✓" : (type === "error" ? "⚠️" : "ℹ️");
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

// ==========================================================================
// Digital Pass E-Ticket Modal
// ==========================================================================

function openTicketModal(b) {
  let modal = document.getElementById("ticketModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "ticketModal";
    modal.className = "modal-overlay";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>🎫 Kumbh Mela Parking Pass</h3>
        <button class="modal-close-btn" onclick="document.getElementById('ticketModal').classList.remove('open')">✕</button>
      </div>
      <div class="modal-body">
        <div class="eticket-card">
          <div class="eticket-header">
            <div>
              <h4 style="color:#0d7658;font-size:16px">${escapeHtml(b.zone_name || "KumbhPark Zone")}</h4>
              <p style="font-size:11px;color:#64748b">Pass Code: <b>${escapeHtml(b.booking_code || ("KP" + b.id))}</b></p>
            </div>
            <div class="eticket-qr">
              <span style="font-size:24px">📱</span>
              <span>VERIFIED</span>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px">
            <div><span style="color:#64748b;display:block;font-size:10px">SLOT ID</span><b style="font-size:18px;color:#0d7658">${escapeHtml(b.slot_number)}</b></div>
            <div><span style="color:#64748b;display:block;font-size:10px">VEHICLE</span><b>${escapeHtml(b.vehicle_number)} (${escapeHtml(b.vehicle_type)})</b></div>
            <div><span style="color:#64748b;display:block;font-size:10px">VISITOR</span><b>${escapeHtml(b.customer_name || "Pilgrim")}</b></div>
            <div><span style="color:#64748b;display:block;font-size:10px">DATE & DURATION</span><b>${escapeHtml(b.booking_date)} • ${escapeHtml(b.duration)}</b></div>
            <div><span style="color:#64748b;display:block;font-size:10px">STATUS</span><span class="status-tag ${(b.status||'').toLowerCase()}">${escapeHtml(b.status)}</span></div>
            <div><span style="color:#64748b;display:block;font-size:10px">AMOUNT PAID</span><b style="color:#d97706">₹${b.amount || (b.rate ? b.rate * 2 : 60)}</b></div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="window.print()">🖨️ Print Pass</button>
        <button class="btn-primary" onclick="document.getElementById('ticketModal').classList.remove('open')">Close</button>
      </div>
    </div>
  `;
  modal.classList.add("open");
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
