const prefix = '/http/'

function rewriteUrl(url) {
	if (url.startsWith('about:') || url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('mailto:'))
		return url;
	else if (url.startsWith(location.origin)) {
		const raw = location.pathname.split(prefix)[1];
		const origin = new URL(raw).origin;

		if (raw.startsWith(origin))
			return prefix + origin + url.split(location.origin)[1].split(prefix)[0];

		const protocolSplit = url.split(location.origin)[1].split('https://');

		return prefix + location.pathname.split(prefix)[1] + '/' + protocolSplit[protocolSplit.length - 1];
	} else
		return prefix + url;
}

new MutationObserver((mutations, observer) => {
	for (let mutation of mutations)
		for (let node of mutation.addedNodes) {
			let stack = [node];

			while (node = stack.pop()) {
				if (node.href && !(node instanceof HTMLLinkElement)) {
					const rewrittenUrl = rewriteUrl(node.href);

					console.log(`%chref%c ${node.href} %c->%c ${rewrittenUrl}`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

					node._href = node.href;
					node.href = rewrittenUrl;
				} else if (node.action) {
					const rewrittenUrl = rewriteUrl(node.action);

					console.log(`%caction%c ${node.action} %c->%c ${rewrittenUrl}`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

					node._action = node.action;
					node.action = rewrittenUrl;
				} else if (node instanceof HTMLIFrameElement && node.src) {
					const rewrittenUrl = rewriteUrl(node.src);

					console.log(`%csrc%c ${node.src} %c->%c ${rewrittenUrl}`, 'color: dodgerBlue', '', 'color: mediumPurple', '');

					node._src = node.src;
					node.src = rewrittenUrl;
				}
			}
		}
}).observe(document, {
	childList: true,
	subtree: true
});