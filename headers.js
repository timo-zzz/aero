let delHeaders = ["cache-control", "content-security-policy", "content-encoding", "content-length", "cross-origin-opener-policy", "cross-origin-opener-policy-report-only", "report-to", "strict-transport-security", "x-content-type-options", "x-frame-options"];

function filterHeaders(headers) {
	return Object.fromEntries(delHeaders.filter(([header]) => !header.startsWith("x-bare") || delHeaders.indexOf(header) === -1));
}

export { filterHeaders };
