'use strict';

// Don't wait for the old service workers
self.addEventListener('install', () => self.skipWaiting());

// Use the service worker immediately instead of after reload.
self.addEventListener('activate', event => event.waitUntil(clients.claim()));

//var ctx = {};
var ctx = {
	http: {
		prefix: '/http/'
	},
	scope: true
}
// Set the server ctx.
self.addEventListener('message', event => {
	console.log(event);
	ctx = event.data;
});

self.jail = ``;

self.url = '';

self.addEventListener('fetch', event => {
	event.respondWith(async function() {
		const navigate = event.request.mode === 'navigate';
		if (navigate /*&& event.request.headers.get('Content-Type') === 'text/html'*/) {
			const response = await fetch(event.request.url);

			// Set the url
			// TODO: Use clientId to map the current page.
			self.url = new URL(event.request.url.split(location.origin + ctx.http.prefix)[1]).origin;

			const headers = new Headers(response.headers);

			let text = await response.text();

			return new Response(event.request.destination === 'document' ? ` 
				<!DOCTYPE html>
				<script>
					console.log('In site!');
					
					function rewriteUrl(url) {
						if (url.startsWith('about:') || url.startsWith('data:') || url.startsWith('javascript:'))
							return url;
						else if (url.startsWith(location.origin)) {
							return '${ctx.http.prefix}' + window.location.pathname.split('${ctx.http.prefix}')[1] + url;
						} else
							return '${ctx.http.prefix}' + url;
					}

					let firstScript = true;
					new MutationObserver((mutations, observer) => {	
						for (let mutation of mutations)
							for (let node of mutation.addedNodes) {
								let stack = [node];

								while (node = stack.pop()) {
									if (node instanceof HTMLScriptElement) {
										if (!firstScript) {
											if (
												node.src || node.text !== '',
												// Don't rewrite data.
												node.type !== 'application/json'
											) {
												const script = document.createElement('script');
												
												// Scope
												if (node.text !== '') {
													script.innerHTML = \`	
														!function(window) {
															\${node.text.replace(/{.*}|(let {?)/gms, (str, group) => {
																if (group === 'let {')
																	return 'let_.object = {';
																else if (group === 'let ')
																	return 'let_.';
																else
																	return str;
															})}
														}(jail);
													\`;
												}

												// Insert rewritten script
												node.after(script);

												// Clean up old script
												node.remove();

												// Don't record this recent mutation
												observer.takeRecords();

												continue;
											}
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

					// Jail
					open = new Proxy(open, {
						apply(target, thisArg, args) {
							return Reflect.apply(...args);
						}
					});

					// Variable emulation
					// var can't be overwritten
					var var_ = new Proxy({}, {
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
					// let can't be overwritten in strict mode
					var let = new Proxy({}, {
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
					var const_ = new Proxy({}, {
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

					var jail = {
						...window,
						location: new URL(location.href)
					};

					for (let key of Object.values(jail)) {
						if (typeof jail[key] === 'function')
							// Run functions with window context; this will prevent "Illegal Invocations" errors.
							jail[key] = jail[key].bind(window);
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

		//console.log(event.request.url.split(location.origin));
		//console.log(originSplit.length);

		if (originSplit.length === 1) {
			url += originSplit[0];
		} else
			url += self.url + originSplit[1];

		console.log(`%csw%c ${event.request.url} %c->%c ${url}`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

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

		// Trying to fix the image error
		if (event.request.destination === 'image') {
			const clone =  response.clone();
			return clone;
		}

		let text = await response.text();

		if (ctx.scope && event.request.destination === 'script') {
			// Scope
			text = `
				!function(window) {
					${text.replace(/{.*}|(let {?)/gms, (str, group) => {
						if (group === 'let {')
							return 'let.object = {';
						else if (group === 'let ')
							return 'let.';
						else
							return str;
					})}
				}(jail);
			`
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