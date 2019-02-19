const {ENV} = process.env
const puppeteer = require(ENV && ENV === 'dev' ? 'puppeteer' : 'puppeteer-core')
const chrome = require('chrome-aws-lambda')

async function extractCssWithCoverageFromUrl({url, width, height, userAgent}) {
  // Setup a browser instance
  const browser = await puppeteer.launch({
    args: chrome.args,
    executablePath: await chrome.executablePath,
    headless: true
  })

  // Create a new page and navigate to it
  const page = await browser.newPage()
  await page.setViewport({width, height})
  await page.setUserAgent(userAgent)
  await page.coverage.startCSSCoverage()
  await page.goto(url, {waitUntil: 'networkidle0'})
  const coverage = await page.coverage.stopCSSCoverage()

  let coveredCSS = ''
  for (const entry of coverage) {
    for (const range of entry.ranges) {
      coveredCSS += entry.text.slice(range.start, range.end)
    }
  }

  // Close the browser to close the connection and free up resources
  await browser.close()

  // Turn the coverage into a usable format
  return coveredCSS
}

const devices = {
  m: {
    userAgent:
      'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Mobile Safari/537.36',
    width: 360,
    height: 640
  },
  t: {
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1',
    width: 768,
    height: 1024
  },
  d: {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36',
    width: 1024,
    height: 768
  }
}

module.exports = async (req, res) => {
  // https://critical-css.com/m/https://milanuncios.com

  const device = req.url.slice(1, 2)
  const url = req.url.slice(3)

  try {
    const css = await extractCssWithCoverageFromUrl(
      Object.assign({}, {url}, devices[device])
    )
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/css')
    return res.end(css)
  } catch (error) {
    console.log(error)
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify(error, null, 2))
  }
}
