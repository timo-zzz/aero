const ctx = JSON.parse(document.getElementsByTagName("script")[0].innerHTML);

function wrap() {
	
}

/*
Audio = new Proxy(Audio, {
	construct(target, args) {
		if (args[0])
			args[0] = ctx.http.prefix + args[0];
		return Reflect.construct(target, args);
	},
});

Object.defineProperty(document, 'cookie', {
	get() {
		//return document.cookie;
	},
	set(value) {
		//document.cookie = value;
	}
});
Object.defineProperty(document, 'domain', {
	get() {
		return new URL(ctx.origin).hostname;
	},
	set(value) {
		return value;
	}
});
*/

var historyState = {
	get(target, prop) {
		console.log(prop);
	},
	apply(target, that, args) {
		console.log(args);
		args[2] = ctx.origin + args[2];
		return Reflect.apply(target, that, args);
	}
};
history.pushState = new Proxy(history.pushState, historyState);
history.replaceState = new Proxy(history.pushState, historyState);

var fakeLocation = new Proxy(location, {
	get(target, prop) {
		//console.log(prop);
		if (typeof target[prop] === 'function') {
			return {
				assign: () => null
			} [prop];
		} else return new URL(ctx.origin)[prop];
	},
	set(target, prop, value) {
		console.log('Set!')
		//console.log(prop);
		//return Reflect.set(target, prop, value);
	}
})
_location = fakeLocation
document._location = fakeLocation;

/*
Element.prototype = new Proxy(Element.prototype, {
	get(target, prop) {
		console.log(prop);
	}
});

['innerHTML','outerHTML'].forEach(prop => {
  Object.defineProperty(window.Element.prototype, prop, {
    get() {
      return this.getAttribute(prop).toString().replace(/_integrity/g, 'integrity').replace(/_location/g, 'location');
    },
    set(val) {
      return this.setAttribute(prop, val.toString());
    }
  });
});
*/

open = new Proxy(open, {
	apply(target, that, args) {
		if (args[0])
			args[0] = ctx.http.prefix + args[2];
		return Reflect.apply(target, that, args);
	}
});

postMessage = new Proxy(postMessage, {
	apply(target, that, args) {
		if (args[1]) {
			args[1] = ctx.origin;
		}
		console.log(args);
		return Reflect.apply(target, that, args);
	}
});

WebSocket = new Proxy(WebSocket, {
	construct(target, args) {
		const protocol = args[0].split('://')[0] + '://';
		args[0] = 'ws://' + location.host + ctx.ws.prefix + args[0];
		alert(args[0]);
		console.log(args);
		return Reflect.construct(target, args);
	}
});

Worker = new Proxy(Worker, {
	construct(target, args) {
		return Reflect.construct(target, args);
	}
});