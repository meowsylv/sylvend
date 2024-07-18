function methods({ package, req, peopleManager }) {
    return {
        ip: ({ page, replace }) => replace(page, req.ip.startsWith("::ffff:") ? req.ip.replace("::ffff:", "") : req.ip),
        version: ({ page, replace }) => replace(page, package.version),
        info: ({ page, replace }) => {
            return replace(page, `\
<h1>${package.name} info</h1>
<h2>General Information</h2>
<ul>
    <li><b>Version:</b> v${package.version}</li>
    <li><b>Node.js version:</b> ${process.version}</li>
</ul>`);
        }
    }
}

module.exports = methods;
