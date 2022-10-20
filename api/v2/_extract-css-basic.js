import got from 'got'
import { DOMParser } from 'linkedom'
import _resolveUrl from '@jridgewell/resolve-uri'
import parse from 'css-tree/parser'
import walk from 'css-tree/walker'

// To maintain query params, because resolve-uri strips them
function resolveUrl(url, base) {
  var resolved = _resolveUrl(url, base)

  if (url.includes('?')) {
    var search = url.substring(url.indexOf('?'))
    return resolved + search
  }

  return resolved
}

function getImportUrls(css) {
  var ast = parse(css, {
    parseAtRulePrelude: false,
    parseRulePrelude: false,
    parseValue: false,
    parseCustomProperty: false,
  })
  var urls = []

  walk(ast, function (node) {
    if (node.type === 'Url' && this.atrule?.name === 'import') {
      urls.push(node.value)
    }
  })
  return urls
}

export async function getCssFile(url) {
  try {
    var { body } = await got(url, {
      timeout: 8000
    })
    return body
  } catch (error) {
    console.error(`CSS not found at ${url} (HTTP ${error.response.statusCode})`)
    console.error(error.message)
    return ''
  }
}

function getStyleNodes(html) {
  var document = new DOMParser().parseFromString(html, 'text/html')
  return document.querySelectorAll('link[rel*="stylesheet"][href], style, [style]')
}

export function getStyles(nodes) {
  var items = []

  for (var node of nodes) {
    if (node.nodeName === 'LINK') {
      items.push({
        type: 'link',
        href: node.getAttribute('href'),
        media: node.getAttribute('media'),
        rel: node.getAttribute('rel'),
      })
    }
    if (node.nodeName === 'STYLE') {
      var css = node.textContent
      items.push({
        type: 'style',
        css,
      })
    }
    if (node.hasAttribute('style')) {
      items.push({
        type: 'inline',
        // using :where() to keep specificity 0 (but complexity += 2 here)
        css: `:where([x-inline]) { ${node.getAttribute('style')} }`
      })
    }
  }

  return items
}

export class HttpError extends Error {
  constructor({ url, statusCode, originalMessage }) {
    super()

    if (!Number.isFinite(statusCode)) {
      statusCode = 500
    }
    if (statusCode === 'ENOTFOUND') {
      statusCode = 404
    }

    this.url = url
    this.statusCode = statusCode
    this.message = `The origin server at "${url}" errored with statusCode ${statusCode}`
    this.originalMessage = originalMessage
  }
}

export async function extractCss(url) {
  let body = ''
  let headers = {}

  try {
    var response = await got(url, {
      timeout: 8000
    })
    body = response.body
    headers = response.headers
  } catch (error) {
    console.error('status code', error.response?.statusCode)
    console.error(error)
    throw new HttpError({
      url,
      statusCode: error.response ? error.response.statusCode : error.code,
      originalMessage: error.message
    })
  }

  // Return early if our response was a CSS file already
  if (headers['content-type'].includes('text/css')) {
    return [{
      type: 'file',
      href: url,
      css: body
    }]
  }

  var nodes = getStyleNodes(body)
  var items = getStyles(nodes)
  var result = []

  for (let i = 0; i < items.length; i++) {
    var item = items[i];

    if (item.type === 'link') {
      var fileUrl = resolveUrl(item.href, url)
      var css = await getCssFile(fileUrl)
      result.push({
        ...item,
        css
      })
    }

    if (item.type === 'inline' || item.type === 'style') {
      result.push(item)
    }

    if (item.type === 'style' || item.type === 'link') {
      // Resolve @import CSS 1 level deep (to avoid infinite loops)
      // And c'mon, don't @import inside your @import.
      var importUrls = getImportUrls(item.css)
      if (importUrls.length > 0) {
        var cssRequests = importUrls.map(
          importUrl => getCssFile(resolveUrl(importUrl, url))
        )
        var importedFiles = await Promise.all(cssRequests)
        importedFiles.map((css, index) => {
          result.push({
            type: 'import',
            css,
            href: importUrls[index]
          })
        })
      }
    }
  }

  return result
}
