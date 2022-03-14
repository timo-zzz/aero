importScripts('./config.js');

import { rewriteDoc } from './html.js';
import { scope } from './scope.js';
import { filterHeaders } from './headers.js';

async function handle(event) {
	console.log(`%csw%c ${event.request.url} %c${event.request.destination} %c->%c ${url}`, 'color: dodgerBlue', '', 'color: yellow', 'color: mediumPurple', '');

	const response = await fetch(url, {
		body: event.request.body,
		headers: {
			...event.request.headers,
			_referer: origin
		},
		method: event.request.method,
		// Don't cache
		cache: 'no-store'
	});

	let text;
	if (event.request.mode === 'navigate' && event.request.destination === 'document') {
		text = await response.text();
		if (text !== '')
			text = `
				<!DOCTYPE html>
				<meta charset=utf-8>
					
				<!--Reset favicon-->
				<link href=data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQEAYAAABPYyMiAAAABmJLR0T///////8JWPfcAAAACXBIWXMAAABIAAAASABGyWs+AAAAF0lEQVRIx2NgGAWjYBSMglEwCkbBSAcACBAAAeaR9cIAAAAASUVORK5CYII= rel="icon" type="image/x-icon"/>
					
				<script id=ctx type=application/json>${JSON.stringify(ctx)}</script>
				<script src=/aero/scope.js type=module></script>
				<script src=/aero/dom.js></script>
				<script src=/aero/window.js></script>

				${rewriteDoc(text)}
			`;
	} else if (event.request.destination === 'script')
		text = scope(await response.text());
	else if (event.request.destination === 'serviceworker')
		text = `
			importScripts('./gel.js');

			${text}
		`;
	else
		text = response.body;

	return new Response(text, {
		status: response.status,
		headers: filterHeaders(response.headers)
	});
}

export { handle };