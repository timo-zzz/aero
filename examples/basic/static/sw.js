'use strict';

// Don't wait for the old service workers
self.addEventListener('install', () => self.skipWaiting());

// Use the service worker immediately instead of after reload.
self.addEventListener('activate', event => event.waitUntil(clients.claim()));

var ctx = {
	http: {
		prefix: '/http/'
	},
	ws: {
		prefix: '/ws/'
	},
	scope: false
}

// Set the server ctx.
self.addEventListener('message', event => {
	console.log(event);
	ctx = event.data;
});

self.gel = `
	WebSocket = new Proxy(WebSocket, {
		construct(target, args) {
			args[0] = location.origin + ctx.ws.prefix + args[0];
			alert(args[0]);
			return Reflect.construct(target, args);
		}
	});
	// Discord uses this
	var historyState = {
		apply(target, that, args) {
			if (args[2])
				args[2] = ${url} + args[2];
			alert(args[2]);
			return Reflect.apply(target, that, args);
		}
	};
	History.pushState = new Proxy(History.pushState, historyState);
	History.replaceState = new Proxy(History.pushState, historyState);
	Audio = new Proxy(Audio, {
		construct(target, args) {
			if (args[0])
				args[0] = ctx.http.prefix + args[0];
			return Reflect.construct(target, args);
		},
	});
	open = new Proxy(open, {
		apply(target, that, args) {
			if (args[0])
				args[0] = ctx.http.prefix + args[2];
			return Reflect.apply(target, that, args);
		}
	});

	var fakeLocation = new Proxy(location, {
		get(target, prop) {
			console.log(\`get \${prop}\`);
			return Reflect.get(target, prop);
		},
		set(target, prop, value) {
			console.log(\`set \${prop} to \${value}\`);
			return Reflect.set(target, that, args);
		}
	})
	_location = fakeLocation
	document._location = fakeLocation;
`;

self.url = '';
self._url = '';

self.addEventListener('fetch', event => {
	event.respondWith(async function() {
		if (event.request.mode === 'navigate') {
			self.url = new URL(event.request.url.split(location.origin + ctx.http.prefix)[1]).origin;
			// Delete this later
			self._url = new URL(event.request.url.split(location.origin + ctx.http.prefix)[1]).origin;

			const response = await fetch(event.request.url, {
				// Don't cache
				cache: "no-store"
			});

			const headers = new Headers(response.headers);

			let text = await response.text();

			const scriptNonce = btoa(Math.random()).slice(0, 5);

			return new Response(event.request.destination === 'document' ? `
				<!DOCTYPE html>
				<head>
					<!-- In case csp isn't set to unsafe-inline -->
					<!--<meta http-equiv="Content-Security-Policy" content="script-src 'nonce-${scriptNonce}'"-->
					<meta charset="utf-8">
				</head>
				<script nonce=${scriptNonce}>
					const ctx = ${JSON.stringify(ctx)};
					
					function rewriteUrl(url) {
						if (url.startsWith('about:') || url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('mailto:'))
							return url;
						else if (url.startsWith(location.origin)) {
							const raw = window.location.pathname.split(ctx.http.prefix)[1];

							const origin = new URL(raw).origin;
							if (raw.startsWith(origin)) {
								return ctx.http.prefix + origin + url.split(location.origin)[1].split(ctx.http.prefix)[0];
							}

							const protocolSplit = url.split(location.origin)[1].split('https://');

							return ctx.http.prefix + window.location.pathname.split(ctx.http.prefix)[1] + '/' + protocolSplit[protocolSplit.length - 1];
						} else
							return ctx.http.prefix + url;
						return url;
					}

					let firstScript = true;
					new MutationObserver((mutations, observer) => {	
						for (let mutation of mutations)
							for (let node of mutation.addedNodes) {
								let stack = [node];

								while (node = stack.pop()) {
									if (node instanceof HTMLScriptElement) {
										if (!firstScript) {
											const script = document.createElement('script');

											// Copy properties to the new script
											if (node.async)
												script.async = node.async;
											if (node.crossorigin)
												script.crossorigin = node.crossorigin;
											if (node.defer)
												script.defer = node.defer;
											if (node.id)
												script.id = node.id;
											if (node.integrity)
												script._integrity = node.integrity;
											if (node.nonce)
												script.nonce = node.nonce;
											if (node.referrerpolicy)
												script.referrerpolicy = node.referrerpolicy;
											if (node.src)
												script.src = node.src;
											if (node.type)
												script.type = node.type;

												
											// Scope
											if (node.text !== '' && node.type !== 'application/json')
												script.innerHTML = node.text.replace(/location/g, '_location');

											// Insert rewritten script
											node.after(script);

											// Clean up old script
											node.remove();

											// Don't record this recent mutation
											observer.takeRecords();

											continue;
										} else firstScript = false;
									} else if (node instanceof HTMLIFrameElement || 'HTMLPortalElement' in window && node instanceof HTMLPortalElement && node.src) {
										const rewrittenUrl = rewriteUrl(node.src);

										console.log(\`%csrc%c \${node.src} %c->%c \${rewrittenUrl}\`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

										node.href = rewrittenUrl;
									} else if (node.href && !(node instanceof HTMLLinkElement)) {
										const rewrittenUrl = rewriteUrl(node.href);
										
										console.log(\`%chref%c \${node.href} %c->%c \${rewrittenUrl}\`, 'color: dodgerBlue', '', 'color: mediumPurple', '');
										
										node.href = rewrittenUrl;	
									} else if (node.action) {
										const rewrittenUrl = rewriteUrl(node.action);

										console.log(\`%caction%c \${node.action} %c->%c \${rewrittenUrl}\`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

										node.action = rewrittenUrl;
									} else if (node instanceof HTMLMetaElement && node.httpEquiv === 'refresh' && node.content) {
										const rewrittenUrl = rewriteUrl(node.content);

										console.log(\`%refresh%c \${node.content} %c->%c \${rewrittenUrl}\`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

										node.content = rewrittenUrl;
									}
								}
							}
					}).observe(document, {
						childList: true,
						subtree: true
					});
					
					// Update the url hash.
					//addEventListener('hashchange', event => ctx.url = location.hash);
					
					// Clear history.
					history.replaceState({}, '');
					
					// Don't set the history.
					addEventListener('popstate', event => event.preventDefault());
					
					${gel}
				</script>
				${text}
			` : response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: headers
			});
		}

		// Get site url
		var url = location.origin + ctx.http.prefix;

		const originSplit = event.request.url.split(location.origin);

		if (originSplit.length === 1)
			url += originSplit[0];
		else {
			const prefixSplit = originSplit[1].split(ctx.http.prefix);

			// If the url is already valid then don't do anything
			if (prefixSplit.length === 2 && prefixSplit[1].startsWith(self.url)) {
				url += prefixSplit[1];
			}
			else {
				const protocolSplit = prefixSplit[prefixSplit.length - 1].split('https:/');
				 
				url += self.url + protocolSplit[protocolSplit.length - 1];
			}
		}

		console.log(`%csw%c ${event.request.url} %c${event.request.destination} %c->%c ${url}`, 'color: dodgerBlue', '', 'color: yellow', 'color: mediumPurple', '');

		// CORS testing
		try {
			const controller = new AbortController();
			const signal = controller.signal;

			await fetch(url, { signal });

			// Don't actually send the request.
			controller.abort()
		} catch (err) {
			if (err.name !== 'AbortError')
				// Report CORS error
				throw err;
		}

		console.log(url);

		// Fetch resource
		const response = await fetch(url, {
			body: event.request.body,
			bodyUsed: event.request.bodyUsed,
			headers: {
				...event.request.headers,
				_Referer: _url
			}
		});

		// Easy way to handle streams
		if (event.request.destination !== 'script') {
			const clone = response.clone();
			return clone;
		}

		let text = await response.text();

		if (event.request.destination === 'script') {
			/*
			text = `
				${gel}

				${text.replace(/location/g, '_location')}
			`;
			*/
			text = text.replace(/location/g, '_location');
		}

		let headers = new Headers(response.headers);

		headers.delete('Content-Length');

		return new Response(text, {
			status: response.status,
			statusText: response.statusText,
			// Fonts will be fixed whenever content-length is removed
			// I am currently trying to get https://coolmath.com and https://ridgethread.com/ to work
			headers: headers
		});
	}());
});

/*
Only supports chromium with the flag enable-experimental-cookie-features and a secure context
https://wicg.github.io/cookie-store/#typedefdef-cookielist
*/
self.addEventListener('cookiechange', event => {
	for (const cookie of event.changed) {
		console.log('Cookie changed', cookie);
	}

	for (const cookie of event.deleted) {
		console.log('Deleted a cookie', cookie);
	}
});