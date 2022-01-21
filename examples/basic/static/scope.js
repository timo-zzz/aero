function scope(script) {
	let lines = script.split('\n');

	for (line of lines) {
		if (line.trim().startsWith('import'))
			imports += `${line}\n`;
		else
			break;
	}

    return `
		with({
			window: new Proxy({}, {
				get: (target, prop) => {
					if (prop === 'location') {
						return new URL('https://google.com')
					} else
						return window[prop];
				}
				set: (target, prop, value) => {
					if (prop == 'onerror')
					else
						target[prop] = value;
				}
			})
			globalThis: new Proxy(globalThis, {
				get: (target, prop) => prop === 'window' ? this.window : target[prop]
			})
		}) {
			eval(${lines.join('').replace(/'/g, "\\'")});
		}
	`;
}
