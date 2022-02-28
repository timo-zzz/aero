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
//self.addEventListener('message', event => ctx = event.data);

self.origin = '';
self.gel = `
	/*
	Object.defineProperty(document, 'cookie', {
		get() {
			console.log('cookie get');
			//return document.cookie;
		},
		set(value) {
			// causes infinite recursion
			//document.cookie = value;
			console.log(value);
		}
	});
	*/
	Object.defineProperty(document, 'domain', {
		get() {
		  	return new URL(ctx.origin).hostname;
		},
		set(value) {
		  	//return value;
		}
	});
	postMessage = new Proxy(postMessage, {
		apply(target, that, args) {
			if (args[1]) {
				args[1] = ctx.origin
			}
			console.log(args);
			return Reflect.apply(target, that, args);
		}
	});
	WebSocket = new Proxy(WebSocket, {
		construct(target, args) {
			/*
			const protocol = args[0].split('://')[0] + '://';
			args[0] = 'ws://' + location.host + ctx.ws.prefix + args[0];
			alert(args[0]);
			*/
			return Reflect.construct(target, args);
		}
	});
	Worker = new Proxy(Worker, {
		construct(target, args) {
		  alert(args[0]);
		  //return Reflect.construct(target, args);
		}
	});
	var historyState = {
		get(target, prop) {
			console.log(prop);
		},
		apply(target, that, args) {
			if (args[2])
				args[2] = ctx.http.prefix + args[2];
				//args[2] = location.href + args[2];
			console.log(location);
			args[2] = location.pathname;
			return Reflect.apply(target, that, args);
		}
	};
	history.pushState = new Proxy(history.pushState, historyState);
	history.replaceState = new Proxy(history.pushState, historyState);
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
			//console.log(prop);	
			//console.log(ctx.origin);
			//console.log(new URL(ctx.origin)[prop]);
			if (typeof target[prop] === 'function' && false) {
				return {
					assign: () => null
				}[prop];
			}
			else return new URL(ctx.origin)[prop];
		},
		set(target, prop, value) {
			return Reflect.set(target, that, args);
		}
	})
	_location = fakeLocation
	document._location = fakeLocation;
	['innerHTML','outerHTML'].forEach(prop => {
	  Object.defineProperty(window.Element.prototype, prop, {
	    get() {
	      return this
		  	.getAttribute(prop)
		  	.toString()
			.replace(/_integrity/g, 'integrity')
			.replace(/_location/g, 'location');
	    },
	    set(val) {
	      return this
		  	.setAttribute(prop, val.toString().replace(/<meta[^>]+>/g, '')
			.replace(/integrity/g, '_integrity')
			.replace(/location/g, '_location')
			.replace(/rel=["']?preload["']?/g, '')
			.replace(/rel=["']?preconnect["']?/g, ''));
	    }
	  });
	});
`;

self.origin = '';

self.addEventListener('fetch', event => {
	event.respondWith(async function() {
		if (event.request.mode === 'navigate') { 	
			origin = new URL(event.request.url.split(location.origin + ctx.http.prefix)[1]).origin;

			const response = await fetch(event.request.url, {
				// Don't cache
				cache: "no-store"
			});

			const headers = new Headers(response.headers);

			let text = await response.text();

			function generateNonce() {
				return btoa(Math.random()).slice(0, 5);
			}

			return new Response(event.request.destination === 'document' ? `
				<!DOCTYPE html>
				<body>
				</body>
				<head>
					<script nonce=${generateNonce()}>
						var ctx = ${JSON.stringify(ctx)};
						ctx.origin = '${origin}';
						
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

						new MutationObserver((mutations, observer) => {
							//console.log(mutations);	
							for (let mutation of mutations)
								for (let node of mutation.addedNodes) {
									let stack = [node];

									while (node = stack.pop()) {
										if (node.href && !(node instanceof HTMLLinkElement)) {
											const rewrittenUrl = rewriteUrl(node.href);
											
											//console.log(\`%chref%c \${node.href} %c->%c \${rewrittenUrl}\`, 'color: dodgerBlue', '', 'color: mediumPurple', '');
											
											node.href = rewrittenUrl;	
										} else if (node.action) {
											const rewrittenUrl = rewriteUrl(node.action);

											console.log(\`%caction%c \${node.action} %c->%c \${rewrittenUrl}\`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

											node.action = rewrittenUrl;
										} else if ((node instanceof HTMLIFrameElement || node instanceof HTMLFrameElement) && node.src) {
											const rewrittenUrl = rewriteUrl(node.src);

											console.log(\`%csrc%c \${node.src} %c->%c \${rewrittenUrl}\`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

											// The problem is that it changes the origin, to fix this it would need to directly access window object
											//node.src = rewrittenUrl;
										}
									}
								}
						}).observe(document, {
							childList: true,
							subtree: true
						});
						
						// Clear history.
						//history.replaceState({}, '');
						
						// Don't set the history.
						//addEventListener('popstate', event => event.preventDefault());
						
						${gel}
					</script>
					${
						text
							.replace(/<meta[^>]+>/gms, '')
							.replace(/integrity/g, '_integrity')
							.replace(/location/gms, '_location')
							.replace(/rel=["']?preload["']?/g, '')
							.replace(/rel=["']?preconnect["']?/g, '')
							.replace(/rel=["']?prefetch["']?/g, '')
					}
				</head>
			` : response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: headers
			});
		}

		if (event.request.url.startsWith('data:')) {
			var url = event.request.url;
		} else {
			var url = location.origin + ctx.http.prefix;

			const originSplit = event.request.url.split(location.origin);

			if (originSplit.length === 1)
				url += originSplit[0];
			else {
				const prefixSplit = originSplit[1].split(ctx.http.prefix);

				// If the url is already valid then don't do anything
				if (prefixSplit.length === 2 && prefixSplit[1].startsWith(url))
					url += prefixSplit[1];
				else {
					//console.log(origin);

					var prefix = prefixSplit[prefixSplit.length - 1];
					
					const protocolSplit = prefix.startsWith('https:/') ? prefix.split('https:/') : prefix.split('http:/');

					let pathSplit = protocolSplit[protocolSplit.length - 1].split('/' + new URL(origin).hostname);
					let path = pathSplit[pathSplit.length - 1];

					let dotSplit = path.split('/')[1].split('.');

					// If another origin
					if (dotSplit.length === 2 && protocolSplit.length === 3)
						url += 'https:/' + path;
					else
						url += origin + path;
				}
			}
		}

		// CORS testing
		/*
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
		*/

		// Fetch resource
		const response = await fetch(url, {
			body: event.request.body,
			bodyUsed: event.request.bodyUsed,
			headers: {
				...event.request.headers,
				_Referer: origin
			},
			method: event.request.method,
			mode: event.request.mode
		});

		
		let delHeaders = ['content-length', 'cross-origin-opener-policy-report-only', 'cross-origin-opener-policy', 'report-to', 'vary', 'x-content-type-options'];
		
		var headers = Object.fromEntries([...response.headers].filter(([header]) => delHeaders.indexOf(header) === -1));

		console.log(`%csw%c ${event.request.url} %c${event.request.destination} %c->%c ${url}`, 'color: dodgerBlue', '', 'color: yellow', 'color: mediumPurple', '');

		console.log(headers);

		// Easy way to handle streams
		if (event.request.destination !== 'script') {
			return new Response(response.body, {
				headers: headers,
				statusText: response.statusText
			});
		}

		let text = await response.text();

		// I will have another option for aero jail
		if (event.request.destination === 'script')
			text = text.replace(/location/gms, '_location');

		return new Response(text, {
			status: response.status,
			statusText: response.statusText,
			headers: headers
		});
	}());
});
