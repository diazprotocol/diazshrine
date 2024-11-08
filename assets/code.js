// event listeners
document.addEventListener('DOMContentLoaded', loadHandler);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', autoSetTheme);

// only for partial testing in Chrome and other browsers
// that won't allow SameSite=Strict cookies for local files
var globalColorTheme = "";

// related to gallery and hash changes
var activeTargetID = "";
var galleryIDs = null;
var scrollRestorePosition = null;

function loadHandler() {
	globalColorTheme = getCookieByName("Theme");
	if (globalColorTheme == null) {
		globalColorTheme = "";
	}

	const imgview = document.getElementById("imgview-dual");
	if (imgview != null) {
		const mediaQuery = window.matchMedia('only screen and (max-width: 600px)');
		mediaQuery.addEventListener('change', autoGalleryOverlayMode);
		galleryOverlayReducedWidth = mediaQuery.matches;
		document.addEventListener('keydown', galleryKeyboardFunctions);
		document.getElementById('imgview-image-details').addEventListener("load", hackLimitDetailsHeight);
		window.addEventListener("resize", onWindowResize);
		galleryHashLoadDetection();
		window.addEventListener('hashchange', hashHandler);
	}

	const trivia = document.getElementById("trivia-bit");
	if (trivia != null) {
		rerollTrivia();
	}

	autoSetTheme();
	setLocalTimeInfo();
}

/* common helpers */
function ensureClass(element, className) {
	if (!element.classList.contains(className)) {
		element.classList.add(className);
	}
}

function ensureNoClass(element, className) {
	if (element.classList.contains(className)) {
		element.classList.remove(className);
	}
}

/* menu navigation */
function gotoMenu() {
	const ref = window.location.href;
	if (ref.includes("/menu")) {
		history.back();
	} else {
		window.location.href = '/menu';
	}
}

// --- time ---

function setLocalTimeInfo() {
	const gmtHourMinElems = document.getElementsByClassName("hourMinutesGMT");
	for (var i = 0; i < gmtHourMinElems.length; i++) {
		localizeHourMinutesGMT(gmtHourMinElems[i]);
	}
}

const GMTRegex = /^\s*(\d?\d):(\d\d)\s*(?:GMT|UTC)\s?((?:\+|-)\d?\d)(?::(\d\d))?\s*$/
function localizeHourMinutesGMT(element) {
	if (element.nodeName != "SPAN") {
		console.error("Failed to localize hour/minutes GMT element, expected SPAN node, got '" + element.nodeName + "'");
	}
	const match = element.innerText.match(GMTRegex);
	if (match == null) {
		console.error("Failed to localize GMT span, expected 'HH:MM GMT+/-XX' format, got '" + element.innerText + "'");
	}
	
	var hours = Number(match[1]);
	var mins  = Number(match[2]);
	var offset = Number(match[3])*60;
	if (match.length > 4 && match[4] != undefined) {
		if (offset < 0) {
			offset -= Number(match[4]);
		} else {
			offset += Number(match[4]);
		}
	}

	var finalOffset = -(new Date()).getTimezoneOffset() - offset;
	hours += finalOffset/60;
	mins  += finalOffset%60;
	if (mins  <  0) { hours -= 1; mins += 60 }
	if (mins  > 59) { hours += 1; mins -= 60 }
	if (hours <  0) { hours += 24 }
	if (hours > 23) { hours -= 24 }
	element.title = element.innerText;
	element.classList.add("with-title-tip");
	element.innerText = String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
	
	// note: while AM/PM are not technically "correct" in a 24h clock,
	// adding them removes ambiguity, particularly when times are <12:00.
	if (hours >= 12) {
		element.innerText += " PM";
	} else {
		element.innerText += " AM";
	}
}

// --- color theme ---

function getCookieByName(name) {
	const cookies = document.cookie.split(";");
	for (let cookie of cookies) {
		cookie = cookie.trim();
		if (cookie.startsWith(name + "=")) {
			return cookie.substring(name.length + 1);
		}
	}
	return null;
}

function setThemeCookie(theme) {
	const date = new Date();
   date.setTime(date.getTime() + (365*24*60*60*1000)); // one year expiration
	document.cookie = "Theme=" + theme + "; Expires=" + date.toUTCString() + "; Path=/; SameSite=Strict";
	globalColorTheme = theme;
}

function clearThemeCookie() {
	globalColorTheme = "";
	document.cookie = "Theme=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict";
	autoSetTheme();
}

function autoSetTheme() {
	const root = document.documentElement;
	root.classList.remove('theme-green', 'theme-dark', 'theme-orange');
	document.body.classList.add('notransition'); // disable transitions during theme changes

	switch (globalColorTheme) {
	case '':
	case null:
		if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			root.classList.add('theme-dark');
		}
		break;
	case 'pink':
		// this is the default theme
		break;
	case 'green':
		root.classList.add('theme-green');
		break;
	case 'orange':
		root.classList.add('theme-orange');
		break;
	case 'dark':
		root.classList.add('theme-dark');
		break;
	default:
		console.error("Failed to automatically set theme: requested theme '" + JSON.stringify(globalColorTheme) + "' not recognized.")
	}
	
	updateCookieHint();
	document.body.offsetHeight; // force reflow before removing 'notransition' again
	document.body.classList.remove('notransition');
}

function toggleTheme(event) {
	const root = document.documentElement;
	if (event.shiftKey) {
		if (root.classList.contains('theme-orange')) {
			setThemeCookie("green");
		} else if (root.classList.contains('theme-dark')) {
			setThemeCookie("orange");
		} else if (root.classList.contains('theme-green')) {
			setThemeCookie("pink")
		} else {
			setThemeCookie("dark");
		}
	} else if (event.altKey) {
		clearThemeCookie();
	} else {
		if (root.classList.contains('theme-green')) {
			setThemeCookie("orange");
		} else if (root.classList.contains('theme-orange')) {
			setThemeCookie("dark");
		} else if (root.classList.contains('theme-dark')) {
			setThemeCookie("pink")
		} else {
			setThemeCookie("green");
		}
	}
	
	autoSetTheme();
}

function updateCookieHint() {
	const activeHint   = document.getElementById("if-theme-cookie-is-active");
	const inactiveHint = document.getElementById("if-theme-cookie-is-inactive");
	if (activeHint == null || inactiveHint == null) { return; }

	ensureNoClass(activeHint, "hidden");
	ensureNoClass(inactiveHint, "hidden");
	const theme = getCookieByName("Theme");
	if (theme == null || theme == '') {
		activeHint.classList.add("hidden");
	} else {
		inactiveHint.classList.add("hidden");
	}
}

// --- gallery ---

var galleryEnteredWithHash = false;
function galleryHashLoadDetection() {
	if (window.location.hash != '') {
		galleryEnteredWithHash = true;
		hashHandler();
	}
}

function hashHandler() {
	const target = window.location.hash;
	scrollRestorePosition = window.scrollY;
	
	// empty target (we might be going back)
	if (target == null || target == '' || !target.startsWith("#")) {
		clearActiveTarget();
		return;
	}

	// specific target case
	const sourceElement  = document.getElementById(target + "-source");
	const detailsElement = document.getElementById(target + "-details");
	if (sourceElement == null || detailsElement == null) {
		console.error("failed to locate source or details for '" + target + "'");
		clearActiveTarget();
		return;
	}

	// set up specific target
	const mode = getGalleryOverlayMode();
	const img = document.getElementById("imgview-image-" + mode);
	if (img != null) {
		img.src = fullVersionOfSrc(sourceElement);
	}
	const dl = document.getElementById("imgview-dl-" + mode);
	if (dl != null) {
		dl.innerHTML = detailsElement.innerHTML;
		if (mode == 'details') {
			dl.style.visibility = "hidden";
		}
	}
	const imgview = document.getElementById("imgview-" + mode);
	ensureNoClass(imgview, "hidden");
	imgview.focus();
	document.body.style.overflow = "hidden";
	activeTargetID = target;
	updateImageAspectRatio();

	// preload prev and next images too
	preloadPrev();
	preloadNext();
}

var galleryOverlayPreferDetails = false;
var galleryOverlayPreferCloseUp = false;
var galleryOverlayReducedWidth = false;
function getGalleryOverlayMode() {
	if (galleryOverlayReducedWidth) {
		if (galleryOverlayPreferDetails) {
			return "details";
		}
		return "close-up";
	} else {
		if (galleryOverlayPreferCloseUp) {
			return "close-up";
		} else {
			return "dual";
		}
	}
}

function fullVersionOfSrc(imgElement) {
	var src = imgElement.src;
	if (!src.includes("/mini/")) {
		return src;
	}
	src = src.replace("/mini/", "/full/");
	if (imgElement.dataset.ffmt != undefined && imgElement.dataset.ffmt != "") {
		src = src.replace(".webp", "." + imgElement.dataset.ffmt);
	}
	return src;
}

function onWindowResize() {
	updateImageAspectRatio();
	hackLimitDetailsHeightOnResize();
}

function hackLimitDetailsHeightOnResize() {
	if (activeTargetID != "" && getGalleryOverlayMode() == "details") {
		hackLimitDetailsHeight();
	}
}

// function to dynamically limit the height of the image details
// in the "details" mode and force a scroll bar to appear.
function hackLimitDetailsHeight() {
	const availableSpace = document.getElementById('imgview-image-details').offsetHeight;
	const details = document.getElementById('imgview-dl-details');
	const requiredSpace = details.scrollHeight;
	if (requiredSpace + 16 < availableSpace) {
		const margin = Math.floor((availableSpace - requiredSpace)/2);
		details.style.top = JSON.stringify(margin) + "px";
		details.style.maxHeight = "none"; // is "none" better than "100%"?
		details.style.visibility = "visible";
	} else {
		details.style.top = "0";
		details.style.maxHeight = JSON.stringify(availableSpace - 16) + "px";
		details.style.visibility = "visible";
	}
}

function updateImageAspectRatio() {
	if (activeTargetID == "") { return; }
	const mode = getGalleryOverlayMode();
	if (mode == "dual") { return; }
	// document.body.offsetHeight; // force reflow (probably not necessary)

	// get source image aspect ratio
	const sourceElement = document.getElementById(activeTargetID + "-source");
	const srcAspectRatio = sourceElement.naturalWidth/sourceElement.naturalHeight;
	
	// IMPORTANT: this section contains CSS-related hardcoding of values
	var imgElem;
	if (mode == "close-up") {
		imgElem = document.getElementById('imgview-image-close-up');
	} else { // (mode == "details")
		imgElem = document.getElementById('imgview-image-details');
	}

	// on reduced width, the html/css is too tricky to expand images
	// with the details overlay and so on, and the screen should be
	// small enough that images are fine as they are, so we just stop
	// caring about expand-vert/expand-horz adjustments
	if (galleryOverlayReducedWidth) {
		ensureNoClass(imgElem, "expand-vert");
		ensureNoClass(imgElem, "expand-horz");
		ensureNoClass(imgElem, "fullsize");
		return;
	}
	
	// apply fullsize class on wide close up mode
	ensureClass(document.getElementById('close-up-fullsize'), "fullsize");

	// compare aspect ratios to set the appropriate img css class
	const imgDiv = imgElem.parentElement;
	var viewportAspectRatio = (imgDiv.offsetWidth - 20)/(imgDiv.offsetHeight - 72);
	if (viewportAspectRatio < srcAspectRatio) {
		ensureNoClass(imgElem, "expand-vert");
		ensureClass(imgElem, "expand-horz");
	} else {
		ensureNoClass(imgElem, "expand-horz");
		ensureClass(imgElem, "expand-vert");
	}
}

var activelyClickedIntoTarget = false;
function clearActiveTarget() {
	if (activeTargetID != "") {
		const modes = ['dual', 'close-up', 'details'];
		for (var i = 0; i < modes.length; i++) {
			const element = document.getElementById('imgview-' + modes[i]);
			ensureClass(element, 'hidden');
		}
		activeTargetID = "";
		
		if (galleryEnteredWithHash) {
			galleryEnteredWithHash = false;
			history.replaceState(null, null, window.location.pathname);
		} else {
			history.back();
		}
	}
	document.body.style.overflow = '';
	if (scrollRestorePosition != null) {
		window.scrollTo(0, scrollRestorePosition);
		scrollRestorePosition = null;
	}
}

function galleryPrevImage() {
	activeTargetID = getPrevImageID();
	history.replaceState(null, null, activeTargetID);
	hashHandler();
}

function preloadPrev() {
	preloadImgByID(getPrevImageID());
}

function getPrevImageID() {
	ensureGalleryListInitialized();
	const index = galleryIDs.indexOf(activeTargetID);
	if (index == -1) {
		console.error("current target '" + activeTargetID + "' not found");
	}
	var prevIndex = index - 1;
	if (prevIndex < 0) {
		prevIndex = galleryIDs.length - 1;
	}
	return galleryIDs[prevIndex];
}

function galleryNextImage() {
	activeTargetID = getNextImageID();
	history.replaceState(null, null, activeTargetID);
	hashHandler();
}

function preloadNext() {
	preloadImgByID(getNextImageID());
}

function getNextImageID() {
	ensureGalleryListInitialized();
	const index = galleryIDs.indexOf(activeTargetID);
	if (index == -1) {
		console.error("current target '" + activeTargetID + "' not found");
	}
	var nextIndex = index + 1;
	if (nextIndex >= galleryIDs.length) {
		nextIndex = 0;
	}
	return galleryIDs[nextIndex];
}

function preloadImgByID(id) {
	const img = document.getElementById(id + "-source");
	const preloadImage = new Image();
	preloadImage.src = fullVersionOfSrc(img);
}

function backToGallery() {
	clearActiveTarget();
}

// can only be called from dual mode
function galleryToCloseUpMode() {
	galleryOverlayPreferCloseUp = true;
	galleryOverlayPreferDetails = false;
	document.getElementById("imgview-dual").classList.add("hidden");
	hashHandler();
}

function galleryLeaveDetailsMode() {
	galleryOverlayPreferDetails = false;
	document.getElementById("imgview-details").classList.add("hidden");
	hashHandler();
}

function galleryLeaveCloseUpMode() {
	galleryOverlayPreferCloseUp = false;
	if (galleryOverlayReducedWidth) {
		galleryOverlayPreferDetails = true;
	}
	
	document.getElementById("imgview-close-up").classList.add("hidden");
	hashHandler();
}

function ensureGalleryListInitialized() {
	if (galleryIDs != null) { return; }
	galleryIDs = [];
	const gallery = document.getElementById("gallery");
	if (gallery == null) { return; }

	for (var i = 0; i < gallery.children.length; i++) {
		var divChild = gallery.children[i];
		if (divChild.nodeName == "DIV") {
			for (var j = 0; j < divChild.children.length; j++) {
				var aChild = divChild.children[j];
				if (aChild.nodeName == "A" && aChild.getAttribute("href").startsWith("#")) {
					galleryIDs.push(aChild.getAttribute("href"))
				}
			}
		}
	}
}

function galleryKeyboardFunctions(event) {
	// special keys
	if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) { return; }

	// regular logic
	if (activeTargetID == "") { return; }
	if (event.key == 'Escape' || event.key == 'Backspace') {
		clearActiveTarget();
	} else if (event.key == 'ArrowLeft') {
		galleryPrevImage();
	} else if (event.key == 'ArrowRight') {
		galleryNextImage();
	} else if (event.key == 'f' || event.key == 'F' || event.key == 'i' || event.key == 'I') {
		if (galleryOverlayReducedWidth) {
			if (galleryOverlayPreferDetails) {
				galleryLeaveDetailsMode();
			} else if (galleryOverlayPreferCloseUp) {
				galleryLeaveCloseUpMode();
			} else {
				galleryLeaveCloseUpMode();
			}
		} else {
			if (galleryOverlayPreferCloseUp) {
				galleryLeaveCloseUpMode();
			} else {
				galleryToCloseUpMode();
			}
		}
	}
}

function autoGalleryOverlayMode(event) {
	if (event.matches) {
		galleryOverlayReducedWidth = true;
	} else {
		galleryOverlayReducedWidth = false;
	}

	const modes = ['dual', 'close-up', 'details'];
	for (var i = 0; i < modes.length; i++) {
		const imgview = document.getElementById('imgview-' + modes[i]);
		ensureClass(imgview, 'hidden');
	}
	hashHandler();
}

/* trivia */

var triviaIndex = 0;
var triviaOrder = null;
function rerollTrivia() {
	const trivia = document.getElementById("trivia-bit");
	if (trivia == null) { return; }
	const facts = document.getElementById("trivia-facts");
	if (facts == null || facts.children.length === 0) { return; }

	if (triviaOrder == null) {
		triviaOrder = [];
		for (var i = 0; i < facts.children.length; i++) {
			triviaOrder.push(i);
		}
		shuffle(triviaOrder);
	}
	
	trivia.innerHTML = facts.children[triviaOrder[triviaIndex]].innerHTML;
	triviaIndex = (triviaIndex + 1) % triviaOrder.length;
}

/* quiz */
const fadeTransitionTime = 500;
var quizStage = 0;
var score = 0;
var quizPerfects = 0;
function quizNext(event) {
	const div = event.target.parentNode.parentNode;
	if (div.classList.contains("fading-out")) { return; }
	if (div.classList.contains("fading-in" )) { return; }

	if (quizStage == 0) {
		ensureClass(div, "transitioner");
		
		const questionNode = document.getElementById("question");
		ensureNoClass(questionNode, "awaiting");
		ensureClass(questionNode, "transitioner");
		ensureClass(questionNode, "fading-out");
		score = 0;
	} else if (quizStage == 11) {
		if (score == 10) {
			quizPerfects = Math.min(quizPerfects + 1, 2);
		} else {
			quizPerfects = 0;
		}
		score = 0;
		quizStage = 0;
	} else {
		var a = quizIDToArray(quizQuestions[quizStage - 1]);
		var b = quizIDToArray(event.target.parentNode.dataset.answer);
		if (quizEvalPositive(a, b)) { score += 1 }

		if (quizStage == 10) {
			const resultsNode = document.getElementById("results");
			ensureClass(resultsNode, "transitioner");
			ensureClass(resultsNode, "fading-out");
		}
	}

	ensureClass(div, "transitioner");
	ensureClass(div, "fading-out");
	setTimeout(quizNextFadeIn, fadeTransitionTime);
}

function quizNextFadeIn() {
	if (quizStage == 0) {
		// set up whole quiz
		const startNode = document.getElementById("start");
		ensureClass(startNode, "hidden");
		ensureNoClass(startNode, "transitioner");
		ensureNoClass(startNode, "fading-out");
		const resultsNode = document.getElementById("results");
		ensureClass(resultsNode, "awaiting");
		ensureNoClass(resultsNode, "transitioner");
		ensureNoClass(resultsNode, "fading-out");
		quizPrepareQuestions();
		quizSetupNext();
	} else if (quizStage == 10) {
		// ensure question main div is hidden
		const questionNode = document.getElementById("question");
		ensureClass(questionNode, "awaiting");
		
		// configure results content
		document.getElementById("results-title").textContent = "Quiz results: "+ score + "/10";
		var rank = score;
		if (quizPerfects > 0) {
			rank = 10 + quizPerfects;
		}
		for (var i = 0; i < 13; i++) {
			const analysis = document.getElementById("result-" + i);
			if (i == rank) {
				ensureNoClass(analysis, "hidden");
			} else {
				ensureClass(analysis, "hidden");
			}
		}

		// go to results
		const resultsNode = document.getElementById("results");
		ensureNoClass(resultsNode, "awaiting");
		ensureNoClass(resultsNode, "fading-out");
		ensureClass(resultsNode, "transitioner");
		ensureClass(resultsNode, "fading-in");
		setTimeout(function() {
			ensureNoClass(resultsNode, "fading-in");
			ensureNoClass(resultsNode, "transitioner");
		}, fadeTransitionTime);
	} else {
		// advance quiz
		quizSetupNext();
	}
	quizStage += 1
}

var quizQuestions = [];
function quizPrepareQuestions() {
	const questions = document.getElementById("quiz-questions");
	if (questions == null) {
		console.error("Failed to load quiz questions.");
		return;
	}
	
	quizQuestions = [];
	for (var i = 0; i < questions.children.length; i++) {
		const div = questions.children[i];
		quizQuestions.push(div.id);
	}
	shuffle(quizQuestions);
	quizQuestions = quizQuestions.slice(0, 10);
}

function quizSetupNext() {
	// main question div has no hidden class, but opacity is 0
	const questionID = quizQuestions[quizStage];
	const nextQuestionDIV = document.getElementById(questionID);
	quizAddButtonOnClickListeners(nextQuestionDIV);
	const mainDIV = document.getElementById("question");
	
	// adjust main question div content programmatically
	mainDIV.innerHTML = nextQuestionDIV.innerHTML;	
	var hDiv = document.createElement("DIV");
	hDiv.style.display = "flex";
	hDiv.style.justifyContent = "space-between";
	hDiv.style.margin = "0";
	hDiv.style.padding = "0";
	var h2 = document.createElement("H2");
	h2.textContent = "Question " + String(quizStage + 1) + " / 10";
	hDiv.appendChild(h2);
	var h2pts = document.createElement("H2");
	h2pts.textContent = String(score) + " / " + String(quizStage);
	hDiv.appendChild(h2pts);
	mainDIV.insertBefore(hDiv, mainDIV.children[0]);

	if (nextQuestionDIV.dataset.shuffle == "yes") {
		quizShuffleButtons(mainDIV);
	}

	// adjust main question div classes
	ensureNoClass(mainDIV, "awaiting");
	ensureNoClass(mainDIV, "fading-out");
	ensureClass(mainDIV, "transitioner");
	ensureClass(mainDIV, "fading-in");

	// clear transition classes after a while
	setTimeout(function() {
		ensureNoClass(mainDIV, "fading-in");
		ensureNoClass(mainDIV, "transitioner");
	}, fadeTransitionTime);
}

function quizShuffleButtons(element) {
	var buttonIndices = [];
	for (var i = 0; i < element.children.length; i++) {
		const node = element.children[i];
		if (node.nodeName == "DIV" && node.children.length == 1 && node.children[0].nodeName == "BUTTON") {
			buttonIndices.push(i);
		}
	}

	var prevA = -1;
	var prevB = -1;
	for (var i = 0; i < 8; i++) {
		const indexA = Math.floor(Math.random()*buttonIndices.length);
		const indexB = Math.floor(Math.random()*buttonIndices.length);
		if (indexA != indexB && (prevA != indexB || prevB != indexA)) {
			const childIndexA = buttonIndices[indexA];
			const childIndexB = buttonIndices[indexB];
			swapNodes(element, element.children[childIndexA], element.children[childIndexB]);
			prevA = indexA;
			prevB = indexB;
		}
	}
}

function swapNodes(parent, nodeA, nodeB) {
	var temp = document.createElement("div");
	parent.insertBefore(temp, nodeA);
	parent.insertBefore(nodeA, nodeB);
	parent.insertBefore(nodeB, temp);
	parent.removeChild(temp);
}

function quizAddButtonOnClickListeners(element) {
	for (var i = 0; i < element.children.length; i++) {
		const node = element.children[i];
		if (node.nodeName == "BUTTON") {
			if (!node.hasAttribute("onclick")) {
				node.setAttribute("onclick", "quizNext(event);");
			}
		} else if (node.nodeName == "DIV") {
			quizAddButtonOnClickListeners(node);
		}
	}
}

function shuffle(array) {
	for (var i = array.length - 1; i > 0; i--) { 
		const j = Math.floor(Math.random() * (i + 1)); 
		[array[i], array[j]] = [array[j], array[i]];
	} 
}

function quizGenIDs() {
	const id = crypto.getRandomValues(new Uint8Array(3));
	var positives = 0;
	var negatives = 0;
	console.log("id: " + quizUint8ArrayToID(id));
	while (positives < 8 || negatives < 8) {
		const bytes = crypto.getRandomValues(new Uint8Array(3));
		const key = quizUint8ArrayToID(bytes);
		if (quizEvalPositive(id, bytes)) {
			console.log(key + " is positive");
			positives += 1
		} else {
			console.log(key + " is negative");
			negatives += 1
		}
	}
	console.log("total: " + positives + " positives, " + negatives + " negatives");
}

function quizIDToArray(value) {
	var array = [];
	array.push(hexDigitToInt(value[0])*16 + hexDigitToInt(value[1]));
	array.push(hexDigitToInt(value[2])*16 + hexDigitToInt(value[3]));
	array.push(hexDigitToInt(value[4])*16 + hexDigitToInt(value[5]));
	return array;
}

function hexDigitToInt(hex) {
	const code = hex.charCodeAt();
	if (code <= 57) { return code - 48; }
	if (code >= 96) { return code - 87; }
	return code - 55;
}

function quizUint8ArrayToID(key) {
	var str = "";
	for (var i = 0; i < 3; i++) {
		str += key[i].toString(16).padStart(2, '0').toUpperCase();
	}
	return str;
}

function quizEvalPositive(id, key) {
	var ones = 0
	for (var i = 0; i < 3; i++) {
		ones += uint8Ones(id[i]^key[i])
	}
	return (ones % 2 == 1);
}

function uint8Ones(value) {
	var count = 0;
	for (var i = 0; i < 8; i++) {
		if (value & 1 != 0) { count += 1; }
		value >>= 1;
	}
	return count;
}

