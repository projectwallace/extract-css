/* global document */

const puppeteer = require('puppeteer-core')
const chrome = require('chrome-aws-lambda')
const crypto = require('crypto')
const exePath =
	process.platform === 'win32'
		? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
		: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const isDev = process.env.NOW_REGION === 'dev1'

async function getOptions() {
	if (isDev) {
		return {
			args: [],
			executablePath: exePath,
			headless: true
		}
	}

	return {
		args: chrome.args,
		executablePath: await chrome.executablePath,
		headless: chrome.headless
	}
}

function hashString(str) {
	return crypto
		.createHash('md5')
		.update(str, 'utf8')
		.digest('hex')
}

// Keep a locally cached 'page' object so that we
// don't have to request the browser instance to
// create a new one for each request.
let _page

async function getPage() {
	if (_page) {
		return _page
	}

	const options = await getOptions()
	const browser = await puppeteer.launch(options)
	_page = await browser.newPage() // eslint-disable-line
	return _page
}

exports.extractCss = async url => {
	const page = await getPage()

	const response = await page.goto(url, { waitUntil: 'networkidle0' })

	// Make sure that we only try to extract CSS from valid pages.
	// Bail out if the response is an invalid request (400, 500)
	if (response.status() >= 400) {
		return Promise.reject(
			new Error(
				`There was an error retrieving CSS from ${url}.\n\tHTTP status code: ${response.statusCode} (${response.statusText})`
			)
		)
	}

	// Get all CSS generated with the CSSStyleSheet API
	// See: https://developer.mozilla.org/en-US/docs/Web/API/CSSRule/cssText
	const styleSheetsApiCss = await page.evaluate(() => {
		function getCssFromStyleSheet(styleSheet) {
			return [...styleSheet.cssRules]
				.map(cssRule => {
					// Recursively get all stylesheet's cssText in case
					// of an @import rule
					//
					// Using constructor.name here instead of cssRule.type
					// because the spec recommends it:
					// https://drafts.csswg.org/cssom/#dom-cssrule-type
					if (cssRule.constructor.name === 'CSSImportRule') {
						console.log('cssImportRule')
						return [
							cssRule.cssText,
							getCssFromStyleSheet(cssRule.styleSheet)
						].join('\n')
					}

					// If not an @import, use the plain cssText
					return cssRule.cssText
				})
				.join('\n')
		}

		return [...document.styleSheets]
			.map(stylesheet => getCssFromStyleSheet(stylesheet))
			.join('\n')
	})

	// Get all inline styles: <html style="">
	// This creates a new CSSRule for every inline style
	// attribute it encounters.
	//
	// Example:
	//
	// HTML:
	//    <h1 style="color: red; font-size: 10px;">Text</h1>
	//
	// CSSRule:
	//    [x-inline-style-237a7d] {
	//                    ^^^^^^
	//      color: red;
	//      font-size: 10px;
	//    }
	//
	// WARNING! The 6-digit hash is based on the actual CSS,
	//          so it's not necessarily unique!
	const inlineCssRules = await page.evaluate(() => {
		return [...document.querySelectorAll('[style]')].map(element =>
			element.getAttribute('style')
		)
	})

	const inlineCss = inlineCssRules
		// Filter out any empty style attributes
		.filter(Boolean)
		// Make a complete CSSRule for every CSS Rule 'Body' that
		// was found via inline styles, and give it a
		// selector based on the has of it's contents.
		.map(rule => {
			const hash = hashString(rule).slice(-6)
			return `[x-inline-style-${hash}] { ${rule} }`
		})
		.join('\n')

	const css = [styleSheetsApiCss, inlineCss].join('\n')

	return Promise.resolve(css)
}
