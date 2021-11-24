import LRU from 'lru-cache'
import {extractCss} from './_chromium.js'
import {isUrl} from './_is-url.js'

const cssCache = new LRU({
	max: 1000,
	maxAge: 60 * 1000 // 60 seconds
})

export default async (req, res) => {
	const {url} = req.query

	if (!isUrl(url)) {
		res.statusCode = 400

		return res.send({
			message: `The provided URL \`${url}\` is not valid`
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
