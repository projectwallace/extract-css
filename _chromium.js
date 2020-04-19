/* global document */

const puppeteer = require('puppeteer-core')
const chrome = require('chrome-aws-lambda')
const exePath =
	process.platform === 'win32' ?
		'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' :
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

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

exports.extractCss = async url => {
	const options = await getOptions()
	const browser = await puppeteer.launch(options)
	const page = await browser.newPage()

	// Start CSS coverage. This is the meat and bones of this module
	await page.coverage.startCSSCoverage().catch(() => {})

	const response = await page.goto(url, {waitUntil: 'networkidle0'})

	// Make sure that we only try to extract CSS from valid pages.
	// Bail out if the response is an invalid request (400, 500)
	if (response.status() >= 400) {
		return Promise.reject(
			new Error(
				`There was an error retrieving CSS from ${url}.\n\tHTTP status code: ${response.statusCode} (${response.statusText})`
			)
		)
	}

	// If the response is a CSS file, return that file
	// instead of running our complicated setup
	const headers = response.headers()

	if (headers['content-type'].includes('text/css')) {
		const css = await response.text()

		return Promise.resolve([
			{
				type: 'file',
				href: url,
				css
			}
		])
	}

	// Coverage contains a lot of <style> and <link> CSS,
	// but not all...
	const coverage = await page.coverage.stopCSSCoverage()

	// Get all CSS generated with the CSSStyleSheet API
	// This is primarily for CSS-in-JS solutions
	// See: https://developer.mozilla.org/en-US/docs/Web/API/CSSRule/cssText
	const styleSheetsApiCss = await page.evaluate(() => {
		return [...document.styleSheets]
			// Only take the stylesheets without href (these are <style> tags)
			.filter(stylesheet => stylesheet.href === null)
			.map(stylesheet => {
				return {
					type: stylesheet.ownerNode.tagName.toLowerCase(),
					href: stylesheet.href || document.location.href,
					css: [...stylesheet.cssRules].map(({cssText}) => cssText).join('\n')
				}
			})
	})

	// Get all inline styles: <element style="">
	// This creates a new CSSRule for every inline style
	// attribute it encounters.
	//
	// Example:
	//
	// ```html
	// <h1 style="color: red;">Text</h1>
	// ```
	//
	// ```css
	// [x-extract-css-inline-style] {
	//   color: red;
	// }
	// ```
	const inlineCssRules = await page.evaluate(() => {
		return [...document.querySelectorAll('[style]')]
			.map(element => element.getAttribute('style'))
			// Filter out empty style="" attributes
			.filter(Boolean)
	})
	const inlineCss = inlineCssRules
		.map(rule => `[x-extract-css-inline-style] { ${rule} }`)
		.map(css => ({type: 'inline', href: url, css}))

	const links = coverage
		// Filter out the <style> tags that were found in the coverage
		// report since we've conducted our own search for them.
		// A coverage CSS item with the same url as the url of the page
		// we requested is an indication that this was a <style> tag
		.filter(entry => entry.url !== url)
		.map(entry => ({
			href: entry.url,
			css: entry.text,
			type: 'link-or-import'
		}))

	const css = links
		.concat(styleSheetsApiCss)
		.concat(inlineCss)

	return Promise.resolve(css)
}
