else {
    let stack = [node];

    while (node = stack.pop()) {
        if (node instanceof Text)
            continue;

        // Attribute rewriting
        // Temporary safety check
        if (node.href && !node.href.startsWith\`http://localhost:3000/\${ctx.http.prefix}\`) {
            //console.log(node.href);
            node.href = rewriteUrl(node.href);
            node._href = node.href;
        }
        if (node.action) {
            node.action = rewriteUrl(node.action);
            node._action = node.action;
        }

        // https://mimesniff.spec.whatwg.org/#javascript-mime-type
        const jsMimeTypes = ['application/ecmascript', 'application/javascript', 'application/x-ecmascript', 'application/x-javascript', 'text/ecmascript', 'text/javascript', 'text/javascript1.0', 'text/javascript1.1', 'text/javascript1.2', 'text/javascript1.3', 'text/javascript1.4', 'text/javascript1.5', 'text/jscript',
            'text/livescript', 'text/x-ecmascript', 'text/x-javascript'
        ];

        if (node instanceof HTMLScriptElement && node.textContent !== '' && ['', 'module', ...jsMimeTypes].includes(node)) {
            // Create the new script.
            const script = document.createElement('script');
            script.type = 'application/javascript';
            script.text = scope(node.text, ctx.url.origin);

            // Insert new script after this one.
            node.parentNode.insertBefore(script, node.nextSibling);

            // Delete the old script.
            node.remove();

            // Don't rewrite again.
            //observer.takeRecords();
        } else if (
            node instanceof HTMLMetaElement &&
            // https://html.spec.whatwg.org/multipage/semantics.html#attr-meta-http-equiv-content-security-policy
            node.httpEquiv.toLowerCase() == 'content-security-policy' &&
            (node.parentElement instanceof HTMLHeadElement || node.content !== '')
        )
            ctx.csp.push(node.content);

        if (node.childNodes instanceof NodeList)
            for (let child of node.childNodes)
                stack.push(child);
    }
}