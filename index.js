//initialise dependencies
var express = require("express"),
    app = express(),
    bodyParser = require("body-parser"),
    pg = require("pg"),
    argon2 = require("argon2"),
    favicon = require("serve-favicon");
var exports = module.exports = {};

//allow access to 'public' and 'views' folders
app.use(express.static("public"));
app.use(express.static("views"));

//use file as favicon
app.use(favicon(__dirname + "/public/res/favicon.ico"));

//set http header and reply type
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));

//set up 'pug' rendering
app.set("views", "./views");
app.set("view engine", "pug");

//runs at server startup
var server = app.listen(process.env.PORT || 3000, function() {
    console.log("App Running");
});

//runs at server close
exports.closeServer = function() {
    server.close();
};

//adds script to print queue database
function print(id, username) {
    console.error(username);
    //INSERT INTO print_queue(id,requester) VALUES(id,'requester');
    pg.connect(process.env.DATABASE_URL || "postgres://localhost:5432/abdel", function(err, client, done) {
        client.query("INSERT INTO print_queue(id,requester) VALUES(" +
            id +
            ",\'" +
            username +
            "\');",
            function(err, result) {
                done();
                if (err) {
                    console.error(err);
                }
            });
    });
}

// GET request for '/'
app.get("/", function(req, res) {
    //render 'index.pug'
    res.render("index");
});

//POST request for '/register'
app.post("/register", function(req, res) {
    //verifies that parameters have been received
    if (!req.body.id || !req.body.pass || !req.body.email) {
        res.status(400).send("bad request");
    }
    //SELECT * FROM users WHERE id = 'id';
    pg.connect(process.env.DATABASE_URL || "postgres://localhost:5432/abdel", function(err, client, done) {
        client.query("SELECT * FROM users WHERE id = \'" +
            req.body.id +
            "\' OR email = \'" +
            req.body.email +
            "\';",
            function(err, result) {
                done();
                if (err) {
                    return console.error(err);
                }
                //check if username is taken
                if (result.rows != "") {
                    return res.status(400).send("username or email already exists");
                } else {
                    //generate password hash and salt
                    argon2.generateSalt().then((salt) => {
                        argon2.hash(req.body.pass, salt).then((hash) => {
                            //INSERT INTO users VALUES('id','email','salt','hash');
                            client.query("INSERT INTO users VALUES(\'" +
                                req.body.id +
                                "\',\'" +
                                req.body.email +
                                "\',\'" +
                                salt.toString("hex") +
                                "\',\'" +
                                hash +
                                "\');",
                                function(err, result) {
                                    done();
                                    if (err) {
                                        return console.error(err);
                                    }
                                    res.status(200).end();
                                });
                        });
                    });
                }
            });
    });
});

//POST request for '/login'
app.post("/login", function(req, res) {
    //verifies that parameters have been received
    if (!req.body.id || !req.body.pass) {
        res.status(400).send("bad request");
    }
    //SELECT hash FROM users WHERE id = 'id';
    pg.connect(process.env.DATABASE_URL || "postgres://localhost:5432/abdel", function(err, client, done) {
        client.query("SELECT hash FROM users WHERE id = \'" +
            req.body.id +
            "\';",
            function(err, result) {
                done();
                if (err) {
                    return console.error("something happened: " + err);
                }
                //verify if user id exists
                if (result.rows != "") {
                    //verify if given password matches the stored password
                    argon2.verify(result.rows[0].hash, req.body.pass).then((match) => {
                        if (match) {
                            return res.status(200).end();
                        } else {
                            return res.status(400).send("incorrect password");
                        }
                    });
                } else {
                    res.status(400).send("incorrect username");
                }
            });
    });
});

//GET request for '/script/hot'
app.get("/script/hot", function(req, res) {
    //SELECT * FROM scripts ORDER BY print_count* 1.5*(1-((exp((((CURRENT_TIMESTAMP::date - time_created::date)::int - 1.5))/0.5)-exp(-((((CURRENT_TIMESTAMP::date - time_created::date)::int - 1.5))/0.5)))/(exp((((CURRENT_TIMESTAMP::date - time_created::date)::int - 1.5))/0.5)+exp(-((((CURRENT_TIMESTAMP::date - time_created::date)::int - 1.5))/0.5))))) DESC LIMIT 10;
    pg.connect(process.env.DATABASE_URL || "postgres://localhost:5432/abdel", function(err, client, done) {
        client.query("SELECT * FROM scripts ORDER BY print_count* 1.5*(1-((exp((((CURRENT_TIMESTAMP::date - time_created::date)::int - 1.5))/0.5)-exp(-((((CURRENT_TIMESTAMP::date - time_created::date)::int - 1.5))/0.5)))/(exp((((CURRENT_TIMESTAMP::date - time_created::date)::int - 1.5))/0.5)+exp(-((((CURRENT_TIMESTAMP::date - time_created::date)::int - 1.5))/0.5))))) DESC LIMIT 10;", function(err, result) {
            done();
            if (err) {
                return console.error(err);
            }
            res.json(result.rows);
        });
    });
});

//POST request for '/script/save'
app.post("/script/save", function(req, res) {
    //verifies that parameters have been received
    if (!req.body.name || !req.body.creator || !req.body.script) {
        res.status(400).send("400 bad request");
    }
    //INSERT INTO scripts(name,creator,time_created,script,print_count) VALUES('name','creator',CURRENT_TIMESTAMP,'script',print_count);
    pg.connect(process.env.DATABASE_URL || "postgres://localhost:5432/abdel", function(err, client, done) {
        client.query("INSERT INTO scripts(name,creator,time_created,script,print_count) VALUES(\'" +
            req.body.name +
            "\',\'" +
            req.body.creator +
            "\',CURRENT_TIMESTAMP" +
            ",\'" +
            req.body.script +
            "\'," +
            req.body.print_count +
            ");",
            function(err, result) {
                if (err) {
                    return console.error(err);
                }
                //check if script will be printed now
                if (req.body.print_count == 1) {
                    //SELECT id FROM scripts ORDER BY time_created DESC LIMIT 1;
                    client.query("SELECT id FROM scripts ORDER BY time_created DESC LIMIT 1;", function(err, result) {
                        if (err) {
                            return console.error(err);
                        }
                        print(result.rows[0].id, req.body.creator);
                    });
                }
                done();
                res.status(200).end();
            });
    });
});

//GET request for '/scripts/search/:search'
app.get("/script/search/:search", function(req, res) {
    //verifies that parameter has been received
    if (!req.params.search) {
        res.status(400).send("bad request");
    }

    //SELECT * FROM scripts WHERE creator = 'search' OR name = 'search';
    pg.connect(process.env.DATABASE_URL || "postgres://localhost:5432/abdel", function(err, client, done) {
        client.query("SELECT * FROM scripts WHERE creator = \'" +
            req.params.search +
            "\' OR name = \'" +
            req.params.search +
            "\';",
            function(err, result) {
                done();
                if (err) {
                    return console.error(err);
                }
                res.json(result.rows);
            });
    });
});

//GET request for '/script/user/:user'
app.get("/script/user/:user", function(req, res) {
    //verifies that parameter has been received
    if (!req.params.user) {
        res.status(400).send("400 bad request");
    }
    //SELECT * FROM scripts WHERE creator = 'user';
    pg.connect(process.env.DATABASE_URL || "postgres://localhost:5432/abdel", function(err, client, done) {
        client.query("SELECT * FROM scripts WHERE creator = \'" +
            req.params.user +
            "\';",
            function(err, result) {
                done();
                if (err) {
                    return console.error(err);
                }
                res.json(result.rows);
            });
    });
});

//PUT request for '/print/add/:id/:requester'
app.put("/print/add/:id/:requester", function(req, res) {
    //verifies that parameter has been received
    if (!req.params.requester) {
        res.status(400).send("bad request");
    }
    //UPDATE scripts SET print_count = print_count + 1 WHERE id = id;
    pg.connect(process.env.DATABASE_URL || "postgres://localhost:5432/abdel", function(err, client, done) {
        client.query("UPDATE scripts SET print_count = print_count + 1 WHERE id = " +
            req.params.id +
            ";",
            function(err, result) {
                done();
                if (err) {
                    return console.error("error here" + err);
                }
                //add to print queue
                print(req.params.id, req.params.requester);
                res.status(200).end();
            });
    });
});

//DELETE request for '/print/remove/:id'
app.delete("/print/remove/:id", function(req, res) {
    //verifies that parameters have been received
    if (!req.params.id) {
        res.status(400).send("400 bad request");
    }

    //DELETE FROM print_queue WHERE print_id = id;
    pg.connect(process.env.DATABASE_URL || "postgres://localhost:5432/abdel", function(err, client, done) {
        client.query("DELETE FROM print_queue WHERE print_id = " +
            req.params.id +
            ";",
            function(err, result) {
                done();
                if (err) {
                    console.error(err);
                }
                res.status(200).end();
            });
    });
});

//GET request for '/print'
app.get("/print", function(req, res) {
    //SELECT * FROM print_queue INNER JOIN scripts ON print_queue.id=scripts.id;
    pg.connect(process.env.DATABASE_URL || "postgres://localhost:5432/abdel", function(err, client, done) {
        client.query("SELECT * FROM print_queue INNER JOIN scripts ON print_queue.id=scripts.id;",
            function(err, result) {
                done();
                if (err) {
                    return console.error(err);
                }
                res.json(result.rows);
            });
    });
});

//DELETE request for '/print/flush'
app.delete("/print/flush", function(req, res) {

    //DELETE FROM print_queue;
    pg.connect(process.env.DATABASE_URL || "postgres://localhost:5432/abdel", function(err, client, done) {
        client.query("DELETE FROM print_queue;",
            function(err, result) {
                done();
                if (err) {
                    console.error(err);
                }
                res.status(200).end();
            });
    });
});

//DELETE request for '/user/remove'
app.delete("/user/remove", function(req, res) {
    //verifies that parameters have been received
    if (!req.body.id) {
        res.status(400).send("400 bad request");
    }

    //DELETE FROM users WHERE print_id = id;
    pg.connect(process.env.DATABASE_URL || "postgres://localhost:5432/abdel", function(err, client, done) {
        client.query("DELETE FROM users WHERE id = \'" +
            req.body.id +
            "\';",
            function(err, result) {
                done();
                if (err) {
                    console.error(err);
                }
                res.status(200).end();
            });
    });
});

//DELETE request for '/print/remove'
app.delete("/print/remove", function(req, res) {
    //verifies that parameters have been received
    if (!req.body.id) {
        res.status(400).send("400 bad request");
    }

    //DELETE FROM scripts WHERE print_id = id;
    pg.connect(process.env.DATABASE_URL || "postgres://localhost:5432/abdel", function(err, client, done) {
        client.query("DELETE FROM scripts WHERE id = \'" +
            req.body.id +
            "\';",
            function(err, result) {
                done();
                if (err) {
                    console.error(err);
                }
                res.status(200).end();
            });
    });
});
