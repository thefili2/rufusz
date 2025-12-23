/* =========================
   DATA
========================= */

let scale = 1;
let offsetX = 0;
let offsetY = 0;
let showOnlyRouteWaypoints = false;

let drawnLabels = [];


let isPanning = false;
let startPan = { x: 0, y: 0 };

let waypoints = [];
let sids = [];
let stars = [];

let availableSids = [];
let availableStars = [];
let currentSidIndex = 0;
let currentStarIndex = 0;

// keep chosen transitions stable
let activeSidTransition = null;
let activeStarTransition = null;

const WAYPOINT_FONT = '10px Roboto';
const WAYPOINT_COLOR = '#ffffffff';
const ROUTE_WAYPOINT_COLOR = '#ffffffff';


function intersects(a, b) {
  return !(
    a.x + a.w < b.x ||
    a.x > b.x + b.w ||
    a.y + a.h < b.y ||
    a.y > b.y + b.h
  );
}



/* =========================
   MAP
========================= */
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
let mapBounds = null;

/* =========================
   LOAD DATA
========================= */
async function loadData() {
  const [wpRes, sidRes, starRes] = await Promise.all([
    fetch('data/waypoints.json'),
    fetch('data/sids.json'),
    fetch('data/stars.json')
  ]);

  waypoints = (await wpRes.json()).fixes;
  sids = (await sidRes.json()).sids;
  stars = (await starRes.json()).stars;

  calculateBounds();
  populateDropdowns();
  drawMap();
}

/* =========================
   DROPDOWNS
========================= */
function populateDropdowns() {
  const departing = document.getElementById('departing');
  const arriving = document.getElementById('arriving');
  const depRwy = document.getElementById('depRwy');
  const arrRwy = document.getElementById('arrRwy');

  const airports = [...new Set([...sids, ...stars].map(p => p.airport))].sort();

  airports.forEach(a => {
    departing.add(new Option(a, a));
    arriving.add(new Option(a, a));
  });

  function updateRunways(airportSel, rwySel, isDep) {
    rwySel.innerHTML = '';
    const src = isDep ? sids : stars;

    const runways = [
      ...new Set(
        src
          .filter(p => p.airport === airportSel.value)
          .flatMap(p => p.applicableRunways)
      )
    ].sort();

    runways.forEach(r => rwySel.add(new Option(r, r)));
  }

  departing.onchange = () => {
    updateRunways(departing, depRwy, true);
    updateAvailableSids();
  };

  arriving.onchange = () => {
    updateRunways(arriving, arrRwy, false);
    updateAvailableStars();
  };

  depRwy.onchange = updateAvailableSids;
  arrRwy.onchange = updateAvailableStars;

  updateRunways(departing, depRwy, true);
  updateRunways(arriving, arrRwy, false);
  updateAvailableSids();
  updateAvailableStars();
}

/* =========================
   SID / STAR FILTERING
========================= */
function updateAvailableSids() {
  availableSids = sids.filter(
    s =>
      s.airport === departing.value &&
      s.applicableRunways.includes(depRwy.value)
  );
  currentSidIndex = 0;
  activeSidTransition = pickTransition(availableSids[0]);
  updateSidDisplay();
  drawMap();
}

function updateAvailableStars() {
  availableStars = stars.filter(
    s =>
      s.airport === arriving.value &&
      s.applicableRunways.includes(arrRwy.value)
  );
  currentStarIndex = 0;
  activeStarTransition = pickTransition(availableStars[0]);
  updateStarDisplay();
  drawMap();
}

/* =========================
   DISPLAY
========================= */
function updateSidDisplay() {
  sidName.textContent = availableSids.length
    ? availableSids[currentSidIndex].id
    : '—';
}

function updateStarDisplay() {
  starName.textContent = availableStars.length
    ? availableStars[currentStarIndex].id
    : '—';
}

/* =========================
   BUTTONS
========================= */
prevSid.onclick = () => {
  if (!availableSids.length) return;
  currentSidIndex =
    (currentSidIndex - 1 + availableSids.length) % availableSids.length;
  activeSidTransition = pickTransition(availableSids[currentSidIndex]);
  updateSidDisplay();
  drawMap();
};

nextSid.onclick = () => {
  if (!availableSids.length) return;
  currentSidIndex = (currentSidIndex + 1) % availableSids.length;
  activeSidTransition = pickTransition(availableSids[currentSidIndex]);
  updateSidDisplay();
  drawMap();
};

prevStar.onclick = () => {
  if (!availableStars.length) return;
  currentStarIndex =
    (currentStarIndex - 1 + availableStars.length) % availableStars.length;
  activeStarTransition = pickTransition(availableStars[currentStarIndex]);
  updateStarDisplay();
  drawMap();
};

nextStar.onclick = () => {
  if (!availableStars.length) return;
  currentStarIndex = (currentStarIndex + 1) % availableStars.length;
  activeStarTransition = pickTransition(availableStars[currentStarIndex]);
  updateStarDisplay();
  drawMap();
};

/* =========================
   TRANSITIONS
========================= */
function pickTransition(proc) {
  if (!proc || !proc.transitions || !proc.transitions.length) return null;
  return proc.transitions[Math.floor(Math.random() * proc.transitions.length)];
}

/* =========================
   FLIGHT PLAN
========================= */
generate.onclick = () => {
  if (!availableSids.length || !availableStars.length) return;

  const sid = availableSids[currentSidIndex];
  const star = availableStars[currentStarIndex];

  const route = [
    `${departing.value}/${depRwy.value}`,
    sid.id,
    activeSidTransition?.name,
    star.id,
    activeStarTransition?.name,
    `${arrRwy.value}/${arriving.value}`
  ].filter(Boolean);

  output.textContent = route.join(' ');

  showOnlyRouteWaypoints = false;

  const toggleBtn = document.getElementById('toggle-route-wp');
  toggleBtn.disabled = false;
  toggleBtn.textContent = 'Show route waypoints only';

  drawMap();

};

/* =========================
   MAP LOGIC
========================= */




function calculateBounds() {
  mapBounds = {
    minX: Math.min(...waypoints.map(w => w.x)),
    maxX: Math.max(...waypoints.map(w => w.x)),
    minY: Math.min(...waypoints.map(w => w.y)),
    maxY: Math.max(...waypoints.map(w => w.y))
  };
}

function toCanvas(x, y) {
  const pad = 20;

  const sx =
    (canvas.width - pad * 2) / (mapBounds.maxX - mapBounds.minX);
  const sy =
    (canvas.height - pad * 2) / (mapBounds.maxY - mapBounds.minY);

  const s = Math.min(sx, sy);

  return {
    x: (x - mapBounds.minX) * s + pad,

    // 🔥 Y AXIS REVERSED HERE
    y: (y - mapBounds.minY) * s + pad
  };
}


function drawWaypoints() {
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  drawnLabels = [];
  const routeFixes = new Set(getFlightPlanFixes());

  waypoints.forEach(w => {
    if (showOnlyRouteWaypoints && !routeFixes.has(w.identifier)) return;

    const p = toCanvas(w.x, w.y);
    const isRoute = routeFixes.has(w.identifier);

    // draw point
    ctx.fillStyle = isRoute ? '#00ff88' : '#777';
    ctx.beginPath();
    ctx.arc(p.x, p.y, isRoute ? 4 : 2, 0, Math.PI * 2);
    ctx.fill();

    // route labels ALWAYS shown
    if (isRoute) return;

    const text = w.identifier;
    const metrics = ctx.measureText(text);

    const labelBox = {
      x: p.x - metrics.width / 2,
      y: p.y - 16,
      w: metrics.width,
      h: 10
    };

    // check collisions
    for (const box of drawnLabels) {
      if (intersects(labelBox, box)) return;
    }

    // draw label
    ctx.fillStyle = '#666';
    ctx.fillText(text, p.x, p.y - 6);
    drawnLabels.push(labelBox);
  });
}




function getFlightPlanFixes() {
  if (!availableSids.length || !availableStars.length) return [];

  const sid = availableSids[currentSidIndex];
  const star = availableStars[currentStarIndex];

  const fixes = [];

  // SID runway route (guaranteed)
  const sidRunwayRoute = sid.runwayRoutes?.[depRwy.value];
  if (sidRunwayRoute) {
    sidRunwayRoute.forEach(p => fixes.push(p.fix));
  }

  // SID transition (optional)
  if (activeSidTransition?.waypoints) {
    activeSidTransition.waypoints.forEach(p => fixes.push(p.fix));
  }

  // STAR transition (optional)
  if (activeStarTransition?.waypoints) {
    activeStarTransition.waypoints.forEach(p => fixes.push(p.fix));
  }

  // STAR runway route (guaranteed)
  const starRunwayRoute = star.runwayRoutes?.[arrRwy.value];
  if (starRunwayRoute) {
    starRunwayRoute.forEach(p => fixes.push(p.fix));
  }

  // remove duplicates while preserving order
  return [...new Set(fixes)];
}


function drawRoute() {
  const fixes = getFlightPlanFixes();
  if (fixes.length < 2) return;

  const points = fixes
    .map(id => waypoints.find(w => w.identifier === id))
    .filter(Boolean)
    .map(w => toCanvas(w.x, w.y));

  ctx.strokeStyle = '#ffffffff';
  ctx.lineWidth = 2;

  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();

ctx.font = WAYPOINT_FONT;
ctx.textAlign = 'center';
ctx.textBaseline = 'bottom';

points.forEach((p, i) => {
  // larger dot
  ctx.fillStyle = '#ffffffff';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
  ctx.fill();

  // label
  ctx.fillStyle = ROUTE_WAYPOINT_COLOR;
  ctx.fillText(fixes[i], p.x, p.y - 6);
});
}

function drawMap() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

  drawWaypoints();
  drawRoute();
}




/* =========================
   INIT
========================= */
loadData();


canvas.addEventListener('mousedown', e => {
  isPanning = true;
  startPan.x = e.clientX - offsetX;
  startPan.y = e.clientY - offsetY;
});

canvas.addEventListener('mousemove', e => {
  if (!isPanning) return;

  offsetX = e.clientX - startPan.x;
  offsetY = e.clientY - startPan.y;

  drawMap();
});

canvas.addEventListener('mouseup', () => {
  isPanning = false;
});

canvas.addEventListener('mouseleave', () => {
  isPanning = false;
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();

  const zoomIntensity = 0.0015;
  const zoom = 1 - e.deltaY * zoomIntensity;

  const mouseX = e.offsetX;
  const mouseY = e.offsetY;

  offsetX = mouseX - (mouseX - offsetX) * zoom;
  offsetY = mouseY - (mouseY - offsetY) * zoom;

  scale *= zoom;
  scale = Math.min(Math.max(scale, 0.2), 10);

  drawMap();
}, { passive: false });

document.getElementById('toggle-route-wp').onclick = () => {
  showOnlyRouteWaypoints = !showOnlyRouteWaypoints;

  document.getElementById('toggle-route-wp').textContent =
    showOnlyRouteWaypoints
      ? 'Show all waypoints'
      : 'Show route waypoints only';

  drawMap();
};
