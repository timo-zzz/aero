'use strict';

let w = {
	document: {
		baseURI: new Proxy({}, {
			get: (target, prop) => ctx.url.origin
		}),
		documentURI: new Proxy({}, {
			get: (target, prop) => ctx.url.origin
		})
	},
	location: new Proxy({}, {
		get(target, prop) {
			return ctx.url[prop];
		}
	}),
	origin: new Proxy({}, {
		get() {
			return ctx.url.origin
		}
	})
	/*
	WebSocket: class WebSocket extends WebSocket {
		constructor(url, protocol) {
			url = ctx.ws.prefix + url;
	
			return Reflect.construct(...args);
		}
	},
	RTCPeerConnection: class RTCPeerConnection extends EventTarget {
		constructor(config) {
			super();
	
			this.socket = new WebSocket(ctx.ice.prefix)
	
			this.socket.addEventListener('open', () => {
				this.socket.send(JSON.stringify(config));
			});
		}
		close() {
			this.socket.close();
		}
	}
	*/
};

if (!('cookieStore' in window)) {
	w.document.cookie = new Proxy({}, {
		set: (target, prop) => {
			const directives = target[prop].split('; ');

			for (directive of directives) {
				const pair = directive.split('=');
				switch (pair) {
					case 'path':
				}
			}

			return directives.join('; ');
		}
	});
}