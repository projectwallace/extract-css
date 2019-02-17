const { ENV } = process.env
const puppeteer = require(ENV && ENV === 'dev' ? 'puppeteer' : 'puppeteer-core')
const chrome = require('chrome-aws-lambda')

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
	return coverage.map(css => css.text).join('')
}

module.exports = async (req, res) => {
	const url = req.url.slice(1)

	try {
		const css = await extractCssWithCoverageFromUrl(url)
		res.statusCode = 200
		res.setHeader('Content-Type', 'text/css')
		return res.end(css)
	} catch (error) {
		res.statusCode = 400
		res.setHeader('Content-Type', 'application/json')
		return res.end(JSON.stringify(error, null, 2))
	}
}
