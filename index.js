const normalizeUrl = require('normalize-url')
const isUrl = require('is-url')
const LRU = require('lru-cache')
const {extractCss} = require('./_chromium')

const cssCache = new LRU({
	max: 500,
	maxAge: 60 * 1000 // 1 minute
})

module.exports = async (req, res) => {
	const url = normalizeUrl(req.url.slice(1), {stripWWW: false})

	if (!isUrl(url)) {
		res.statusCode = 406
		res.setHeader('Content-Type', 'application/json')

		return res.end(
			JSON.stringify({
				message: 'The provided URL is not valid'
			})
		)
	}

	res.setHeader('Content-Type', 'text/css')
	res.statusCode = 200

	if (cssCache.has(url)) {
		return res.end(cssCache.get(url))
	}

	try {
		const css = await extractCss(url)
		cssCache.set(url, css)

		return res.end(css)
	} catch (error) {
		res.statusCode = 500
		res.setHeader('Content-Type', 'application/json')

		return res.end(JSON.stringify(error))
	}
}
