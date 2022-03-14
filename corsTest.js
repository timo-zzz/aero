function allowOrigin(url) {
    try {
        const controller = new AbortController();
        const signal = controller.signal;

        // This needs to be the actual url without /http/
        await fetch(url, {
            signal
        });

        // Don't actually send the request.
        controller.abort()
    } catch (err) {
        if (err.name !== 'AbortError')
            return false;
    }

    return true;
}

export { allowOrigin };