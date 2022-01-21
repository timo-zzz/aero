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

self.addEventListener('fetch', event => {
	event.respondWith(async function() {
		//console.log(event.request);

		const navigate = event.request.mode === 'navigate';
		if (navigate) {
			const response = await fetch(event.request.url);

			const headers = new Headers(response.headers);

			// This doesn't work if a meta header is set
			headers.set('Referrer-Policy', 'unsafe-url');

			console.log(headers);

			let text = await response.text();

			return new Response(event.request.destination === 'document' ? ` 
				<script>
					console.log('In site');

					const ctx = ${JSON.stringify(ctx)};
					
					function rewriteUrl(url) {
						// TODO: Finish href url rewrites.
						return ctx.http.prefix + url;
					}
					
					new MutationObserver((mutations, observer) => {	
						for (let mutation of mutations)
							for (let node of mutation.addedNodes) {
								let stack = [node];

								while (node = stack.pop()) {
									if (node instanceof HTMLMetaElement) {
										// TODO: Add deleted meta elements to ctx.cors to later be emulated.
										delete node;
										continue;
									} else if (node.href) {
										const rewrittenUrl = rewriteUrl(node.href);
										
										console.log(\`%cHREF%c \${node.href} %c->%c \${rewrittenUrl}\`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

										node.href = rewrittenUrl	
									} else if (node.action) {
										const rewrittenUrl = rewriteUrl(node.action);

										console.log(\`%cACTION%c \${node.action} %c->%c \${rewrittenUrl}\`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

										node.action = rewrittenUrl
									}
								}
							}
					}).observe(document, {
						childList: true,
						subtree: true
					});
					
					// Update the url hash.
					addEventListener('hashchange', event => context.url = location.hash);
					
					// Clear history.
					history.replaceState({}, '');
					
					// Don't set the history.
					addEventListener('popstate', event => event.preventDefault());

				</script>
				${text}
			` : response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: headers
			});
		}

		// Get site url
		let originSplit = event.request.url.split(location.origin);
		var url = location.origin + ctx.http.prefix;
		if (originSplit[0] == '') {
			const siteUrl = event.request.referrer.split(url)[1];

			url += siteUrl;

			const split = `${ctx.http.prefix}https://`;
			const raw = originSplit[1].split(split)[1];
			if (originSplit[1].startsWith(split) && raw.split('/')[0].split('.').length === 1)
				url += `/${raw}`;
			else
				url += originSplit[1];
		} else {
			url += event.request.url;
		}

		console.log(`%cSW%c ${event.request.url} %c->%c ${url}`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

		/*
		// CORS emulation
		const policy = {};

		const tokens = ctx.csp;
		for (const rawToken of tokens) {
			const token = rawToken.trim();

			const parts = token.match(/\S+/g);
			if (Array.isArray(parts)) {
				const name = parts[0].toLowerCase();

				if (name in directives || !name.endsWith('-src'))
					continue;

				// https://fetch.spec.whatwg.org/#concept-request-destination

				const value = parts[1];
				// Normalize and rewrite the value

				policy[name] = value;
			}
		}
		*/

		// Fetch resource
		const response = await fetch(url);

		let text = await response.text();

		if (ctx.scope && event.request.destination === 'script') {
			console.log('Scoping...')
			// Scope
			text = `
				with({
					// Window proxy objects

					// Variable emulation
					let: new Proxy({}, {
						get(target, prop) {
							return undefined;
						},
						set(target, prop, value) {
							if (prop === 'object')
								Object.assign(fakeWindow, value);
							else if (prop in fakeWindow)
								throw new Error('Reassignment!');
							else
								Object.defineProperty(fakeWindow, prop, {
									// Allow deletions
									configurable: true,
									value: value
								});
						}
					}),
					const_: new Proxy({}, {
						get(target, prop) {
							return undefined;
						},
						set(target, prop, value) {
							if (prop === 'object')
								Object.assign(fakeWindow, value);
							else if (prop in fakeWindow)
								throw new Error('Reassignment!');
							else
								Object.defineProperty(fakeWindow, prop, {
									// Allow deletions
									configurable: true,
									value: value,
									// Make property immuatable
									writable: false
								});
						}
					}),
					/*
					eval: new Proxy(eval, {

					})
					*/
					...this
				}) {
					${text.replace(/{.*}|(let {?)/gms, (str, group) => {
						if (group === 'let {')
							return 'let.object = {';
						else if (group === 'let ')
							return 'let.';
						else
							return str;
					})}
				}
			`
		}

		return new Response(text, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers
		});
	}());
});

	/*
	event.respondWith(async function() {
		console.log(event.request);

		const navigate = event.request.mode === 'navigate';

		console.log(`%cSW%c ${event.request.url} %c->%c ${url}`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

		const proxyResponse = await fetch(navigate ? event.request.url : url);


		const response = await fetch(navigate ? event.request.url : url);

		let proxyResponse = response.clone();

		// Copy headers as they're immuatable
		const headers = new Headers(response.headers);


		//var text = await response.text(); 

		text = event.request.destination === 'script' 
			? 
				ctx.scope
					?
						`
							with({
								...this
							}) {
								${text}
							}
						`
					:
						text
			: 
				navigate 
					? `
						<script>
							console.log('In site');

							const ctx = {
								http: {
									prefix: '/http/'
								}
							}
							
							function rewriteUrl(url) {
								return ctx.http.prefix + url;
							}
							
							new MutationObserver((mutations, observer) => {	
								for (let mutation of mutations)
									for (let node of mutation.addedNodes) {
										let stack = [node];

										while (node = stack.pop()) {
											if (node.href) {
												const rewrittenUrl = rewriteUrl(node.href);
												
												console.log(\`%cHREF%c \${node.href} %c->%c \${rewrittenUrl}\`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

												node.href = rewrittenUrl	
											} else if (node.action) {
												const rewrittenUrl = rewriteUrl(node.action);

												console.log(\`%cACTION%c \${node.action} %c->%c \${rewrittenUrl}\`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

												node.action = rewrittenUrl
											}
										}
									}
							}).observe(document, {
								childList: true,
								subtree: true
							});
							
							// Update the url hash.
							addEventListener('hashchange', event => context.url = location.hash);
							
							// Clear history.
							history.replaceState({}, '');
							
							// Don't set the history.
							addEventListener('popstate', event => event.preventDefault());
						</script>
						${text}
					`
					: text;

		proxyResponse.text = text;
	}());
});
*/

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