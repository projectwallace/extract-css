const { ENV } = process.env
const puppeteer = require(ENV && ENV === 'dev' ? 'puppeteer' : 'puppeteer-core')
const chrome = require('chrome-aws-lambda')
const { parse } = require('url')

async function extractCssWithCoverageFromUrl(requestUrl) {
	// Setup a browser instance
	const browser = await puppeteer.launch({
		args: chrome.args,
		executablePath: await chrome.executablePath,
		headless: true
	})

	// Create a new page and navigate to it
	const page = await browser.newPage()
	await page.coverage.startCSSCoverage()
	await page.goto(requestUrl)
	const coverage = await page.coverage.stopCSSCoverage()

	// Close the browser to close the connection and free up resources
	await browser.close()

	// Turn the coverage into a usable format
	return coverage.reduce(
		(totals, { text: css, url }) => {
			totals.css += css

			// Url === requestUrl if the styles are a <style>
			// block, <link>s have their own dedicated url
			if (url.includes(requestUrl)) {
				totals.styles.push(css)
			}

			if (!url.includes(requestUrl)) {
				totals.links.push({ url, css })
			}

			return totals
		},
		{ links: [], styles: [], css: '' }
	)
}

function json(obj) {
	return JSON.stringify(obj, null, 2)
}

module.exports = async (req, res) => {
	const url = req.url.slice(1)

	res.setHeader('Content-Type', 'application/json')

	try {
		const css = await extractCssWithCoverageFromUrl(url)
		res.statusCode = 200
		return res.end(json(css))
	} catch (error) {
		res.statusCode = 400
		return res.end(json(error))
	}
}
