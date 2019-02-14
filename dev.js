const http = require('http')
const extractCssFromUrl = require('.')

http.createServer(extractCssFromUrl).listen(1337, () => {
	console.log(`Server started at http://localhost:1337`)
})
