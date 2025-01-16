// Initialize your Autodesk Viewer here
document.addEventListener('DOMContentLoaded', function() {
	console.log('App initialized, waiting for Autodesk Viewer to load...');
	
	startViewer("dXJuOmFkc2sud2lwcHJvZDpmcy5maWxlOnZmLm1IcnhtVkVsU3NpVVdQcWRmSUVXRXc_dmVyc2lvbj0x");
}); 

const AV = Autodesk.Viewing;
const div = document.getElementById("viewer");

async function startViewer(urn) {
	const token = navigator.onLine ? 
		await (await fetch('https://oorhjg6vpaolxsjfgjdayhu2we0fmddh.lambda-url.us-west-2.on.aws/')).json() : 
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