const Logger = require("./logging");
const mysql = require("mysql");
const logger = new Logger("database");

class DatabaseManager {
    #credentials;
    constructor(credentials) {
        this.credentials = credentials;
        logger.log("DatabaseManager initialized.");
    }
    query(q) {
        return new Promise((resolve, reject) => {
            logger.log("Establishing connection with MySQL server...");
            let connection = mysql.createConnection(this.credentials);
            connection.connect(error => {
                if(error) {
                    logger.log("Failed.");
                    logger.log(error);
                    reject(error);
                    return;
                }
                logger.log(`Connected. (user: ${this.credentials.user}, database: ${this.credentials.database})`);
                logger.log(`Executing query "${q}"...`);
                connection.query(q, (error, results) => {
                    if(error) {
                        logger.log("Failed.");
                        logger.log(error);
                        reject(error);
                        return;
                    }
                    logger.log("Done. Disconnecting...");
                    connection.end();
                    resolve(results);
                });
            });
            
        });
    }
    async insert(table, data) {
        let columns = Object.keys(data);
        let arr = columns.map(c => mysql.escape(data[c]));
        return await this.query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${arr.join(", ")})`);
    }
    async select(table, data = {}, selection = ["*"]) {
        let conditions = Object.keys(data).map(c => `${c}=${mysql.escape(data[c])}`);
        return await this.query(`SELECT ${selection.join(", ")} FROM ${table} WHERE ${conditions.length > 0 ? conditions.join(" AND ") : "1"}`);
    }
}

module.exports = DatabaseManager;

logger.ready();
