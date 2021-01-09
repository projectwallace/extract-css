const isUrl = require('is-url')
const normalizeUrl = require('normalize-url')
const LRU = require('lru-cache')
const {extractCss} = require('../src/_chromium')

const cssCache = new LRU({
	max: 500,
	maxAge: 60 * 1000 // 60 seconds
})

module.exports = async (req, res) => {
	const url = normalizeUrl(req.query.url, {stripWWW: false})

	if (!isUrl(url)) {
		res.statusCode = 406

		return res.json({
			message: `The provided URL \`${url}\` is not a valid URL`
		})
	}

	res.statusCode = 200

	if (cssCache.has(url)) {
		const result = cssCache.get(url)

		if (req.headers.accept === 'application/json') {
			return res.json(result)
		}

		res.setHeader('Content-Type', 'text/css')
		const css = result.map(({css}) => css).join('\n')
		return res.end(css)
	}

	try {
		const result = await extractCss(url)
		cssCache.set(url, result)

		if (req.headers.accept === 'application/json') {
			return res.json(result)
		}

		res.setHeader('Content-Type', 'text/css')
		const css = result.map(({css}) => css).join('\n')
		return res.end(css)
	} catch (error) {
		res.statusCode = 500
		return res.json({message: error.message})
	}
}
