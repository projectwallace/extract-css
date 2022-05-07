import { extractCss } from './_chromium.js'
import { isUrl } from './_is-url.js'

export default async (req, res) => {
	const { url } = req.query

	if (!isUrl(url)) {
		res.statusCode = 400

		return res.send({
			message: `The provided URL \`${url}\` is not valid`
		})
	}

	try {
		const result = await extractCss(url)

		res.statusCode = 200

		if (req.headers.accept === 'application/json') {
			return res.json(result)
		}

		res.setHeader('Content-Type', 'text/css')
		const css = result.map(({ css }) => css).join('\n')
		return res.end(css)
	} catch (error) {
		res.statusCode = 500
		return res.json({ message: error.message })
	}
}
