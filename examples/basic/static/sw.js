'use strict';

// Don't wait for the old service workers
self.addEventListener('install', () => self.skipWaiting());

// Use the service worker immediately instead of after reload.
self.addEventListener('activate', event => event.waitUntil(clients.claim()));

var ctx = {
	http: {
		prefix: '/http/'
	},
	scope: false
}

// Set the server ctx.
self.addEventListener('message', event => {
	console.log(event);
	ctx = event.data;
});

self.jail = `
	/*
	WebSocket.prototype = new Proxy(window, {
		apply(target, args) {
			return target[...args];
		}
	});
	*/

	// Discord uses this
	History.prototype.replaceState = new Proxy(History.prototype.pushState, {
		apply(target, thisArg, args) {
			console.log(args[2]);
			args[2] = ctx.http.prefix + args[2];
			target(...args);
		}
	})

	if (Audio in window) {
		Audio = new Proxy(Audio, {
			construct: (target, args) => {
				if (args[0])
					args[0] = ctx.http.prefix + args[0];
				return Reflect.construct(target, args);
			},
		});
	};

	var fakeLocation = new URL('https://example.com/');

	// Variable emulation
	// var can't be overwritten
	var _var = vars => Object.assign(window, vars)

	var jail = new Proxy(window, {
		get(target, prop) {
			console.log(\`%cget%c \${prop}\`, 'color: dodgerBlue', '');
			if (prop === 'location')
				return fakeLocation;
			if (typeof target[prop] === 'function')
				// Run functions with window context; this will prevent "Illegal Invocations" errors.
				return target[prop].bind(window)
			return target[prop];
		},
		set(target, prop, value) {
			console.log(\`%cset%c \${prop}\`, 'color: dodgerBlue', '');
			if (prop === 'location')
				target[prop] = 'http://localhost:3000/http/' + value;
			else
				target[prop] = value;
		}
	});
`;

self.url = '';

self.addEventListener('fetch', event => {
	event.respondWith(async function() {
		if (event.request.mode === 'navigate') {
			self.url = new URL(event.request.url.split(location.origin + ctx.http.prefix)[1]).origin;
			
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
											if (node.text !== '' && node.type !== 'application/json') {
												script.innerHTML = text
											}

											// Insert rewritten script
											node.after(script);

											console.log(script);

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

					// let can't be overwritten in strict mode
					var _let = new Proxy({}, {
						get(target, prop) {
							return undefined;
						},
						set(target, prop, value) {
							if (prop === 'object')
								Object.assign(window, value);
							else if (prop in window)
								throw new Error('Reassignment!');
							else
								Object.defineProperty(window, prop, {
									// Allow deletions
									configurable: true,
									value: value
								});
						}
					});
					// const can't be overwritten
					var _const = new Proxy({}, {
						get(target, prop) {
							return undefined;
						},
						set(target, prop, value) {
							if (prop === 'object')
								Object.assign(window, value);
							else if (prop in window)
								throw new Error('Reassignment!');
							else
								Object.defineProperty(window, prop, {
									// Allow deletions
									configurable: true,
									value: value,
									// Make property immuatable
									writable: false
								});
						}
					});

					// Jail
					${jail}
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

		// Fetch resource
		const response = await fetch(url, {
			body: event.request.body,
			bodyUsed: event.request.bodyUsed
		});

		// Easy way to handle streams
		if (event.request.destination !== 'script') {
			const clone = response.clone();
			return clone;
		}

		let text = await response.text();

		if (event.request.destination === 'script') {
			if (ctx.scope) {
				let importLines = []; 

				let lines = text.split('\n');
				for (let i in lines) {
					if (lines[i].startsWith('import')) {
						importLines.push(lines[i]);
						lines[i] = '';
					} else
						break;
				}

				// Scope
				text = `
					${importLines.join('\n')}

					// Jail
					${jail}

					// Cell
					!function(window, location) {
						${lines.join('\n').replace(/{.*}|(var|let|const) ([^;]+)(?=;)/gms, (match, p1, p2, offset, string, groups) => {
							if (match.startsWith('{'))
								return match;

							let split = p2.split(',');
							split.map(expression => expression.replace(/=/, ':'));
							return `_${p1}({${split.join(',')}})`;
						})}
					}(jail, fakeLocation);
				`;
			} else {

			}
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