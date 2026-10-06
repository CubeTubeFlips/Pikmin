const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise');
const { check, validationResult } = require('express-validator');

const app = express();
app.use(express.static('public'))

const upload = multer()
const port = 8080

let connection = null;


async function query(sql, params) {
    if (null === connection) {
        console.log('Here');
        connection = await mysql.createConnection({
            host: "student-databases.cvode4s4cwrc.us-west-2.rds.amazonaws.com",
            user: "LIAMGABBARD",
            password: "SEzH7tURMHzyliOyLJiId8U2MJ7QyjuarOC",
            database: 'LIAMGABBARD'
        });
    }

    const [results,] = await connection.execute(sql, params);
    return results;
}

app.get(
    '/pikmin/',
    upload.none(),
    async (request, response) => {
        let result = {};
        try {
            let selectSql = `SELECT
                        ptg.id,
                        ptg.pikmin_id,
                        ptg.games_id,
                        pc.id,
                        pc.pikmin_type,
                        pc.weight_units,
                        pc.can_fly,
                        pg.id,
                        pg.name,
                        pg.year_of_release,
                        pg.is_good
                    FROM pikmin_to_games ptg
                    INNER JOIN pikmin_games pg ON ptg.games_id = pg.id
                    INNER JOIN pikmin_container pc ON ptg.pikmin_id = pc.id`,
                whereStatements = [],
                orderByStatements = [],
                queryParameters = [];


            //Request query stuff
            if (request.query.level) {
                whereStatements.push('pc.pikmin_type = ?');
                queryParameters.push(request.query.level);
            }

            if (request.query.weight) {
                whereStatements.push('pc.weight_units = ?');
                queryParameters.push(request.query.weight);
            }

            if (request.query.fly) {
                whereStatements.push('pc.can_fly = ?');
                queryParameters.push(request.query.fly);
            }

            if (request.query.game) {
                whereStatements.push('pg.id = ?');
                queryParameters.push(request.query.game);
            }

            if (request.query.year) {
                whereStatements.push('pg.year_of_release = ?');
                queryParameters.push(request.query.year);
            }

            if (request.query.goodness) {
                whereStatements.push('pg.is_good = ?');
                queryParameters.push(request.query.goodness);
            }

            if (typeof request.query.sort !== 'undefined') {
                const sort = request.query.sort;

                if (sort === 'ASC') {
                    orderByStatements.push('pc.weight_units ASC');
                } else if (sort === 'DESC') {
                    orderByStatements.push('pc.weight_units DESC');
                }
            }

            //Dynamically add WHERE expressions to SELECT statements if needed
            if (whereStatements.length > 0) {
                selectSql = selectSql + ' WHERE ' + whereStatements.join(' AND ');
            }

            //Dynamically add ORDER BY expressions to SELECT statements if needed
            if (orderByStatements.length > 0) {
                selectSql = selectSql + ' ORDER BY ' + orderByStatements.join(' , ');
            }

            //Dynamically add LIMIT expressions to SELECT statements if needed
            if (request.query.limit && request.query.limit > 0 && request.query.limit <= 200) {
                selectSql += ' LIMIT ' + parseInt(request.query.limit);
            }

            result = await query(selectSql, queryParameters);
        } catch (error) {
            console.log(error);
            return response.status(500) //Error code 
                .json({ message: 'Something went wrong with the server.' });
        }
        //Default response object
        response.json({ 'data': result });
    });

app.listen(port, '0.0.0.0', () => {
    console.log(`Application listening at http://localhost:${port}`);
})

app.post(
    '/pikmin/insert',
    upload.none(),

    check('level', 'Please select a valid Pikmin type.').isIn([
        'Red Pikmin', 'Blue Pikmin', 'Yellow Pikmin', 'Purple Pikmin', 'Rock Pikmin', 'Winged Pikmin', 'Ice Pikmin', 'Glow Pikmin'
    ]),

    check('weight', 'Please select a valid weight number.').isInt({ min: 1 }),

    check('fly', 'Please select if a Pikmin can or cannot fly.').isInt({ min: 0, max: 1 }),

    check('game', 'Please enter a valid Pikmin game.').isInt({ min: 1, max: 6 }),

    check('year', 'Please enter a valid year.').isInt({ min: 1900, max: 2100 }),

    check('goodness', 'Please state whether the game is good or not.').isInt({ min: 0, max: 1 }),

    async (request, response) => {
        const errors = validationResult(request);

        if (!errors.isEmpty()) {
            return response.status(400).json({
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        try {
            // Insert into pikmin_container
            const result1 = await query(
                `INSERT INTO pikmin_container (pikmin_type, weight_units, can_fly)
                 VALUES (?, ?, ?)`,
                [request.body.level, request.body.weight, request.body.fly]
            );

            const pikminId = result1.insertId;

            // Insert into join table
            await query(
                `INSERT INTO pikmin_to_games (pikmin_id, games_id)
                 VALUES (?, ?)`,
                [pikminId, request.body.game]
            );

            response.json({ message: 'Insert successful!' });

        } catch (error) {
            console.error("INSERT ERROR:", error);
            return response.status(500).json({
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage
            });
        }
    }
);

//The GET and PUT stuff for edit.html :)
app.get(
    '/pikmin/:id',
    upload.none(),
    async (request, response) => {
        try {
            const sql = `
                SELECT 
                    ptg.id AS ptg_id,
                    pc.pikmin_type AS level,
                    pc.weight_units AS weight,
                    pc.can_fly AS fly,
                    pg.id AS game,
                    pg.year_of_release AS year,
                    pg.is_good AS goodness
                FROM pikmin_to_games ptg
                INNER JOIN pikmin_container pc ON ptg.pikmin_id = pc.id
                INNER JOIN pikmin_games pg ON ptg.games_id = pg.id
                WHERE ptg.id = ?
            `;

            const result = await query(sql, [request.params.id]);

            if (result.length === 0) {
                return response.status(404).json({ message: 'Not found' });
            }

            response.json({ data: result[0] });

        } catch (error) {
            console.error(error);
            return response.status(500).json({
                message: 'Server error'
            });
        }
    }
);

app.put(
    '/pikmin/:id',
    upload.none(),

    check('level', 'Please select a valid Pikmin type.').isIn([
        'Red Pikmin', 'Blue Pikmin', 'Yellow Pikmin', 'Purple Pikmin', 'Rock Pikmin', 'Winged Pikmin', 'Ice Pikmin', 'Glow Pikmin'
    ]),

    check('weight', 'Please select a valid weight number.').isInt({ min: 1 }),

    check('fly', 'Please select if a Pikmin can or cannot fly.').isInt({ min: 0, max: 1 }),

    check('game', 'Please enter a valid Pikmin game.').isInt({ min: 1, max: 6 }),

    check('year', 'Please enter a valid year.').isInt({ min: 1900, max: 2100 }),

    check('goodness', 'Please state whether the game is good or not.').isInt({ min: 0, max: 1 }),

    async (request, response) => {

        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        try {
            const ptgId = request.params.id;

            const link = await query(
                `SELECT pikmin_id, games_id
                 FROM pikmin_to_games
                 WHERE id = ?`,
                [ptgId]
            );

            if (link.length === 0) {
                return response.status(404).json({ message: 'Not found' });
            }

            const pikminId = link[0].pikmin_id;
            const gameId = link[0].games_id;

            await query(
                `UPDATE pikmin_container
                 SET pikmin_type = ?, weight_units = ?, can_fly = ?
                 WHERE id = ?`,
                [
                    request.body.level,
                    request.body.weight,
                    request.body.fly,
                    pikminId
                ]
            );

            await query(
                `UPDATE pikmin_to_games
                 SET games_id = ?
                 WHERE id = ?`,
                [
                    request.body.game,
                    ptgId
                ]
            );

            await query(
                `UPDATE pikmin_games
                 SET year_of_release = ?, is_good = ?
                 WHERE id = ?`,
                [
                    request.body.year,
                    request.body.goodness,
                    request.body.game
                ]
            );

            response.json({ message: 'Update successful!' });

        } catch (error) {
            console.error(error);
            return response.status(500).json({
                message: 'Server error'
            });
        }
    }
);

/*
app.post(
    '/',
    upload.none(),

    check('level', 'Please enter a valid Pikmin type.').isIn([
        'Red Pikmin',
        'Blue Pikmin',
        'Yellow Pikmin',
        'Purple Pikmin',
        'Rock Pikmin',
        'Winged Pikmin',
        'Ice Pikmin',
        'Glow Pikmin'
    ]),

    check('weight', 'Please enter a valid weight.').isLength({ min: 1 }),

    check('fly', 'State whether a Pikmin can or cannot fly.').isInt([
        '0',
        '1'
    ]),

    check('sort', 'Please select a valid sorting option.').isIn([
        '',
        'ASC',
        'DESC'
    ]),

    check('game', 'Please choose a valid game.').isIn([
        '',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6'
    ]),

    check('year', 'Please enter a valid year.').isLength({ min: 3 }),

    check('goodness', 'Please state whether the game is good or not.').isInt([
        '0',
        '1'
    ]),

    async (request, response) => {

        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response
                .status(400)
                .setHeader('Access-Control-Allow-Origin', '*')
                .json({
                    message: 'Request fields or files are invalid.',
                    errors: errors.array(),
                });
        }
        return response
            .status(200)
            .setHeader('Access-Control-Allow-Origin', '*')
            .setHeader('Content-Type', 'application/json')
            .json({ text: textOut });
    }
);
*/