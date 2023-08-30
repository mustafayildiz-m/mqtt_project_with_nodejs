const pgService = require("../service/pgService");
require('dotenv').config()

module.exports = async (req, res, next) => {
    try {
        const pgClient = await new pgService(); //--->postgresql connection
        if (process.env.DEVELOPMENT_MODE === 'false') { //development modu kapalı olma durumunda
            let query = {
                text: 'select api_key from work_spaces where id = $1',
                values: [req.body.workspace_id]
            }
            if (req.headers.authorization) {
                await pgClient.client.query(query, (err, pg_res) => {
                    if (pg_res.rowCount > 0) {
                        if (pg_res.rows[0].api_key === req.headers.authorization) {
                            return next()
                        } else {
                            return res.status(401).json({
                                error: 'invalid Request',
                                message: 'Incorrect API key provided'
                            })
                        }
                    } else {
                        return res.status(401).json({
                            error: 'invalid Request',
                            message: 'There is no workspace matched'
                        })
                    }
                })
            } else {
                return res.status(401).json({
                    error: 'invalid Request',
                    message: 'There is no authorization in headers'
                })

            }

        } else if (process.env.DEVELOPMENT_MODE === 'true') { //development mod açıksa
            next()
        } else {
            return res.status(401).json({
                error: 'invalid Request',
                message: 'Check env file for development mode'
            })
        }
    } catch (e) {
        return res.status(401).json({
            error: new Error('invalid Request')
        })
    }
}