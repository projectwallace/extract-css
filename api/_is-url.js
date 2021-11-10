// Source: https://github.com/segmentio/is-url/blob/d20482833e861b9a0c5bb3712dfe232efa75c87c/index.js
// but without checking for localhost
var protocolAndDomainRE = /^(?:\w+:)?\/\/(\S+)$/
var nonLocalhostDomainRE = /^[^\s.]+\.\S{2,}$/

export function isUrl(string) {
	if (typeof string !== 'string') {
		return false
	}

	var match = string.match(protocolAndDomainRE)
	if (!match) {
		return false
	}

	var everythingAfterProtocol = match[1]
	if (!everythingAfterProtocol) {
		return false
	}

	if (nonLocalhostDomainRE.test(everythingAfterProtocol)) {
		return true
	}

	return false
}
