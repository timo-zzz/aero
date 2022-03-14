function scope(script) {
    return `
        ! function(location) {
            // Don't expose the function
            arguments = undefined;

            ${script}
        }(fakeLocation);
    `;
}

export { scope };