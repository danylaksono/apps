// MAP
const map = L.map('map', { zoomControl:false }).setView([-7.797, 110.370], 14);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
  subdomains:'abcd', maxZoom:19
}).addTo(map);
L.control.zoom({ position:'bottomright' }).addTo(map);

// STATE
let origins       = [];
let originMarkers = [];
let isoLayers     = [];
let amenityMarkers = [];
let lastGeoJSON   = null;
let isRunning     = false;
let walkSpeedKmh  = 4.5;

const PALETTE = ['#4fffb0','#f5c842','#ff5c6e','#a78bfa','#60a5fa','#fb923c','#e879f9','#f87171'];
let rings = [
  { id:1, min:5,  color:PALETTE[0], on:true },
  { id:2, min:10, color:PALETTE[1], on:true },
  { id:3, min:15, color:PALETTE[2], on:true },
];
let nextRingId = 4;

// REFS
const speedInput  = document.getElementById('speed');
const speedDisp   = document.getElementById('speed-display');
const statusEl    = document.getElementById('status');
const hintEl      = document.getElementById('hint');
const btnRun      = document.getElementById('btn-run');
const btnDownload = document.getElementById('btn-download');
const btnClear    = document.getElementById('btn-clear');
const ringsList   = document.getElementById('rings-list');
const originInfo  = document.getElementById('origin-info');
const gjInput     = document.getElementById('geojson-input');
const dropZone    = document.getElementById('drop-zone');

function setStatus(type, html) { statusEl.className = type; statusEl.innerHTML = html; }
function spin(msg) { setStatus('busy', '<span class="spin"></span>' + msg); }
function updateRunBtn() { btnRun.disabled = origins.length === 0 || isRunning; }

// SPEED
speedInput.addEventListener('input', e => {
  walkSpeedKmh = parseFloat(e.target.value);
  speedDisp.textContent = walkSpeedKmh.toFixed(1);
});

// RINGS UI
function renderRings() {
  ringsList.innerHTML = '';
  rings.forEach(r => {
    const row = document.createElement('div');
    row.className = 'ring-row';
    row.innerHTML =
      '<div class="ring-toggle' + (r.on ? '' : ' off') + '" data-id="' + r.id + '"' +
        ' style="border-color:' + r.color + ';background:' + (r.on ? r.color : 'transparent') + '"></div>' +
      '<input class="ring-min-input" type="number" min="1" max="120" value="' + r.min + '" data-id="' + r.id + '">' +
      '<span class="ring-unit">min</span>' +
      '<input class="ring-color-input" type="color" value="' + r.color + '" data-id="' + r.id + '">' +
      '<button class="ring-del" data-id="' + r.id + '" title="Remove">&times;</button>';
    ringsList.appendChild(row);
  });
  ringsList.querySelectorAll('.ring-toggle').forEach(el => {
    el.addEventListener('click', () => {
      const r = rings.find(x => x.id === +el.dataset.id);
      if (r) { r.on = !r.on; renderRings(); }
    });
  });
  ringsList.querySelectorAll('.ring-min-input').forEach(el => {
    el.addEventListener('change', () => {
      const r = rings.find(x => x.id === +el.dataset.id);
      if (r) r.min = Math.max(1, Math.min(120, parseInt(el.value) || 5));
    });
  });
  ringsList.querySelectorAll('.ring-color-input').forEach(el => {
    el.addEventListener('input', () => {
      const r = rings.find(x => x.id === +el.dataset.id);
      if (r) { r.color = el.value; renderRings(); }
    });
  });
  ringsList.querySelectorAll('.ring-del').forEach(el => {
    el.addEventListener('click', () => {
      rings = rings.filter(x => x.id !== +el.dataset.id);
      renderRings();
    });
  });
}
renderRings();

document.getElementById('btn-add-ring').addEventListener('click', () => {
  const nextMin = rings.length ? Math.max(...rings.map(r => r.min)) + 5 : 5;
  rings.push({ id:nextRingId++, min:nextMin, color:PALETTE[rings.length % PALETTE.length], on:true });
  renderRings();
});

// ORIGINS — map click
map.on('click', ({ latlng: { lat, lng } }) => {
  if (isRunning) return;
  setOrigins([{ lat, lon:lng, label: lat.toFixed(5) + ', ' + lng.toFixed(5) }]);
  hintEl.classList.add('hidden');
  setStatus('', 'Origin set — click &#9654; Run.');
});

function setOrigins(list) {
  clearOriginMarkers();
  origins = list;
  originMarkers = origins.map(o =>
    L.circleMarker([o.lat, o.lon], {
      radius:7, color:'#fff', weight:2, fillColor:'#4fffb0', fillOpacity:1
    }).addTo(map)
  );
  updateOriginInfo();
  updateRunBtn();
}

function clearOriginMarkers() {
  originMarkers.forEach(m => map.removeLayer(m));
  originMarkers = [];
}

// ORIGINS — GeoJSON upload
function handleGeoJSON(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const gj = JSON.parse(e.target.result);
      const features = gj.type === 'FeatureCollection' ? gj.features
                     : gj.type === 'Feature'           ? [gj] : [];
      const newOrigins = [];
      features.forEach((f, i) => {
        const geom = f.geometry;
        if (!geom) return;
        const pairs = geom.type === 'Point'      ? [geom.coordinates]
                    : geom.type === 'MultiPoint' ? geom.coordinates : [];
        pairs.forEach(([lon, lat]) => {
          newOrigins.push({ lat, lon, label: f.properties?.name || f.properties?.id || ('Point ' + (newOrigins.length + 1)) });
        });
      });
      if (!newOrigins.length) throw new Error('No Point features found in file.');
      setOrigins(newOrigins);
      if (newOrigins.length > 1)
        map.fitBounds(L.latLngBounds(newOrigins.map(o => [o.lat, o.lon])), { padding:[40,40] });
      else
        map.setView([newOrigins[0].lat, newOrigins[0].lon], 14);
      hintEl.classList.add('hidden');
      setStatus('', newOrigins.length + ' origin' + (newOrigins.length > 1 ? 's' : '') + ' loaded. Click &#9654; Run.');
    } catch(err) { setStatus('err', '&#10005; ' + err.message); }
  };
  reader.readAsText(file);
}

gjInput.addEventListener('change', e => { if (e.target.files[0]) handleGeoJSON(e.target.files[0]); e.target.value = ''; });
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) handleGeoJSON(e.dataTransfer.files[0]);
});

function updateOriginInfo() {
  if (!origins.length) { originInfo.innerHTML = ''; return; }
  originInfo.innerHTML =
    '<div class="origin-badge">&#9711; ' + origins.length + ' origin' + (origins.length > 1 ? 's' : '') + ' active' +
    ' <button id="btn-clear-origins">&times;</button></div>';
  document.getElementById('btn-clear-origins').addEventListener('click', () => {
    clearOriginMarkers(); origins = [];
    updateOriginInfo(); updateRunBtn();
    setStatus('', 'Click the map or upload a GeoJSON.');
    hintEl.classList.remove('hidden');
  });
}

function displayAnalysis(results) {
  const container = document.getElementById('results-view');
  if (!container) return;
  
  // Sort smallest rings first for the charts
  const sorted = [...results].sort((a,b) => a.min - b.min);
  const categories = ['Education', 'Health', 'Public', 'Groceries', 'Parks'];
  
  let html = '<div class="analysis-results">';
  sorted.forEach(res => {
    html += `
      <div class="result-ring">
        <div class="ring-title" style="border-left: 3px solid ${res.color}">
          Accessible within ${res.min} mins
        </div>
        <div class="stats-grid">
    `;
    
    categories.forEach(cat => {
      const val = res.stats[cat] || 0;
      const maxVal = Math.max(...sorted.flatMap(r => Object.values(r.stats)), 1);
      const width = (val / maxVal) * 100;
      
      html += `
        <div class="stat-row">
          <div class="stat-label">${cat}</div>
          <div class="stat-bar-wrap">
            <div class="stat-bar" style="width: ${width}%; background: ${res.color}"></div>
          </div>
          <div class="stat-val">${val}</div>
        </div>
      `;
    });
    
    html += `</div></div>`;
  });
  
  html += '</div>';
  container.innerHTML = html;
  container.style.display = 'block';
}

function clearAnalysis() {
  const container = document.getElementById('results-view');
  if (container) {
    container.innerHTML = '';
    container.style.display = 'none';
  }
}

function clearAmenityMarkers() {
  amenityMarkers.forEach(m => map.removeLayer(m));
  amenityMarkers = [];
}

// CLEAR
btnClear.addEventListener('click', () => {
  clearIsoLayers(); lastGeoJSON = null; btnDownload.disabled = true;
  clearAmenityMarkers();
  clearAnalysis();
  setStatus('', 'Cleared.');
});
function clearIsoLayers() { isoLayers.forEach(l => map.removeLayer(l)); isoLayers = []; }

// DOWNLOAD
btnDownload.addEventListener('click', () => {
  if (!lastGeoJSON) return;
  const blob = new Blob([JSON.stringify(lastGeoJSON, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'isochrones_' + Date.now() + '.geojson'; a.click();
  URL.revokeObjectURL(url);
});

// HAVERSINE
function haversine(lat1, lon1, lat2, lon2) {
  const R=6371000, r=Math.PI/180;
  const φ1=lat1*r, φ2=lat2*r, dφ=(lat2-lat1)*r, dλ=(lon2-lon1)*r;
  const a = Math.sin(dφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(dλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// NEAREST NODE
function nearestNode(nodes, lat, lon) {
  let best=null, bestD=Infinity;
  for (const [id, n] of nodes) {
    const d = haversine(lat, lon, n.lat, n.lon);
    if (d < bestD) { bestD=d; best=id; }
  }
  return best;
}

// MIN-HEAP
class MinHeap {
  constructor() { this.h=[]; }
  push(item) {
    this.h.push(item); let i=this.h.length-1;
    while (i>0) {
      const p=(i-1)>>1;
      if (this.h[p][0]<=this.h[i][0]) break;
      [this.h[p],this.h[i]]=[this.h[i],this.h[p]]; i=p;
    }
  }
  pop() {
    const top=this.h[0], last=this.h.pop();
    if (this.h.length) {
      this.h[0]=last; let i=0;
      for(;;) {
        let s=i,l=2*i+1,r=2*i+2;
        if (l<this.h.length&&this.h[l][0]<this.h[s][0]) s=l;
        if (r<this.h.length&&this.h[r][0]<this.h[s][0]) s=r;
        if (s===i) break;
        [this.h[i],this.h[s]]=[this.h[s],this.h[i]]; i=s;
      }
    }
    return top;
  }
  get size() { return this.h.length; }
}

// DIJKSTRA
function dijkstra(adj, startId, maxSec) {
  const dist=new Map([[startId,0]]), visited=new Set(), heap=new MinHeap();
  heap.push([0,startId]);
  while (heap.size) {
    const [d,u]=heap.pop();
    if (visited.has(u)) continue;
    visited.add(u);
    if (d>maxSec) continue;
    for (const [v,w] of (adj.get(u)||[])) {
      const nd=d+w;
      if (nd<(dist.get(v)??Infinity)) { dist.set(v,nd); if(nd<=maxSec) heap.push([nd,v]); }
    }
  }
  return dist;
}

// BUILD GRAPH
function buildGraph(elements) {
  const speedMs=walkSpeedKmh*1000/3600;
  const nodes=new Map(), adj=new Map();
  for (const el of elements)
    if (el.type==='node') nodes.set(el.id, {lat:el.lat, lon:el.lon});
  for (const el of elements) {
    if (el.type!=='way') continue;
    const oneway=el.tags?.oneway==='yes'||el.tags?.oneway==='1';
    for (let i=0;i<el.nodes.length-1;i++) {
      const a=el.nodes[i], b=el.nodes[i+1];
      const na=nodes.get(a), nb=nodes.get(b);
      if (!na||!nb) continue;
      const t=haversine(na.lat,na.lon,nb.lat,nb.lon)/speedMs;
      if (!adj.has(a)) adj.set(a,[]);
      if (!adj.has(b)) adj.set(b,[]);
      adj.get(a).push([b,t]);
      if (!oneway) adj.get(b).push([a,t]);
    }
  }
  return {nodes, adj};
}

// ISOCHRONE
function makeIsochrone(nodes, distMap, maxSec) {
  const pts=[];
  for (const [id,d] of distMap) {
    if (d<=maxSec) { const n=nodes.get(id); if(n) pts.push(turf.point([n.lon,n.lat])); }
  }
  if (pts.length<4) return null;
  const fc=turf.featureCollection(pts);
  try { return turf.concave(fc,{maxEdge:0.35})||turf.convex(fc); }
  catch { return turf.convex(fc); }
}

// OVERPASS
const MIRRORS=[
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const AMENITY_QUERY = `
  node["amenity"~"^(school|kindergarten|university|hospital|clinic|pharmacy|doctors|townhall|library|post_office)$"](around:{{radius}},{{lat}},{{lon}});
  way["amenity"~"^(school|kindergarten|university|hospital|clinic|pharmacy|doctors|townhall|library|post_office)$"](around:{{radius}},{{lat}},{{lon}});
  node["shop"~"^(supermarket|convenience|bakery)$"](around:{{radius}},{{lat}},{{lon}});
  way["shop"~"^(supermarket|convenience|bakery)$"](around:{{radius}},{{lat}},{{lon}});
  node["leisure"~"^(park|playground|garden)$"](around:{{radius}},{{lat}},{{lon}});
  way["leisure"~"^(park|playground|garden)$"](around:{{radius}},{{lat}},{{lon}});
`;

function buildQuery(lat, lon, radiusM, tSec) {
  const amenityQ = AMENITY_QUERY.replace(/{{radius}}/g, radiusM).replace(/{{lat}}/g, lat).replace(/{{lon}}/g, lon);
  return '[out:json][timeout:'+tSec+'];'
    +'('
    +'way["highway"~"^(residential|living_street|pedestrian|footway|path|cycleway|service|secondary|tertiary|unclassified|primary)$"]'
    +'(around:'+radiusM+','+lat+','+lon+');'
    + amenityQ
    +');out body qt;>;out skel qt;';
}

function getAmenityCategory(tags) {
  if (!tags) return null;
  const a = tags.amenity;
  const s = tags.shop;
  const l = tags.leisure;

  if (['school', 'kindergarten', 'university'].includes(a)) return 'Education';
  if (['hospital', 'clinic', 'pharmacy', 'doctors'].includes(a)) return 'Health';
  if (['townhall', 'library', 'post_office'].includes(a)) return 'Public';
  if (['supermarket', 'convenience', 'bakery'].includes(s)) return 'Groceries';
  if (['park', 'playground', 'garden'].includes(l)) return 'Parks';
  return null;
}

function getAmenityEmoji(category) {
  const emojis = {
    'Education': '🎓',
    'Health': '🏥',
    'Public': '🏛️',
    'Groceries': '🛒',
    'Parks': '🌳'
  };
  return emojis[category] || '📍';
}
async function fetchOSM(lat, lon, radiusM, idx, total) {
  const cap=Math.min(radiusM,2000);
  const errors=[];
  for (const mirror of MIRRORS) {
    for (const [attempt,tSec] of [[1,25],[2,45]]) {
      try {
        spin('Fetching OSM (origin '+idx+'/'+total+', '+cap+'m radius) — mirror '+(MIRRORS.indexOf(mirror)+1)+', attempt '+attempt+'…');
        const ctrl=new AbortController();
        const timer=setTimeout(()=>ctrl.abort(),(tSec+5)*1000);
        const res=await fetch(mirror,{method:'POST',body:'data='+encodeURIComponent(buildQuery(lat,lon,cap,tSec)),signal:ctrl.signal});
        clearTimeout(timer);
        if (!res.ok) { errors.push(mirror+'→HTTP '+res.status); break; }
        const data=await res.json();
        if (!data.elements?.length) throw new Error('No roads found near this point.');
        return data;
      } catch(e) {
        if (e.name==='AbortError') { errors.push(mirror+'→timeout'); break; }
        errors.push(mirror+'→'+e.message);
        if (attempt===1) continue;
        break;
      }
    }
  }
  throw new Error('Origin '+idx+': all mirrors failed — '+errors.join(' | '));
}

// MERGE DIST MAPS (min across origins)
function mergeDistMaps(maps) {
  const merged=new Map();
  for (const dm of maps)
    for (const [id,d] of dm)
      if (d<(merged.get(id)??Infinity)) merged.set(id,d);
  return merged;
}

// RUN
btnRun.addEventListener('click', runAnalysis);

async function runAnalysis() {
  if (isRunning||!origins.length) return;
  isRunning=true; btnRun.disabled=true; btnDownload.disabled=true;
  clearIsoLayers(); lastGeoJSON=null;
  clearAmenityMarkers();

  const activeRings=rings.filter(r=>r.on&&r.min>0);
  if (!activeRings.length) {
    setStatus('err','&#10005; No active rings. Enable at least one.');
    isRunning=false; updateRunBtn(); return;
  }
  const maxMin=Math.max(...activeRings.map(r=>r.min));
  const radiusM=Math.ceil((walkSpeedKmh*1000/60)*maxMin*1.4);

  try {
    // Fetch OSM per origin, deduplicate elements
    const seen=new Map();
    for (let i=0;i<origins.length;i++) {
      const o=origins[i];
      const osm=await fetchOSM(o.lat,o.lon,radiusM,i+1,origins.length);
      for (const el of osm.elements) {
        const key=el.type+':'+el.id;
        if (!seen.has(key)) seen.set(key,el);
      }
    }
    const elements=[...seen.values()];
    const nN=elements.filter(e=>e.type==='node').length;
    const nW=elements.filter(e=>e.type==='way').length;
    spin('Building graph — '+nN.toLocaleString()+' nodes, '+nW+' ways…');

    const {nodes,adj}=buildGraph(elements);

    // Dijkstra per origin
    const distMaps=[];
    for (let i=0;i<origins.length;i++) {
      spin('Routing from origin '+(i+1)+'/'+origins.length+'…');
      const o=origins[i];
      const startId=nearestNode(nodes,o.lat,o.lon);
      if (!startId) { console.warn('Origin '+(i+1)+': no nearby node'); continue; }
      distMaps.push(dijkstra(adj,startId,maxMin*60));
    }
    if (!distMaps.length) throw new Error('No origins could be routed.');

    spin('Computing isochrones and analysis…');
    const merged=mergeDistMaps(distMaps);

    // Extract amenities with coordinates
    const amenities = elements.filter(e => {
      if (e.type === 'way' && e.nodes && e.tags) {
        return !!getAmenityCategory(e.tags);
      }
      if (e.type === 'node' && e.tags) {
        return !!getAmenityCategory(e.tags);
      }
      return false;
    }).map(e => {
      let lat, lon;
      if (e.type === 'node') {
        lat = e.lat; lon = e.lon;
      } else {
        // Simple centroid for ways/areas
        const wayNodes = e.nodes.map(nid => nodes.get(nid)).filter(n => !!n);
        if (wayNodes.length === 0) return null;
        lat = wayNodes.reduce((sum, n) => sum + n.lat, 0) / wayNodes.length;
        lon = wayNodes.reduce((sum, n) => sum + n.lon, 0) / wayNodes.length;
      }
      return { lat, lon, category: getAmenityCategory(e.tags), name: e.tags.name || 'Unnamed' };
    }).filter(a => !!a);

    // Render largest ring first so smaller rings sit on top
    const sortedRings=[...activeRings].sort((a,b)=>b.min-a.min);
    const features=[];
    let rendered=0;
    const ringResults = [];

    for (const ring of sortedRings) {
      const poly=makeIsochrone(nodes,merged,ring.min*60);
      if (!poly) continue;
      
      // Analyze amenities in this ring
      const inRing = amenities.filter(a => turf.booleanPointInPolygon(turf.point([a.lon, a.lat]), poly));
      const stats = {};
      inRing.forEach(a => stats[a.category] = (stats[a.category] || 0) + 1);
      
      ringResults.push({
        min: ring.min,
        color: ring.color,
        count: inRing.length,
        stats
      });

      poly.properties={
        time_min:ring.min, color:ring.color,
        origins_count:origins.length, walk_speed_kmh:walkSpeedKmh,
        amenities_count: inRing.length,
        amenities_stats: stats
      };
      features.push(poly);
      const layer=L.geoJSON(poly,{
        style:{color:ring.color,fillColor:ring.color,weight:2,opacity:.9,fillOpacity:.15}
      }).addTo(map);
      isoLayers.push(layer);
      rendered++;
    }

    if (!rendered) throw new Error('No isochrones generated — too few reachable nodes.');

    // Add amenity markers for the largest ring
    const largestRing = features[0]; // sortedRings was sorted b.min - a.min, so largest is first
    if (largestRing) {
      const inLargest = amenities.filter(a => turf.booleanPointInPolygon(turf.point([a.lon, a.lat]), largestRing));
      inLargest.forEach(a => {
        const marker = L.marker([a.lat, a.lon], {
          icon: L.divIcon({
            html: `<div style="font-size:16px; line-height:1; filter: drop-shadow(0 0 2px white);">${getAmenityEmoji(a.category)}</div>`,
            className: 'amenity-icon',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        }).bindPopup(`<strong>${a.name}</strong><br>${a.category}`).addTo(map);
        amenityMarkers.push(marker);
      });
      
      // Zoom to show all rings
      const bounds = L.featureGroup(isoLayers).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], animate: true });
      }
    }

    displayAnalysis(ringResults);

    lastGeoJSON={
      type:'FeatureCollection',
      properties:{
        generated:new Date().toISOString(),
        walk_speed_kmh:walkSpeedKmh,
        origins:origins.map(o=>({lat:o.lat,lon:o.lon,label:o.label})),
      },
      features
    };
    btnDownload.disabled=false;

    const reachable=[...merged.values()].filter(d=>d<=maxMin*60).length;
    setStatus('ok',
      '&#10003; '+rendered+' isochrone'+(rendered>1?'s':'')+
      ' from '+origins.length+' origin'+(origins.length>1?'s':'')+
      '<br>'+reachable.toLocaleString()+' nodes reachable within '+maxMin+' min'
    );
  } catch(err) {
    setStatus('err','&#10005; '+err.message);
  }
  isRunning=false; updateRunBtn();
}
