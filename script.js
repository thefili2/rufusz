let waypoints = [], sids = [], stars = [];

async function loadData() {
  try {
    const [wpRes, sidRes, starRes] = await Promise.all([
      fetch('data/waypoints.json'),
      fetch('data/sids.json'),
      fetch('data/stars.json')
    ]);

    const wpData = await wpRes.json();
    const sidData = await sidRes.json();
    const starData = await starRes.json();

    waypoints = wpData.fixes;   // array di fixes
    sids = sidData.sids;        // array di SIDs
    stars = starData.stars;     // array di STARs

    populateDropdowns();        // chiama solo dopo il caricamento
  } catch (err) {
    console.error('Errore caricamento JSON:', err);
  }
}

function populateDropdowns() {
  const departingSelect = document.getElementById('departing');
  const arrivingSelect = document.getElementById('arriving');
  const depRwySelect = document.getElementById('depRwy');
  const arrRwySelect = document.getElementById('arrRwy');

  const airports = Array.from(new Set([...sids.map(s => s.airport), ...stars.map(s => s.airport)])).sort();

  airports.forEach(ap => {
    departingSelect.appendChild(new Option(ap, ap));
    arrivingSelect.appendChild(new Option(ap, ap));
  });

  function updateRunways(selectAirport, runwaySelect, isDeparture) {
    runwaySelect.innerHTML = '';
    const airportCode = selectAirport.value;
    let runways = [];
    if (isDeparture) {
      const sidList = sids.filter(s => s.airport === airportCode);
      runways = sidList.flatMap(s => s.applicableRunways);
    } else {
      const starList = stars.filter(s => s.airport === airportCode);
      runways = starList.flatMap(s => s.applicableRunways);
    }
    runways = Array.from(new Set(runways)).sort();
    runways.forEach(rwy => runwaySelect.appendChild(new Option(rwy, rwy)));
  }

  departingSelect.addEventListener('change', () => updateRunways(departingSelect, depRwySelect, true));
  arrivingSelect.addEventListener('change', () => updateRunways(arrivingSelect, arrRwySelect, false));

  // inizializza runways
  updateRunways(departingSelect, depRwySelect, true);
  updateRunways(arrivingSelect, arrRwySelect, false);
}

// Trova SID per aeroporto e runway
function findSID(departing, depRwy) {
  const sid = sids.find(s =>
    s.airport === departing && s.applicableRunways.includes(depRwy)
  );
  return sid?.runwayRoutes[depRwy]?.map(f => f.fix) || null;
}

// Trova STAR per aeroporto e runway
function findSTAR(arriving, arrRwy) {
  const star = stars.find(s =>
    s.airport === arriving && s.applicableRunways.includes(arrRwy)
  );
  return star?.runwayRoutes[arrRwy]?.map(f => f.fix) || null;
}

// Waypoint intermedio (semplice, uno vicino alla linea SID → STAR)
function connectWaypoints(sidLast, starFirst) {
  const sx = waypoints.find(w => w.identifier === sidLast);
  const ex = waypoints.find(w => w.identifier === starFirst);
  if (!sx || !ex) return [];

  const midX = (sx.x + ex.x)/2;
  const midY = (sx.y + ex.y)/2;

  const closest = waypoints.reduce((a,b) => {
    const da = Math.hypot(a.x - midX, a.y - midY);
    const db = Math.hypot(b.x - midX, b.y - midY);
    return da < db ? a : b;
  });

  if (closest.identifier !== sidLast && closest.identifier !== starFirst) return [closest.identifier];
  return [];
}

// Generate Flight Plan con output leggibile
function generateFlightPlan() {
  const departing = document.getElementById('departing').value;
  const arriving = document.getElementById('arriving').value;
  const depRwy = document.getElementById('depRwy').value;
  const arrRwy = document.getElementById('arrRwy').value;

  // Trova SID
  const sidObj = sids.find(s => s.airport === departing && s.applicableRunways.includes(depRwy));
  // Trova STAR
  const starObj = stars.find(s => s.airport === arriving && s.applicableRunways.includes(arrRwy));

  if (!sidObj || !starObj) {
    document.getElementById('output').textContent =
      "No SID or STAR found for this airport/runway combination.";
    return;
  }

  // Waypoints intermedi (semplice, opzionale)
  const sidLastFix = sidObj.runwayRoutes[depRwy]?.slice(-1)[0]?.fix;
  const starFirstFix = starObj.runwayRoutes[arrRwy]?.[0]?.fix;
  const middleWaypoints = connectWaypoints(sidLastFix, starFirstFix);

  // Costruisci la rotta
  let routeParts = [];
  routeParts.push(`${departing}/${depRwy}`);
  routeParts.push(sidObj.name);              // solo il nome del SID
  if (middleWaypoints.length > 0) routeParts.push(middleWaypoints.join('.'));
  routeParts.push(starObj.name);             // solo il nome della STAR
  routeParts.push(`${arrRwy}/${arriving}`);

  const routeOutput = routeParts.join(' ');

  document.getElementById('output').textContent = routeOutput;
}

// Click handler
document.getElementById('generate').addEventListener('click', generateFlightPlan);

// Carica dati JSON all’avvio
loadData();


