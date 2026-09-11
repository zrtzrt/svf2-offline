# Autodesk Viewer PWA (offline demo)

A minimal [Progressive Web App](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
that runs the **Autodesk Platform Services (APS / Forge) Viewer 7.x** as an installable page whose
*application shell* keeps working without a network connection.

A [service worker](service-worker.js) pre-caches the Viewer runtime at install time — `viewer3D.min.js`,
`style.min.css`, `lmvworker.min.js`, the extensions, the environment maps, the ViewCube textures and the
Artifakt font — and then serves those requests cache-first. So after the page has been loaded once,
the toolbar, ViewCube, navigation and extensions no longer depend on the CDN.

> **The model itself is still streamed from Autodesk.** Only the Viewer runtime is cached, so the
> derivative data always comes from the network and you need a valid APS token plus a model you are
> allowed to view. See [Setup](#setup) for the full walkthrough.

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell. Loads the Viewer from the APS CDN and registers the service worker. |
| `app.js` | Boots the Viewer (`env: AutodeskProduction2`, `api: streamingV2`), picks a token — online: fetches it from a token endpoint, offline: falls back to a dummy token — and loads the model URN. |
| `config.json` | The model URN and the token endpoint. The only file you edit to point the demo at your own model. |
| `service-worker.js` | Pre-caches the runtime asset list on install, then answers matching requests cache-first. |
| `lmvfilelist.txt` | The list of Viewer runtime URLs to mirror (28 entries). |
| `setup/download-svf-offline.sh` | Mirrors the runtime with `wget -r -i lmvfilelist.txt`, then optionally swaps the Forge logo for an ACME logo. |
| `https_server.py` | Tiny self-signed HTTPS server, only needed to test the PWA from **another** device on your LAN. |
| `manifest.json`, `styles.css`, `icons/` | PWA metadata, styling and install icons. |

## Setup

### 1. Mirror the Viewer runtime (optional)

```bash
cd setup
./download-svf-offline.sh
```

This downloads every URL in `lmvfilelist.txt` and leaves the files under
`developer.api.autodesk.com/modelderivative/v2/viewers/7.*/…`. `index.html` keeps pointing at the
CDN, so this step is only a safety copy — edit `index.html` to reference the local copy if you want
to host the runtime yourself.

> The last line of the script (`mv autodeskviewer.com/viewers/latest/ ./lmv`) is a leftover from an
> older revision of this demo: the files actually land under `developer.api.autodesk.com/`, so that
> `mv` reports "No such file or directory". Harmless, but expected.

### 2. Serve the page

A service worker needs a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).
`http://localhost` and `http://127.0.0.1` already **are** secure contexts, so for local testing any
static server is enough:

```bash
python3 -m http.server 8000
# → http://localhost:8000/
```

`https_server.py` is only needed when you want to open the page from another device on your LAN.
It expects a combined key+certificate PEM named `localhost.pem`, and uses `ssl.wrap_socket()`,
which was removed in Python 3.12 — on a recent Python, prefer `mkcert` plus any HTTPS-capable
static server.

### 3. Get APS credentials

1. Sign in at <https://aps.autodesk.com> and open **My Apps → Create App**.
2. Pick **Server-to-server** (2-legged). That is what this demo uses — the browser only ever talks
   to the Model Derivative service, and the model belongs to the same app.
3. Copy the **Client ID** and **Client Secret**. Keep the secret out of browser code — it belongs in
   the token endpoint from step 5.

### 4. Upload a model and translate it

The Viewer can only display something that has been translated by the Model Derivative API, so put a
file into an OSS bucket and run a translation job. Any format the service supports works
(Revit, Navisworks, Inventor, Fusion, …).

```bash
export APS_CLIENT_ID=your-client-id
export APS_CLIENT_SECRET=your-client-secret

# 2-legged token (needs jq; without it use:
#   python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
TOKEN=$(curl -s https://developer.api.autodesk.com/authentication/v2/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "client_id=$APS_CLIENT_ID" -d "client_secret=$APS_CLIENT_SECRET" \
  -d 'grant_type=client_credentials' \
  -d 'scope=data:read data:write bucket:create viewables:read' \
  | jq -r .access_token)

# Persistent buckets must be named <lowercase client id><suffix>; -basic-app is the usual choice
BUCKET=$(echo "$APS_CLIENT_ID" | tr 'A-Z' 'a-z')-basic-app
curl -s -X POST https://developer.api.autodesk.com/oss/v2/buckets \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"bucketKey\":\"$BUCKET\",\"policyKey\":\"persistent\"}"

curl -s -X PUT "https://developer.api.autodesk.com/oss/v2/buckets/$BUCKET/objects/model.nwd" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/octet-stream' \
  --data-binary @/path/to/model.nwd

# The Viewer wants the URN base64url-encoded, padding stripped
URN=$(printf 'urn:adsk.objects:os.object:%s/model.nwd' "$BUCKET" \
      | base64 | tr '+/' '-_' | tr -d '=')

# Translate (svf), then poll the manifest until status=success / progress=complete
curl -s -X POST https://developer.api.autodesk.com/modelderivative/v2/designdata/job \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"input\":{\"urn\":\"$URN\"},\"output\":{\"formats\":[{\"type\":\"svf\",\"views\":[\"3d\"]}]}}"
curl -s "https://developer.api.autodesk.com/modelderivative/v2/designdata/$URN/manifest" \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Run a token endpoint

`app.js` fetches a token from a URL and expects `{ "access_token": "…" }` back. The endpoint has to
send CORS headers, because the browser calls it from the page. A minimal no-dependency Node server
(Node 18+, for the built-in `fetch`):

```js
// token-server.mjs — APS_CLIENT_ID / APS_CLIENT_SECRET come from the environment
import http from 'node:http';

const CLIENT_ID = process.env.APS_CLIENT_ID;
const CLIENT_SECRET = process.env.APS_CLIENT_SECRET;
let cached = null;                                   // avoid hammering the auth endpoint

async function token() {
  if (cached && cached.exp > Date.now()) return cached.json;
  const res = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'viewables:read data:read',
    }),
  });
  if (!res.ok) throw new Error(`token request failed: ${res.status}`);
  const json = await res.json();
  cached = { json, exp: Date.now() + (json.expires_in - 60) * 1000 };
  return json;
}

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  try { res.end(JSON.stringify(await token())); }
  catch (err) { res.statusCode = 500; res.end(JSON.stringify({ error: String(err) })); }
}).listen(process.env.PORT || 3000);
```

```bash
APS_CLIENT_ID=your-client-id APS_CLIENT_SECRET=your-client-secret node token-server.mjs
# → http://localhost:3000/
```

### 6. Point the demo at your model and token server

`config.json` is the only file you edit:

```json
{
	"urn": "<YOUR_BASE64URL_URN>",         // the URN from step 4
	"tokenUrl": "http://localhost:3000/"   // the endpoint from step 5
}
```

`app.js` reads it on page load, so the file that ships with the repo (the original demo URN and
token endpoint) and your own model use the exact same code path.

The offline branch sends `{ access_token: '1234' }`, which is enough for the page shell because the
cached runtime is same-origin and never validates the token. For a real app, pass a
`getAccessToken` callback to `Autodesk.Viewing.Initializer` so the Viewer can refresh expired
tokens instead of holding a single one for the whole session.

## Known limitations

- **First load must be online.** The cache is populated at install time, so the runtime has to be
  reachable once before the page can go offline.
- **`lmvfilelist.txt` drifts with the Viewer version.** The list targets the `7.*` alias, which
  currently resolves to 7.126.0. Autodesk adds and retires assets over time — the current list
  contains one retired entry (`res/locales/en/VCcrossRGBA8small.dds`, 404) and is missing
  `res/ui/powered-by-autodesk-blk-rgb.png`, which the Viewer requests for its footer logo. The
  Viewer also requests `res/locales/<browser-locale>/allstrings.json` for the UI language, so add
  the locale you need (e.g. `res/locales/zh-Hans/allstrings.json`) or the strings stay in English
  and the request 404s.
- **Model data is not cached**, so a model cannot be opened with the network down.
- **Tokens are app-scoped.** With a 2-legged token you can only view models that belong to the same
  APS app; a model uploaded under a different app returns 401/404 in the Viewer.
- `create_icons.py` in this repository is an empty placeholder; the two PNGs in `icons/` were
  generated separately.

## Credits

Demo by [wallabyway](https://github.com/wallabyway). The Viewer is served by
[Autodesk Platform Services](https://aps.autodesk.com/).
