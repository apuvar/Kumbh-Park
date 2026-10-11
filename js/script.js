/**
 * KumbhPark – Smart Parking System for Kumbh Mela Nashik
 * Client Interactive Logic
 */

const demoParking = [
  { id: 1, name: "Zone A – Ramkund", location: "Near Ramkund Ghat", capacity: 400, available: 245, rate: 30, distance: "0.8 km away", image: "image-one" },
  { id: 2, name: "Zone B – Panchavati", location: "Panchavati Parking Ground", capacity: 350, available: 182, rate: 25, distance: "1.2 km away", image: "image-two" },
  { id: 3, name: "Zone C – Tapovan", location: "Tapovan Parking Area", capacity: 250, available: 67, rate: 30, distance: "1.8 km away", image: "image-three" },
  { id: 4, name: "Zone D – Gangapur Road", location: "Gangapur Road Demo Zone", capacity: 300, available: 150, rate: 25, distance: "2.4 km away", image: "image-four" }
];

let parkingZones = [...demoParking];
let selectedZone = parkingZones[0];
let selectedSlot = "";
let slots = createSlots();

function createSlots() {
  const statuses = ["available", "occupied", "available", "reserved", "available", "occupied", "available", "available", "reserved", "occupied"];
  return Array.from({ length: 10 }, (_, i) => ({
    number: `P${String(i + 1).padStart(2, "0")}`,
    status: statuses[i] || "available"
  }));
}

function renderParkingCards(data) {
  const grid = document.getElementById("parkingGrid");
  if (!grid) return;
  grid.innerHTML = "";
  data.forEach(zone => {
    const card = document.createElement("article");
    card.className = "parking-card";
    const percent = zone.available / zone.capacity;
    const tag = percent < 0.3 ? '<span class="limited-tag">● Filling Fast</span>' : '<span class="available-tag">● Available</span>';
    card.innerHTML = `
      <div class="parking-image ${zone.image}">
        <span class="distance">${zone.distance}</span>${tag}
      </div>
      <div class="parking-content">
        <h3>${zone.name}</h3><p class="location">📍 ${zone.location}</p>
        <div class="availability">
          <div><span>Available</span><strong>${zone.available}</strong></div>
          <div><span>Capacity</span><strong>${zone.capacity}</strong></div>
          <div><span>Rate</span><strong>₹${zone.rate}/hr</strong></div>
        </div>
        <div class="card-buttons">
          <button class="navigate-btn" data-zone="${zone.id}">🧭 Select</button>
          <button class="book-btn" data-zone="${zone.id}">Reserve</button>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  grid.querySelectorAll(".navigate-btn,.book-btn").forEach(btn => {
    btn.addEventListener("click", () => selectZone(Number(btn.dataset.zone), btn.classList.contains("book-btn")));
  });
}

function updateHeroStats() {
  const total = parkingZones.reduce((sum, z) => sum + z.capacity, 0);
  const available = parkingZones.reduce((sum, z) => sum + z.available, 0);
  const availEl = document.getElementById("hero-available");
  const occEl = document.getElementById("hero-occupied");
  const pctEl = document.getElementById("hero-percent");
  if (availEl) availEl.textContent = available;
  if (occEl) occEl.textContent = Math.max(0, total - available);
  if (pctEl) pctEl.textContent = Math.round((available / total) * 100) + "%";
}

function selectZone(id, openForm = false) {
  selectedZone = parkingZones.find(z => z.id === id) || parkingZones[0];
  const titleEl = document.getElementById("selectedZoneTitle");
  if (titleEl) titleEl.textContent = selectedZone.name;
  renderSlots();
  populateFormSelectors();
  const slotsSec = document.getElementById("slots");
  if (slotsSec) slotsSec.scrollIntoView({ behavior: "smooth" });
  if (openForm) {
    const resSec = document.getElementById("reservation");
    if (resSec) setTimeout(() => resSec.scrollIntoView({ behavior: "smooth" }), 250);
  }
  showToast(`${selectedZone.name} selected`);
}

function renderSlots() {
  const grid = document.getElementById("slotGrid");
  if (!grid) return;
  grid.innerHTML = "";
  slots.forEach(slot => {
    const btn = document.createElement("button");
    btn.className = `slot ${slot.status}`;
    btn.textContent = slot.number;
    btn.disabled = slot.status !== "available";
    if (slot.number === selectedSlot) btn.classList.add("selected");
    btn.title = slot.status;
    btn.addEventListener("click", () => selectSlot(slot.number));
    grid.appendChild(btn);
  });
}

function selectSlot(slotNumber) {
  selectedSlot = slotNumber;
  const selText = document.getElementById("selectedSlotText");
  if (selText) selText.textContent = slotNumber;
  populateFormSelectors();
  const slotSel = document.getElementById("slotSelect");
  if (slotSel) slotSel.value = slotNumber;
  renderSlots();
  showToast(`You selected slot ${slotNumber}`);
}

function populateFormSelectors() {
  const zoneSelect = document.getElementById("zoneSelect");
  const slotSelect = document.getElementById("slotSelect");
  if (zoneSelect) {
    zoneSelect.innerHTML = parkingZones.map(z => `<option value="${z.id}">${z.name}</option>`).join("");
    zoneSelect.value = selectedZone.id;
  }
  if (slotSelect) {
    slotSelect.innerHTML = slots.map(s => `<option value="${s.number}" ${s.status !== "available" ? "disabled" : ""}>${s.number} - ${s.status}</option>`).join("");
    if (selectedSlot && slots.some(s => s.number === selectedSlot && s.status === "available")) {
      slotSelect.value = selectedSlot;
    }
  }
}

function filterParking() {
  const destInput = document.getElementById("destination");
  const destination = destInput ? destInput.value : "";
  const filtered = destination ? parkingZones.filter(z => z.name.includes(destination)) : parkingZones;
  renderParkingCards(filtered);
  const msgEl = document.getElementById("searchMessage");
  if (msgEl) msgEl.textContent = filtered.length ? `${filtered.length} parking zone(s) found.` : "No parking zone found.";
  const parkSec = document.getElementById("parking");
  if (parkSec) parkSec.scrollIntoView({ behavior: "smooth" });
}

async function loadParkingFromAPI() {
  try {
    const response = await fetch("/api/parking");
    if (!response.ok) throw new Error("API error");
    const data = await response.json();
    if (Array.isArray(data) && data.length) {
      parkingZones = data;
      selectedZone = parkingZones[0];
      updateHeroStats();
      renderParkingCards(parkingZones);
      populateFormSelectors();
      return;
    }
  } catch (error) {
    parkingZones = [...demoParking];
    updateHeroStats();
    renderParkingCards(parkingZones);
    populateFormSelectors();
  }
}

function showToast(message) {
  let toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}
