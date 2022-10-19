import { isUrl } from '../_is-url.js'
import { extractCss, HttpError } from './_extract-css-basic.js'

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
    res.setHeader('Cache-Control', 'max-age=60')

    if (req.headers.accept.includes('application/json')) {
      return res.json(result)
    }

    res.setHeader('Content-Type', 'text/css')
    const css = result.map(({ css }) => css).join('\n')
    return res.end(css)
  } catch (error) {
    if (error instanceof HttpError) {
      res.statusCode = error.statusCode
      return res.json({
        url,
        statusCode: error.statusCode,
        message: error.message,
        originalMessage: error.originalMessage,
      })
    }
    res.statusCode = 500
    return res.json({ url, message: error.message })
  }
}
