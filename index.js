const got = require('got')
const extractCss = require('./extract-css')

module.exports = async (req, res) => {
	const url = req.url.slice(1)

	try {
		const css = url.endsWith('.css')
			? (await got(url)).body
			: await extractCss(url)
		res.statusCode = 200
		res.setHeader('Content-Type', 'text/css')
		return res.end(css)
	} catch (error) {
		res.statusCode = 400
		res.setHeader('Content-Type', 'application/json')
		return res.end(JSON.stringify(error, null, 2))
	}
}
