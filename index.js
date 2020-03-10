const normalizeUrl = require('normalize-url')
const isUrl = require('is-url')
const LRU = require('lru-cache')
const {extractCss} = require('./_chromium')

const cssCache = new LRU({
	max: 500,
	maxAge: 3 * 60 * 1000 // 3 minutes
})

module.exports = async (req, res) => {
	const url = normalizeUrl(req.url.slice(1), {stripWWW: false})

	if (!isUrl(url)) {
		res.statusCode = 406
		res.setHeader('Content-Type', 'application/json')

		return res.send({
			message: 'The provided URL is not valid'
		})
	}

	res.statusCode = 200

	if (cssCache.has(url)) {
		const result = cssCache.get(url)

		if (req.headers.accept === 'application/json') {
			res.setHeader('Content-Type', 'application/json')
			return res.send(result)
		}

		res.setHeader('Content-Type', 'text/css')
		const css = result.map(({css}) => css).join('\n')
		return res.end(css)
	}

	try {
		const result = await extractCss(url)
		cssCache.set(url, result)

		if (req.headers.accept === 'application/json') {
			res.setHeader('Content-Type', 'application/json')
			return res.send(result)
		}

		res.setHeader('Content-Type', 'text/css')
		const css = result.map(({css}) => css).join('\n')
		return res.end(css)
	} catch (error) {
		res.statusCode = 500
		res.setHeader('Content-Type', 'application/json')
		return res.send({message: error.message})
	}
}
