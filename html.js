function rewriteDoc(doc) {
    return doc.replace(/<meta.*>/g, '').replace(/integrity/g, '_$1');
}

export { rewriteDoc };