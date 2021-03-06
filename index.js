#!/usr/bin/env node

// ^To tell bash that this is node, not... bash.

const inquirer = require('inquirer');
const promisify = require('es6-promisify');
const fs = require('fs');
const readdir = promisify(fs.readdir);
const puppeteer = require('puppeteer');
const validURL = /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i;
const get = promisify(require('request'));
const scssfmt = require('scssfmt');
const cliProgress = require('cli-progress');
const { resolve } = require('path');

async function checkLocation() {
	const location = process.cwd();
	const files = await readdir(location);
	let inOBroot = files.includes('client');
	let confirmation = false;
	if (inOBroot) {
		//if we're in the root of an onbrand project...
		const question = {
			name: 'cont',
			type: 'confirm',
			message:
				'This will attempt to grab the css from a site and write it to a file in your "client" folder. This will overwrite your client.scss. Do you wish to continue?'
		};
		const { cont } = await inquirer.prompt(question);
		confirmation = cont;
	} else {
		console.log(
			'\x1b[31m',
			`It looks like we're not in an onbrand project, I don't see a "client" folder...`
		);
		console.log('\x1b[0m', `Double check your cwd and try again.`);
	}
	if (!confirmation) {
		console.warn('\x1b[33m', 'quiting', '\x1b[0m');
		process.exit(); //Kill it!
		return false;
	} else {
		return true;
	}
}

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

/**
 * Causes a command line prompt to get the url target from the user
 *
 * @returns  {String} url including protocol
 */
async function getinfo() {
	let { url } = await inquirer.prompt(question);
	url = url.trim();
	return url;
}

/**
 * Launches a headless browser, navigates to the provided url, and logs the assets the page requests.
 *
 * @param {String} url
 * @returns {Object} contains urls for all assets requested by the browser
 */
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

/**
 * loops over an array of url strings and grabs the css hosted at the url.
 *
 * @param {Array} an array containing url strings, each pointing to a style sheet we want to steal
 * @returns {Array} Array of strings, each a css file
 */
async function getCSS(arrayOfStyleUrls) {
	if (arrayOfStyleUrls) {
		let requestPromises = arrayOfStyleUrls.map(asset => get(asset));
		let requestResponses = await Promise.all(requestPromises);
		let css = requestResponses.map(response => response.body);
		return css;
	} else {
		console.log('');
		console.warn(
			"No refferences to external styles detected... Maybe they're all inline?"
		);
		return [];
	}
}

/**
 * concats all css files into one string, adds the namespace we normally use.
 *
 * @param {Array} array of strings, each a css file
 * @param {Array} array of strings, each an inline css block
 * @returns
 */
function bundleCss(clientCssArray, inlineStylesArray) {
	let stylesToPrint =
		'/* Beep-Boop: \n * Note: This sheet was generated by the onbrand asset stealer \n * Please report any bugs! Thanks! Boop. \n */ \n #injected-header, #injected-footer {';

	clientCssArray.forEach(cssFile => (stylesToPrint = stylesToPrint + cssFile));
	inlineStylesArray.forEach(
		cssFile => (stylesToPrint = stylesToPrint + cssFile)
	);

	stylesToPrint = stylesToPrint + '}';
	return stylesToPrint;
}

/**
 * Writes the css to a file
 *
 * @param {String} bundled Css
 * @param {progressBar} progressBar  object
 */
async function printCss(bundledCss, progressBar) {
	progressBar.update(95);
	let formattedCss = scssfmt(bundledCss);
	let wstream = fs.createWriteStream(resolve('client', 'client.scss'));
	wstream.on('finish', function() {
		progressBar.update(100);
		progressBar.stop();
		console.log('file has been written');
	});
	wstream.write(formattedCss);
	wstream.end();
}

/**
 * logs the error and kills the node process
 *
 * @param {Error} err
 * @param {String} errorLocation
 */
function logError(err, errorLocation) {
	console.log('-----------------------------');
	console.log(err);
	console.log('-----------------------------');
	console.error(`Error at: ${errorLocation}`);
	process.exit(); //Kill it!
}

async function init() {
	let confirmation = await checkLocation().catch(err =>
		logError(err, 'checkLocation')
	);
	if (confirmation) {
		const progressBar = new cliProgress.Bar(
			{},
			cliProgress.Presets.shades_classic
		);
		let url = await getinfo().catch(err => logError(err, 'getInfo'));
		progressBar.start(100, 0);
		progressBar.update(10);
		let assets = await launchBrowser(url).catch(err =>
			logError(err, 'launchBrowser')
		);
		progressBar.update(35);
		let clientCss = await getCSS(assets.stylesheet).catch(err =>
			logError(err, 'getCss')
		);
		progressBar.update(75);
		let bundledCss = bundleCss(clientCss, assets.inlineStyles);
		progressBar.update(85);
		printCss(bundledCss, progressBar);
	}
}

init();
