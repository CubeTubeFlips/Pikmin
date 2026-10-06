//Libraries
const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise');
const { check, validationResult } = require('express-validator');
//const course = require('./Model/course');

//Setup defaults for script
const app = express();
app.use(express.static('public'))

const upload = multer()
const port = 80

let connection = null;


async function query(sql, params) {
    //Singleton DB connection
    if (null === connection) {
        console.log('Here');
        connection = await mysql.createConnection({
            host: "student-databases.cvode4s4cwrc.us-west-2.rds.amazonaws.com",
            user: "LIAMGABBARD",
            password: "SEzH7tURMHzyliOyLJiId8U2MJ7QyjuarOC",
            database: 'LIAMGABBARD' //Same as user
        });
    }

    const [results,] = await connection.execute(sql, params);
    return results;
}

//The * in app.* needs to match the method type of the request
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
            if (request.query.limit && request.query.limit > 0 && request.query.limit <= 10) {
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

app.listen(port, () => {
    console.log(`Application listening at http://localhost:${port}`);
})

app.post(
    '/pikmin/insert',
    upload.none(),

    check('level').isIn([
        'Red Pikmin', 'Blue Pikmin', 'Yellow Pikmin', 'Purple Pikmin', 'Rock Pikmin', 'Winged Pikmin', 'Ice Pikmin', 'Glow Pikmin'
    ]),

    check('weight').isInt({ min: 1 }),

    check('fly').isInt({ min: 0, max: 1 }),

    check('game').isInt({ min: 1, max: 6 }),

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