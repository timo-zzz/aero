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
	for (let mutation of mutations)
		for (let node of mutation.addedNodes) {
			let stack = [node];

			while (node = stack.pop()) {
				if (node.href && !(node instanceof HTMLLinkElement)) {
					const rewrittenUrl = rewriteUrl(node.href);

					console.log(`%chref%c ${node.href} %c->%c ${rewrittenUrl}`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

					node.href = rewrittenUrl;
				} else if (node.action) {
					const rewrittenUrl = rewriteUrl(node.action);

					console.log(`%caction%c ${node.action} %c->%c ${rewrittenUrl}`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

					node.action = rewrittenUrl;
				} else if (node instanceof HTMLIFrameElement && node.src) {
					const rewrittenUrl = rewriteUrl(node.src);

					console.log(`%csrc%c ${node.src} %c->%c ${rewrittenUrl}`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

					node.src = rewrittenUrl;
				}
			}
		}
}).observe(document, {
	childList: true,
	subtree: true
});