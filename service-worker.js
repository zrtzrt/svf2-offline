const CACHE_NAME = 'pwa-cache-v1';
const BASE_URL = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/';
const FONT_URL = 'https://fonts.autodesk.com/ArtifaktElement/WOFF2/';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Autodesk files
  `${BASE_URL}viewer3D.min.js`,
  `${BASE_URL}style.min.css`,
  `${BASE_URL}res/locales/en/allstrings.json`,
  `${BASE_URL}lmvworker.min.js`,
  // Extensions
  `${BASE_URL}extensions/MixpanelProvider/MixpanelProvider.min.js`,
  `${BASE_URL}extensions/ViewCubeUi/ViewCubeUi.min.js`,
  `${BASE_URL}extensions/PDF/PDF.min.js`,
  `${BASE_URL}extensions/Measure/Measure.min.js`,
  `${BASE_URL}extensions/BimWalk/BimWalk.min.js`,
  `${BASE_URL}extensions/Section/Section.min.js`,
  `${BASE_URL}extensions/LayerManager/LayerManager.min.js`,
  `${BASE_URL}extensions/Hyperlink/Hyperlink.min.js`,
  `${BASE_URL}extensions/Snapping/Snapping.min.js`,
  `${BASE_URL}extensions/CompGeom/CompGeom.min.js`,
  `${BASE_URL}extensions/DocumentBrowser/DocumentBrowser.min.js`,
  // Resources
  `${BASE_URL}res/environments/boardwalk_irr.logluv.dds`,
  `${BASE_URL}res/environments/boardwalk_mipdrop.logluv.dds`,
  `${BASE_URL}res/locales/en/VCcrossRGBA8small.dds`,
  `${BASE_URL}res/textures/VCedge1.png`,
  `${BASE_URL}res/textures/VChome.png`,
  `${BASE_URL}res/textures/VCarrows.png`,
  `${BASE_URL}res/textures/VCcontext.png`,
  `${BASE_URL}res/textures/VChomeS.png`,
  `${BASE_URL}res/textures/VCarrowsS0.png`,
  `${BASE_URL}res/textures/VCarrowsS1.png`,
  `${BASE_URL}res/textures/VCcontextS.png`,
  `${BASE_URL}res/textures/VCcompass-pointer-b.png`,
  `${BASE_URL}res/textures/VCcompass-base.png`,
  // Fonts
  `${FONT_URL}Artifakt%20Element%20Regular.woff2`
];

// Install: cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch: serve from cache or network
self.addEventListener('fetch', event => {
  // Skip Autodesk API calls
  if (event.request.url.includes('developer.api.autodesk.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});