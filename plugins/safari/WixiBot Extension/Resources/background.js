browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "sendStatus") {
		const xhr = new XMLHttpRequest();
		
		xhr.open(request.method, request.url, true);
		xhr.setRequestHeader("Content-Type", "application/json");
		
		xhr.onreadystatechange = () => {
			if (xhr.readyState === 4) {
				if (xhr.status >= 200 && xhr.status < 300) sendResponse({ data: JSON.parse(xhr.responseText) });
				else sendResponse({ error: xhr.statusText });
			}
		};
		
		xhr.send(JSON.stringify(request.data));
		return true;
	}
});