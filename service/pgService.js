const {Client} = require('pg');

class PgService {
    constructor() {
        this.client = new Client({
            host: String(process.env.PG_HOST),
            user: String(process.env.PG_USER),
            port: process.env.PG_PORT,
            password: String(process.env.PG_PASSWORD),
            database: String(process.env.PG_DATABASE)
        })
        this.client.connect()
    }

}

module.exports = PgService