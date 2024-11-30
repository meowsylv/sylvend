const Logger = require("./logging");
const logger = new Logger("rate-limits");
let rateLimitedIPs = [];

function rateLimits(rateLimits) {
    return (req, res, next) => {
        let limit;
        if(limit = rateLimits.find(l => (typeof l.path === "object" ? (req.path.search(l.path) !== -1) : req.path.startsWith(l.path)) && l.methods.includes(req.method))) {
            logger.log(`Checking for rate limits on ${req.method} ${req.path}...`);
            let rateLimit;
            if(rateLimit = rateLimitedIPs.find(i => i.ip === req.ip)) {
                logger.log(`Found rate limit for ${req.ip}.`);
                if(rateLimit.timestamp + rateLimit.duration > Date.now()) {
                    logger.log(`This rate limit is still active. Access denied.`);
                    res.status(429).json({ errorCode: 42900, errorMessage: "You are being rate-limited."});
                    return;
                }
                else {
                    logger.log("This rate limit expired. Access granted.");
                    rateLimitedIPs.splice(rateLimitedIPs.indexOf(rateLimit), 1);
                }
            } 
            logger.log(`Setting a new ${limit.duration} ms rate limit for ${req.ip}...`);
            rateLimit = { ip: req.ip, timestamp: Date.now(), duration: limit.duration };
            rateLimitedIPs.push(rateLimit); 
            res.cancelRateLimit = () => {
                logger.log(`cancelRateLimit() has been called. Removing ${limit.duration} ms rate limit for ${req.ip}...`);
                rateLimitedIPs.splice(rateLimit, 1);
            };
        }
        next();
    };
}

module.exports = rateLimits;
logger.ready();
