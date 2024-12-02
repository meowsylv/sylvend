const Logger = require("./logging");
const mysql = require("mysql");
const logger = new Logger("database");

class DatabaseManager {
    constructor(credentials) {
        this.connection = mysql.createConnection(credentials);
        logger.log("DatabaseManager initialized.");
        this.connection.connect((err) => {
            if(err) {
                logger.log("Could not connect to database. Aborting...");
                throw err;
            }
            logger.log("DatabaseManager ready.");
        });
    }
    query(q) {
        return new Promise((resolve, reject) => {
            logger.log(`Executing query "${q}"...`);
            this.connection.query(q, (error, results) => {
                if(error) {
                    logger.log(error);
                    reject(error);
                    return;
                }
                logger.log("Done.");
                resolve(results);
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
