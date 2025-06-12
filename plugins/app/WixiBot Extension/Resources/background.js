browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "send") {
		const xhr = new XMLHttpRequest();

		xhr.open(request.method, request.url, true);
		xhr.setRequestHeader("Content-Type", "application/json");

		xhr.addEventListener("readystatechange", () => {
			if (xhr.readyState === 4) {
				if (xhr.status >= 200 && xhr.status < 300) sendResponse({ data: "Sent" });
				else sendResponse({ error: xhr.statusText || `HTTP ${xhr.status}` });
			}
		});

		xhr.addEventListener("error", () => sendResponse({ error: "Network Error" }));
		xhr.addEventListener("timeout", () => sendResponse({ error: "Request Timeout" }));

		try {
			xhr.send(JSON.stringify(request.data));
		} catch (e) {
			sendResponse({ error: e.message });
		}

		return true;
	}
});
