// نمط خريطة مخصص بالكامل (OpenMapTiles عبر OpenFreeMap): طرقات حسب النوع، مبانٍ ثلاثية الأبعاد، مياه، حدائق، أيقونات أماكن، أسماء عربية.
import { isAr } from '@/core/util.js'

const SRC = 'openmaptiles'
const FONT = ['Noto Sans Regular']
const FONT_B = ['Noto Sans Bold']

export const PALETTES = {
  light: {
    bg: '#F3F0EB', residential: '#EFEBE5', wood: '#D6E8C8', grass: '#DFEDD3', park: '#CFE6BF', sand: '#F2E8D0', water: '#A9D4EE', waterLine: '#8EC3E4',
    building: '#E4DED6', building3d: '#E8E2DA', buildingTop: '#F2EEE9', buildingLine: '#D8D1C8',
    motorway: '#FFC98A', motorwayCase: '#E3A35C', trunk: '#FFD9A6', trunkCase: '#E5B57C', primary: '#FFE9C7', primaryCase: '#E6C9A0',
    secondary: '#FFFFFF', secondaryCase: '#D9D2C8', minor: '#FFFFFF', minorCase: '#DED8CF', service: '#FBFAF8', path: '#D4CBBF', rail: '#C4BCB2',
    boundary: '#B9A89A', label: '#3D3631', labelSoft: '#6E655E', halo: '#FFFFFF', roadLabel: '#5A524C', poi: '#7A6F66', water_label: '#4C86AD',
  },
  dark: {
    bg: '#15120F', residential: '#191512', wood: '#1B241A', grass: '#1C241B', park: '#1A2A1C', sand: '#2A2419', water: '#0E2333', waterLine: '#123247',
    building: '#221D19', building3d: '#2A241F', buildingTop: '#332C26', buildingLine: '#2D2621',
    motorway: '#8A5A2B', motorwayCase: '#5E3B19', trunk: '#6F4C2A', trunkCase: '#4A311A', primary: '#4A3A2B', primaryCase: '#33281E',
    secondary: '#3A322B', secondaryCase: '#211C18', minor: '#2E2823', minorCase: '#1C1815', service: '#28231F', path: '#3A332D', rail: '#3B342E',
    boundary: '#5C5047', label: '#E6DED6', labelSoft: '#A99F96', halo: '#15120F', roadLabel: '#C7BDB3', poi: '#B3A79C', water_label: '#6FA8CF',
  },
}

const nameExpr = () => (isAr
  ? ['coalesce', ['get', 'name:ar'], ['get', 'name'], ['get', 'name:latin']]
  : ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']])

const W = (pairs) => ['interpolate', ['exponential', 1.5], ['zoom'], ...pairs]

function roadLayers(P) {
  // [فئات، عرض الحافة، عرض اللون، لون، لون الحافة، أدنى تقريب]
  const defs = [
    ['service', ['service', 'track'], [14, 0.6, 18, 9], [14, 0.4, 18, 7], P.service, P.minorCase, 14],
    ['minor', ['minor'], [12, 0.8, 14, 3, 18, 18], [12, 0.5, 14, 2.2, 18, 15], P.minor, P.minorCase, 12],
    ['tertiary', ['tertiary'], [10, 1, 14, 5, 18, 24], [10, 0.6, 14, 3.8, 18, 20], P.secondary, P.secondaryCase, 10],
    ['secondary', ['secondary'], [8, 1, 14, 6.5, 18, 28], [8, 0.6, 14, 5, 18, 24], P.secondary, P.secondaryCase, 8],
    ['primary', ['primary'], [6, 1, 14, 8, 18, 32], [6, 0.7, 14, 6.4, 18, 28], P.primary, P.primaryCase, 6],
    ['trunk', ['trunk'], [5, 1, 14, 9, 18, 34], [5, 0.8, 14, 7.2, 18, 30], P.trunk, P.trunkCase, 5],
    ['motorway', ['motorway'], [4, 1, 14, 10, 18, 36], [4, 0.8, 14, 8, 18, 32], P.motorway, P.motorwayCase, 4],
  ]
  const out = []
  // الأنفاق بشفافية
  for (const [id, cls, cw, fw, col, ccol, minz] of defs) {
    out.push({ id: `road-${id}-case`, type: 'line', source: SRC, 'source-layer': 'transportation', minzoom: minz, filter: ['all', ['in', ['get', 'class'], ['literal', cls]], ['!=', ['get', 'brunnel'], 'tunnel']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ccol, 'line-width': W(cw), 'line-opacity': ['interpolate', ['linear'], ['zoom'], minz, 0, minz + 1, 1] } })
  }
  for (const [id, cls, cw, fw, col, ccol, minz] of defs) {
    out.push({ id: `road-${id}`, type: 'line', source: SRC, 'source-layer': 'transportation', minzoom: minz, filter: ['all', ['in', ['get', 'class'], ['literal', cls]], ['!=', ['get', 'brunnel'], 'tunnel']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': col, 'line-width': W(fw) } })
  }
  out.unshift({ id: 'road-tunnel', type: 'line', source: SRC, 'source-layer': 'transportation', minzoom: 12, filter: ['==', ['get', 'brunnel'], 'tunnel'], layout: { 'line-join': 'round' }, paint: { 'line-color': P.minorCase, 'line-width': W([12, 1, 18, 14]), 'line-dasharray': [1.5, 1], 'line-opacity': 0.6 } })
  out.unshift({ id: 'road-path', type: 'line', source: SRC, 'source-layer': 'transportation', minzoom: 15, filter: ['in', ['get', 'class'], ['literal', ['path', 'pedestrian']]], layout: { 'line-join': 'round' }, paint: { 'line-color': P.path, 'line-width': W([15, 0.8, 18, 3]), 'line-dasharray': [2, 1.2] } })
  out.push({ id: 'rail', type: 'line', source: SRC, 'source-layer': 'transportation', minzoom: 12, filter: ['in', ['get', 'class'], ['literal', ['rail', 'transit']]], paint: { 'line-color': P.rail, 'line-width': W([12, 1, 18, 3]), 'line-dasharray': [3, 2] } })
  // اتجاه الطريق (سهم للطرق ذات الاتجاه الواحد)
  out.push({ id: 'oneway', type: 'symbol', source: SRC, 'source-layer': 'transportation', minzoom: 16, filter: ['==', ['get', 'oneway'], 1], layout: { 'symbol-placement': 'line', 'symbol-spacing': 120, 'text-field': '›', 'text-font': FONT_B, 'text-size': 16, 'text-keep-upright': false, 'text-allow-overlap': true }, paint: { 'text-color': P.labelSoft, 'text-opacity': 0.5 } })
  return out
}

export function buildStyle(theme = 'light', { satellite = false, buildings3d = true } = {}) {
  const P = PALETTES[theme] || PALETTES.light
  const fillO = satellite ? 0 : 1
  const name = nameExpr()
  const layers = [
    { id: 'bg', type: 'background', paint: { 'background-color': P.bg } },
    satellite && { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-saturation': -0.05, 'raster-contrast': 0.05 } },
    { id: 'landuse-res', type: 'fill', source: SRC, 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood']]], paint: { 'fill-color': P.residential, 'fill-opacity': fillO } },
    { id: 'landcover-sand', type: 'fill', source: SRC, 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'sand'], paint: { 'fill-color': P.sand, 'fill-opacity': fillO } },
    { id: 'landcover-wood', type: 'fill', source: SRC, 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-color': P.wood, 'fill-opacity': satellite ? 0 : 0.9 } },
    { id: 'landcover-grass', type: 'fill', source: SRC, 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland', 'wetland']]], paint: { 'fill-color': P.grass, 'fill-opacity': satellite ? 0 : 0.8 } },
    { id: 'park', type: 'fill', source: SRC, 'source-layer': 'park', paint: { 'fill-color': P.park, 'fill-opacity': satellite ? 0 : 0.9 } },
    { id: 'landuse-other', type: 'fill', source: SRC, 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['hospital', 'school', 'university', 'college', 'stadium', 'pitch', 'cemetery']]], paint: { 'fill-color': P.park, 'fill-opacity': satellite ? 0 : 0.45 } },
    { id: 'water', type: 'fill', source: SRC, 'source-layer': 'water', paint: { 'fill-color': P.water, 'fill-opacity': satellite ? 0 : 1 } },
    { id: 'waterway', type: 'line', source: SRC, 'source-layer': 'waterway', paint: { 'line-color': P.waterLine, 'line-width': W([8, 0.5, 18, 4]), 'line-opacity': satellite ? 0.4 : 1 } },
    { id: 'building', type: 'fill', source: SRC, 'source-layer': 'building', minzoom: 13, maxzoom: buildings3d ? 15.5 : 24, paint: { 'fill-color': P.building, 'fill-outline-color': P.buildingLine, 'fill-opacity': satellite ? 0 : ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 1] } },
    { id: 'boundary', type: 'line', source: SRC, 'source-layer': 'boundary', filter: ['<=', ['get', 'admin_level'], 4], paint: { 'line-color': P.boundary, 'line-width': 1, 'line-dasharray': [3, 2] } },
    ...roadLayers(P).map((l) => (satellite && l.type === 'line' && /case/.test(l.id) ? { ...l, paint: { ...l.paint, 'line-opacity': 0.5 } } : satellite && l.type === 'line' ? { ...l, paint: { ...l.paint, 'line-opacity': 0.75 } } : l)),
    buildings3d && !satellite && {
      id: 'building-3d', type: 'fill-extrusion', source: SRC, 'source-layer': 'building', minzoom: 15,
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], ['to-number', ['coalesce', ['get', 'render_height'], 8], 8], 0, P.building3d, 40, P.buildingTop],
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, ['to-number', ['coalesce', ['get', 'render_height'], 8], 8]],
        'fill-extrusion-base': ['to-number', ['coalesce', ['get', 'render_min_height'], 0], 0],
        'fill-extrusion-opacity': 0.92,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    // الأسماء
    { id: 'water-name', type: 'symbol', source: SRC, 'source-layer': 'water_name', layout: { 'text-field': name, 'text-font': FONT, 'text-size': 12, 'text-max-width': 6 }, paint: { 'text-color': P.water_label, 'text-halo-color': P.halo, 'text-halo-width': 1.2 } },
    { id: 'road-label', type: 'symbol', source: SRC, 'source-layer': 'transportation_name', minzoom: 13, filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']]], layout: { 'symbol-placement': 'line', 'text-field': name, 'text-font': FONT, 'text-size': W([13, 10, 18, 14]), 'text-max-angle': 30, 'text-padding': 2 }, paint: { 'text-color': P.roadLabel, 'text-halo-color': P.halo, 'text-halo-width': 1.6 } },
    { id: 'poi', type: 'symbol', source: SRC, 'source-layer': 'poi', minzoom: 15, filter: ['<=', ['to-number', ['get', 'rank'], 99], ['step', ['zoom'], 6, 16, 14, 17, 40]], layout: { 'icon-image': ['coalesce', ['image', ['match', ['get', 'class'], 'place_of_worship', 'religious_muslim', ['match', ['get', 'subclass'], ['florist', 'furniture'], ['get', 'subclass'], ['get', 'class']]]], ['image', 'circle_11']], 'icon-size': 1, 'text-field': name, 'text-font': FONT, 'text-size': 11.5, 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-max-width': 8, 'text-optional': true }, paint: { 'text-color': P.poi, 'text-halo-color': P.halo, 'text-halo-width': 1.3, 'icon-opacity': 0.85 } },
    { id: 'housenumber', type: 'symbol', source: SRC, 'source-layer': 'housenumber', minzoom: 17.5, layout: { 'text-field': ['get', 'housenumber'], 'text-font': FONT, 'text-size': 10 }, paint: { 'text-color': P.labelSoft, 'text-halo-color': P.halo, 'text-halo-width': 1 } },
    { id: 'place-minor', type: 'symbol', source: SRC, 'source-layer': 'place', minzoom: 12, filter: ['in', ['get', 'class'], ['literal', ['suburb', 'neighbourhood', 'quarter', 'hamlet']]], layout: { 'text-field': name, 'text-font': FONT, 'text-size': W([12, 11, 16, 14]), 'text-transform': 'none', 'text-letter-spacing': 0.04, 'text-max-width': 7 }, paint: { 'text-color': P.labelSoft, 'text-halo-color': P.halo, 'text-halo-width': 1.6 } },
    { id: 'place-town', type: 'symbol', source: SRC, 'source-layer': 'place', minzoom: 8, filter: ['in', ['get', 'class'], ['literal', ['town', 'village']]], layout: { 'text-field': name, 'text-font': FONT_B, 'text-size': W([8, 11, 14, 16]), 'text-max-width': 8 }, paint: { 'text-color': P.label, 'text-halo-color': P.halo, 'text-halo-width': 1.8 } },
    { id: 'place-city', type: 'symbol', source: SRC, 'source-layer': 'place', minzoom: 4, maxzoom: 15, filter: ['==', ['get', 'class'], 'city'], layout: { 'text-field': name, 'text-font': FONT_B, 'text-size': W([4, 12, 12, 22]), 'text-max-width': 8 }, paint: { 'text-color': P.label, 'text-halo-color': P.halo, 'text-halo-width': 2 } },
  ].filter(Boolean)

  return {
    version: 8,
    name: `wasalni-${theme}`,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
    sources: {
      [SRC]: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenMapTiles © OpenStreetMap' },
      ...(satellite ? { sat: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: 'Esri' } } : {}),
    },
    light: { anchor: 'viewport', color: '#ffffff', intensity: theme === 'dark' ? 0.25 : 0.35, position: [1.5, 200, 40] },
    layers,
  }
}
