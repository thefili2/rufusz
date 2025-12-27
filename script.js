
const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");

canvas.width = 2200;
canvas.height = 1700;

const mapImage = new Image();
mapImage.src = "assets/map.png";

let showOnlyRouteWaypoints = false;

function getRouteFixSet() {
  return new Set(getRouteFixes());
}




let waypoints = [];
let sids = [];
let stars = [];

let availableSids = [];
let availableStars = [];
let currentSidIndex = 0;
let currentStarIndex = 0;

let activeSidTransition = null;
let activeStarTransition = null;
let drawnLabels = [];


function rectsOverlap(a, b) {
  return !(
    a.x + a.w < b.x ||
    a.x > b.x + b.w ||
    a.y + a.h < b.y ||
    a.y > b.y + b.h
  );
}

function getTextBox(ctx, text, x, y) {
  const metrics = ctx.measureText(text);
  const w = metrics.width;
  const h = 25; // approx height at 10px font
  return { x: x - w / 2, y: y - h, w, h };
}




function gameToMap(x, y) {
  const scaleX = (2146 - 159) / (54840 + 50265);
  const scaleY = (113 - 1541) / (-40395 - 40611);

  return {
    x: (x + 50265) * scaleX + 159,
    y: (y - 40611) * scaleY + 1541
  };
}

const toggleBtn = document.getElementById("toggle-route-wp");

toggleBtn.disabled = false;

toggleBtn.onclick = () => {
  showOnlyRouteWaypoints = !showOnlyRouteWaypoints;

  toggleBtn.textContent = showOnlyRouteWaypoints
    ? "Show all waypoints"
    : "Show route waypoints only";

  draw();
};

const directCheckbox = document.getElementById("directRoute");
const procControls = document.querySelector(".proc-controls");

directCheckbox.onchange = () => {
  if (directCheckbox.checked) {
    procControls.classList.add("disabled-area");
  } else {
    procControls.classList.remove("disabled-area");
  }
  draw();
};


async function loadData() {
  const [wpRes, sidRes, starRes] = await Promise.all([
    fetch("data/waypoints.json"),
    fetch("data/sids.json"),
    fetch("data/stars.json")
  ]);

  waypoints = (await wpRes.json()).fixes;
  sids = (await sidRes.json()).sids;
  stars = (await starRes.json()).stars;

  populateDropdowns();
  draw();
}
document.getElementById("toggle-route-wp").disabled = false;



function populateDropdowns() {
  const departing = document.getElementById("departing");
  const arriving = document.getElementById("arriving");
  const depRwy = document.getElementById("depRwy");
  const arrRwy = document.getElementById("arrRwy");

  const airports = [...new Set([...sids, ...stars].map(p => p.airport))];

  airports.forEach(a => {
    departing.add(new Option(a, a));
    arriving.add(new Option(a, a));
  });

  function updateRunways(airportSel, rwySel, src) {
    rwySel.innerHTML = "";
    const runways = [
      ...new Set(
        src
          .filter(p => p.airport === airportSel.value)
          .flatMap(p => p.applicableRunways)
      )
    ];
    runways.forEach(r => rwySel.add(new Option(r, r)));
  }

  departing.onchange = () => {
    updateRunways(departing, depRwy, sids);
    updateAvailableSids();
  };

  arriving.onchange = () => {
    updateRunways(arriving, arrRwy, stars);
    updateAvailableStars();
  };

  depRwy.onchange = updateAvailableSids;
  arrRwy.onchange = updateAvailableStars;

  updateRunways(departing, depRwy, sids);
  updateRunways(arriving, arrRwy, stars);
  updateAvailableSids();
  updateAvailableStars();
}


function updateAvailableSids() {
  availableSids = sids.filter(
    s =>
      s.airport === departing.value &&
      s.applicableRunways.includes(depRwy.value)
  );
  currentSidIndex = 0;
  activeSidTransition = pickTransition(availableSids[0]);
  sidName.textContent = availableSids[0]?.id || "—";
  draw();
}

function updateAvailableStars() {
  availableStars = stars.filter(
    s =>
      s.airport === arriving.value &&
      s.applicableRunways.includes(arrRwy.value)
  );
  currentStarIndex = 0;
  activeStarTransition = pickTransition(availableStars[0]);
  starName.textContent = availableStars[0]?.id || "—";
  draw();
}

function pickTransition(proc) {
  if (!proc || !proc.transitions?.length) return null;
  return proc.transitions[0];
}


prevSid.onclick = () => {
  if (!availableSids.length) return;
  currentSidIndex = (currentSidIndex - 1 + availableSids.length) % availableSids.length;
  activeSidTransition = pickTransition(availableSids[currentSidIndex]);
  sidName.textContent = availableSids[currentSidIndex].id;
  draw();
};

nextSid.onclick = () => {
  if (!availableSids.length) return;
  currentSidIndex = (currentSidIndex + 1) % availableSids.length;
  activeSidTransition = pickTransition(availableSids[currentSidIndex]);
  sidName.textContent = availableSids[currentSidIndex].id;
  draw();
};

prevStar.onclick = () => {
  if (!availableStars.length) return;
  currentStarIndex = (currentStarIndex - 1 + availableStars.length) % availableStars.length;
  activeStarTransition = pickTransition(availableStars[currentStarIndex]);
  starName.textContent = availableStars[currentStarIndex].id;
  draw();
};

nextStar.onclick = () => {
  if (!availableStars.length) return;
  currentStarIndex = (currentStarIndex + 1) % availableStars.length;
  activeStarTransition = pickTransition(availableStars[currentStarIndex]);
  starName.textContent = availableStars[currentStarIndex].id;
  draw();
};


generate.onclick = () => {
  const isDirect = document.getElementById("directRoute").checked;
  let plan = [];

  if (isDirect) {
    plan = [
      `${departing.value}/${depRwy.value}`,
      "DCT",
      `${arrRwy.value}/${arriving.value}`
    ].filter(Boolean);
  } else {
    const sid = availableSids[currentSidIndex];
    const star = availableStars[currentStarIndex];

    plan = [
      `${departing.value}/${depRwy.value}`,
      sid?.id,
      activeSidTransition?.name,
      star?.id,
      activeStarTransition?.name,
      `${arrRwy.value}/${arriving.value}`
    ].filter(Boolean);
  }

  output.textContent = plan.join(" ");

  showOnlyRouteWaypoints = false;

  const toggleBtn = document.getElementById("toggle-route-wp");
  toggleBtn.disabled = false;
  toggleBtn.textContent = "Show route waypoints only";

  copy.disabled = false;
  copy.textContent = "Copy to clipboard";
  copy.onclick = () => {
    navigator.clipboard.writeText(plan.join(" "));
    copy.textContent = "Copied!";
    setTimeout(() => {
      copy.textContent = "Copy to clipboard";
    }, 2000);
  };

  draw();
};




document.getElementById("toggle-route-wp").onclick = () => {
  showOnlyRouteWaypoints = !showOnlyRouteWaypoints;

  document.getElementById("toggle-route-wp").textContent =
    showOnlyRouteWaypoints
      ? "Show all waypoints"
      : "Show route waypoints only";

  draw();
};

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(mapImage, 0, 0);

  drawWaypoints();
  drawRoute();
}

function drawWaypoints() {

  ctx.font = "25px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  drawnLabels = [];

  const routeFixes = new Set(getRouteFixes());

  waypoints.forEach(w => {
    const p = gameToMap(w.x, w.y);
    const isRoute = routeFixes.has(w.identifier);

    if (showOnlyRouteWaypoints && !isRoute) return;

    ctx.fillStyle = isRoute ? "black" : "#888";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();

    const labelPositions = [
      { x: p.x, y: p.y - 10 },
      { x: p.x + 12, y: p.y },
      { x: p.x, y: p.y + 12 },
      { x: p.x - 12, y: p.y }
    ];

    for (let pos of labelPositions) {

      const box = getTextBox(ctx, w.identifier, pos.x, pos.y);

      let overlaps = drawnLabels.some(l => rectsOverlap(l, box));

      if (!overlaps) {
        ctx.fillStyle = isRoute ? "black" : "#666";
        ctx.fillText(w.identifier, pos.x, pos.y);

        drawnLabels.push(box);
        break;
      }
    }
  });
}




function drawRoute() {
  const fixes = getRouteFixes();
  if (fixes.length < 2) return;

  const points = fixes
    .map(id => waypoints.find(w => w.identifier === id))
    .filter(Boolean)
    .map(w => gameToMap(w.x, w.y));

  ctx.strokeStyle = "#ffffffff";
  ctx.lineWidth = 8;
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.stroke();

  points.forEach((p, i) => {
    ctx.fillStyle = "#ffffffff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillText(fixes[i], p.x, p.y - 8);
  });

}

function getRouteFixes() {
  if (!availableSids.length || !availableStars.length) return [];

  const isDirect = document.getElementById("directRoute").checked;
  const fixes = [];

  if (isDirect) {
    // Helper: Find ANY valid coordinate-fix for a given airport by scanning all its procedures
    // mode: 'dep' (search for start of procedures) or 'arr' (search for end of procedures)
    const findAirportFix = (airportCode, procedures, mode) => {
      // Filter procedures for this airport
      const airProcs = procedures.filter(p => p.airport === airportCode);

      for (const proc of airProcs) {
        // Collect all potential fix lists from this procedure
        const candidates = [];

        // Add runway routes points
        if (proc.runwayRoutes) {
          Object.values(proc.runwayRoutes).forEach(route => {
            candidates.push(route);
          });
        }
        // Add common route
        if (proc.commonRoute) candidates.push(proc.commonRoute);

        // For each candidate list, try to find a valid fix
        for (const list of candidates) {
          if (!list || !list.length) continue;

          // For Departure, we want the first valid fix (closest to airport/takeoff)
          // For Arrival, we want the last valid fix (closest to airport/landing)
          // But note: STAR definitions usually flow Entry -> Runway. So last point is closest to runway.
          // SID definitions flow Runway -> Exit. So first point is closest to runway.

          const pointsToCheck = (mode === 'arr') ? [...list].reverse() : list;

          const valid = pointsToCheck.find(p => waypoints.some(w => w.identifier === p.fix));
          if (valid) return valid.fix;
        }
      }
      return null;
    };

    const depFix = findAirportFix(departing.value, sids, 'dep');
    const arrFix = findAirportFix(arriving.value, stars, 'arr');

    if (depFix) fixes.push(depFix);
    if (arrFix) fixes.push(arrFix);

  } else {
    // Normal Procedure Route
    const sid = availableSids[currentSidIndex];
    const star = availableStars[currentStarIndex];

    const sidRunwayRoute = sid.runwayRoutes?.[depRwy.value];
    if (sidRunwayRoute) {
      sidRunwayRoute.forEach(p => fixes.push(p.fix));
    }

    if (activeSidTransition?.waypoints) {
      activeSidTransition.waypoints.forEach(p => fixes.push(p.fix));
    }

    if (activeStarTransition?.waypoints) {
      activeStarTransition.waypoints.forEach(p => fixes.push(p.fix));
    }

    const starRunwayRoute = star.runwayRoutes?.[arrRwy.value];
    if (starRunwayRoute) {
      starRunwayRoute.forEach(p => fixes.push(p.fix));
    }
  }

  return [...new Set(fixes)];
}




mapImage.onload = loadData;
