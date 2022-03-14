import { getRequestUrl } from './getRequestUrl';
import { allowOrigin } from './corsTest.js';
import { handle } from './handle';

// Don't wait for the old service workers
self.addEventListener('install', () => self.skipWaiting());

// Use the service worker immediately instead of after reload
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
	const url = getRequestUrl(event.request.url);

	if (allowOrigin(url))
		event.respondWith(handle(url))
});
