const inquirer = require('inquirer');
const fs = require('fs');
const promisify = require('es6-promisify');
const puppeteer = require('puppeteer');
const validURL = /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i;
const get = promisify(require('request'));
const scssfmt = require('scssfmt');
const cliProgress = require('cli-progress');

const question = {
	name: 'url',
	type: 'input',
	message: 'Enter the URL for the client site:',
	validate: function(input) {
		if (validURL.test(input)) {
			return true;
		} else {
			return 'You must enter a valid URL, including protocol (https/http). Please try again.';
		}
	}
};

async function getinfo() {
	let { url } = await inquirer.prompt(question);
	url = url.trim();
	return url;
}

async function launchBrowser(url) {
	const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
	const page = await browser.newPage();
	const assets = {};
	page.on('request', request => {
		if (!assets[request.resourceType]) {
			assets[request.resourceType] = [];
		}
		assets[request.resourceType].push(request.url);
	});
	await page.goto(`${url}`, { waitUntil: 'networkidle2' });
	assets.inlineStyles = await page.$$eval('style', styleTags =>
		styleTags.map(tag => tag.innerHTML)
	);
	await browser.close();

	return assets;
}

async function getCSS(arrayOfStyleUrls) {
	let requestPromises = arrayOfStyleUrls.map(asset => get(asset));
	let requestResponses = await Promise.all(requestPromises);
	let css = requestResponses.map(response => response.body);
	return css;
}

function bundleCss(clientCssArray, inlineStylesArray) {
	let stylesToPrint = '#injected-header, #injected-footer {';

	clientCssArray.forEach(cssFile => (stylesToPrint = stylesToPrint + cssFile));
	inlineStylesArray.forEach(
		cssFile => (stylesToPrint = stylesToPrint + cssFile)
	);

	stylesToPrint = stylesToPrint + '}';
	return stylesToPrint;
}

async function printCss(bundledCss, progressBar) {
	progressBar.update(95);
	let formattedCss = scssfmt(bundledCss);
	let wstream = fs.createWriteStream('client.scss');
	wstream.on('finish', function() {
		progressBar.update(100);
		progressBar.stop();
		console.log('file has been written');
	});
	wstream.write(formattedCss);
	wstream.end();
}

async function init() {
	const progressBar = new cliProgress.Bar(
		{},
		cliProgress.Presets.shades_classic
	);
	let url = await getinfo().catch(err => console.log(err));
	progressBar.start(100, 0);
	progressBar.update(10);
	let assets = await launchBrowser(url).catch(err => console.log(err));
	progressBar.update(35);
	let clientCss = await getCSS(assets.stylesheet).catch(err => console.log(err));
	progressBar.update(75);
	let bundledCss = bundleCss(clientCss, assets.inlineStyles);
	progressBar.update(85);
	printCss(bundledCss, progressBar);
}

init();
