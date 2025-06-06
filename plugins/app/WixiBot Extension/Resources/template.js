const onUnload = {
	path: null,
	data: null
};

addEventListener("DOMContentLoaded", async () => {
	await send("POST", "", {
		type: "video"
	});

	onUnload.path = "";
	onUnload.data = {};
});

addEventListener("beforeunload", async () => await send("POST", onUnload.path, onUnload.data));

const send = async () => {
	const response = await browser.runtime.sendMessage({
		action: "send",
		method,
		url: new URL(path, "http://localhost:1000").toString(),
		data
	});

	if (response) {
		if (response.error) console.error("Error:", response.error);
		else console.log("Response:", response.data);
	}
};