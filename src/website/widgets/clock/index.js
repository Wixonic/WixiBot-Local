const update = () => {
	const now = new Date();
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	document.body.textContent = `${hours}:${minutes}`;
};

addEventListener("DOMContentLoaded", () => {
	update();
	setInterval(update, 1000);
});