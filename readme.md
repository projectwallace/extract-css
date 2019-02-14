<div align="center">
	<h1>Extract CSS</h1>
	<p>Get all the CSS from a webpage.</p>
</div>

[![Platform: Now V2](https://img.shields.io/badge/platform-Now%20V2-50e3c2.svg)](https://zeit.co/now)

## The problem

The folks from [CSS Stats](https://cssstats.com/) have created [get-css](https://github.com/cssstats/cssstats/tree/master/packages/get-css), a package to get all the CSS from a given webpage. One downside, however, is that it only works for server side rendered applications.

## The solution

This package uses an actual browser under the hood to get all the CSS and exposes an HTTP endpoint that accepts a url to get the CSS from.

## Local testing

I have no idea how local testing for Now is supposed to work, so I created a tiny HTTP server in `dev.js` that calls the actual function that gets deployed.
Run `npm run dev` to run a local version of the function for local testing.

## Deployment

Using [Now](https://zeit.co/now): `now`.

## Credits

- This repo is pretty much an exact copy of [this example from Zeit](https://github.com/zeit/now-examples/tree/master/puppeteer-screenshot).
- The idea to get all the CSS from a webpage comes from [CSS Stats](https://github.com/cssstats/cssstats)
