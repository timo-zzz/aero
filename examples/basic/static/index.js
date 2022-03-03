const prefix = '/http/';

const form = document.getElementsByTagName('form')[0];

form.addEventListener('submit', event => {
    event.preventDefault();

    const query = event.target.getElementsByTagName('input')[0].value;

    if (query.startsWith('http'))
        open(prefix + query)
    else
        open(prefix + 'https://search.brave.com/search?q=' + query);
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', {
        // The Service-Worker-Allowed must be set to '/'
        scope: prefix,
        // Don't cache http requests.
        updateViaCache: 'none'
    }).then(registration => {
        // Update service worker
        registration.update();
    });
}