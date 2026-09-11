// The model URN and the token endpoint live in config.json, so pointing the demo
// at your own model doesn't require touching this file.
const CONFIG_URL = 'config.json';

// Initialize your Autodesk Viewer here
document.addEventListener('DOMContentLoaded', async function() {
	console.log('App initialized, waiting for Autodesk Viewer to load...');

	try {
		const config = await (await fetch(CONFIG_URL)).json();
		startViewer(config.urn, config.tokenUrl);
	} catch (err) {
		console.error(`Could not load ${CONFIG_URL} -- fill in your own URN and token endpoint there.`, err);
	}
});

const AV = Autodesk.Viewing;
const div = document.getElementById("viewer");

async function startViewer(urn, tokenUrl) {
	const token = navigator.onLine ?
		await (await fetch(tokenUrl)).json() :
		{ access_token: '1234' };

	try {
		// Always try to initialize viewer, regardless of token status
		await new Promise((resolve) => {
			Autodesk.Viewing.Initializer({ 
				env: "AutodeskProduction2", 
				api: 'streamingV2', 
				accessToken: token.access_token
			}, function() {
				console.log('Viewer initialized with token');
				resolve();
			}, function(error) {
				console.warn('Viewer initialization warning:', error);
				resolve(); // Continue even if there's an initialization warning
			});
		});
		
		const options = { 
			extensions: ["Autodesk.SmartSection"]
		};
		
		const viewer = new AV.Private.GuiViewer3D(div, options);
		viewer.start();
		viewer.setTheme("light-theme");
		
		const doc = await new Promise((resolve, reject) => {
			AV.Document.load(`urn:${urn}`, resolve, reject);
		});
		
		const viewables = doc.getRoot().getDefaultGeometry();
		await viewer.loadDocumentNode(doc, viewables);
		console.log('Model loaded successfully');
	} catch (error) {
		console.error('Error loading model:', error);
	}
}